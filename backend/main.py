import sqlite3
import json
import random
import string
import urllib.request
from datetime import date, timedelta, datetime
from flask import Flask, jsonify, request
from flask_cors import CORS

import os
DB_PATH = os.environ.get("DB_PATH", "motel.db")

# ── Google Reviews config ─────────────────────────────────────────────────────
GOOGLE_API_KEY      = "AIzaSyBy7FZLlpJ0HrcIipvP9vYOlmAVA0HFxDk"
PLACE_ID            = "ChIJxaHg5TKz4IgR-o2Bu-pnfhc"
REVIEWS_CACHE_HOURS = 24

app = Flask(__name__)
CORS(app)

CATEGORY_MAP = {
    "One King":     ["King", "One Queen"],
    "Two Queen":    ["2 Queen"],
    "2 Double Bed": ["2 Full", "One Full"],
}

# ── DB helpers ────────────────────────────────────────────────────────────────

def get_con():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def setup_db():
    con = get_con()
    cur = con.cursor()

    cur.executescript("""
        CREATE TABLE IF NOT EXISTS rooms (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            room_number TEXT UNIQUE NOT NULL,
            room_type   TEXT NOT NULL,
            status      TEXT NOT NULL DEFAULT 'Available'
        );

        CREATE TABLE IF NOT EXISTS category_rates (
            id                   INTEGER PRIMARY KEY AUTOINCREMENT,
            category             TEXT UNIQUE NOT NULL,
            default_nightly_rate REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS price_overrides (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            date     TEXT NOT NULL,
            price    REAL NOT NULL,
            UNIQUE(category, date)
        );

        CREATE TABLE IF NOT EXISTS availability_overrides (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            category      TEXT NOT NULL,
            date          TEXT NOT NULL,
            rooms_to_sell INTEGER NOT NULL,
            UNIQUE(category, date)
        );

        CREATE TABLE IF NOT EXISTS bookings (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            reference_number TEXT,
            guest_name       TEXT NOT NULL,
            email            TEXT NOT NULL,
            phone            TEXT NOT NULL,
            category         TEXT NOT NULL,
            check_in_date    TEXT NOT NULL,
            check_out_date   TEXT NOT NULL,
            status           TEXT NOT NULL DEFAULT 'Pending',
            assigned_room_id INTEGER,
            total_price      REAL,
            created_at       TEXT,
            adults           INTEGER NOT NULL DEFAULT 1,
            kids             INTEGER NOT NULL DEFAULT 0,
            pets             INTEGER NOT NULL DEFAULT 0,
            special_requests TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS reviews_cache (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            author_name TEXT,
            rating      INTEGER,
            text        TEXT,
            time_ago    TEXT,
            cached_at   TEXT
        );
    """)

    # Seed rooms if empty
    count = cur.execute("SELECT COUNT(*) FROM rooms").fetchone()[0]
    if count == 0:
        rooms = [
            ("1","One Queen"),("2","One Queen"),("3","King"),("4","King"),("5","King"),
            ("6","One Full"),("7","2 Full"),("8","King"),("9","2 Queen"),("10","2 Queen"),
            ("11","2 Queen"),("12","King"),("14","2 Full"),("15","2 Full"),("16","King"),
            ("17","King"),("18","2 Queen"),("19","King"),("20","2 Queen"),("21","2 Queen"),
            ("22","2 Queen"),("24","2 Queen"),("25","2 Full"),("26","King"),("27","2 Queen"),
        ]
        cur.executemany("INSERT INTO rooms (room_number, room_type) VALUES (?,?)", rooms)
        print(f"  Seeded {len(rooms)} rooms.")

    # Seed default rates if empty
    count = cur.execute("SELECT COUNT(*) FROM category_rates").fetchone()[0]
    if count == 0:
        rates = [("One King", 89.0), ("Two Queen", 109.0), ("2 Double Bed", 99.0)]
        cur.executemany("INSERT INTO category_rates (category, default_nightly_rate) VALUES (?,?)", rates)
        print("  Seeded default nightly rates.")

    con.commit()
    con.close()


# ── Reference number ─────────────────────────────────────────────────────────

def gen_ref():
    chars = string.ascii_uppercase + string.digits
    suffix = ''.join(random.choices(chars, k=7))
    return f"TOM-{suffix}"


# ── Pricing helper ────────────────────────────────────────────────────────────

def nightly_prices(category, check_in, check_out):
    start = date.fromisoformat(check_in)
    end   = date.fromisoformat(check_out)
    con   = get_con()

    row = con.execute(
        "SELECT default_nightly_rate FROM category_rates WHERE category=?", (category,)
    ).fetchone()
    default = row["default_nightly_rate"] if row else 0.0

    overrides = {
        r["date"]: r["price"]
        for r in con.execute(
            "SELECT date, price FROM price_overrides WHERE category=? AND date>=? AND date<?",
            (category, check_in, check_out)
        ).fetchall()
    }
    con.close()

    nights, cur = [], start
    while cur < end:
        ds = cur.isoformat()
        nights.append({"date": ds, "price": overrides.get(ds, default)})
        cur += timedelta(days=1)
    return nights


def available_rooms(category, check_in, check_out):
    types = CATEGORY_MAP.get(category, [])
    placeholders = ",".join("?" * len(types))
    con = get_con()

    candidates = con.execute(
        f"SELECT * FROM rooms WHERE room_type IN ({placeholders}) AND status='Available'",
        types
    ).fetchall()

    result = []
    for room in candidates:
        overlap = con.execute("""
            SELECT 1 FROM bookings
            WHERE assigned_room_id=? AND status='Approved'
              AND check_in_date < ? AND check_out_date > ?
        """, (room["id"], check_out, check_in)).fetchone()
        if not overlap:
            result.append(dict(room))

    con.close()
    return result


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/api/availability")
def get_availability():
    check_in  = request.args.get("check_in")
    check_out = request.args.get("check_out")
    if not check_in or not check_out:
        return jsonify({"error": "check_in and check_out required"}), 400
    try:
        ci = date.fromisoformat(check_in)
        co = date.fromisoformat(check_out)
        if co <= ci:
            return jsonify({"error": "check_out must be after check_in"}), 400
    except ValueError:
        return jsonify({"error": "Invalid date format"}), 400

    con = get_con()
    results = []
    for category in ["One King", "Two Queen", "2 Double Bed"]:
        rooms  = available_rooms(category, check_in, check_out)
        nights = nightly_prices(category, check_in, check_out)
        total  = round(sum(n["price"] for n in nights), 2)

        # Apply rooms_to_sell cap from availability_overrides
        cur_d, caps = ci, []
        while cur_d < co:
            row = con.execute(
                "SELECT rooms_to_sell FROM availability_overrides WHERE category=? AND date=?",
                (category, cur_d.isoformat())
            ).fetchone()
            if row is not None:
                caps.append(row["rooms_to_sell"])
            cur_d += timedelta(days=1)
        cap = min(caps) if caps else len(rooms)
        available_count = min(len(rooms), cap)

        results.append({
            "category":        category,
            "available_count": available_count,
            "room_numbers":    sorted([r["room_number"] for r in rooms], key=lambda x: int(x)),
            "nightly_prices":  nights,
            "total_price":     total,
        })
    con.close()
    return jsonify(results)


@app.post("/api/bookings")
def create_booking():
    data = request.get_json()
    con  = get_con()
    cur  = con.cursor()
    cur.execute("""
        INSERT INTO bookings (reference_number, guest_name, email, phone, category,
            check_in_date, check_out_date, total_price, status, created_at,
            adults, kids, pets, special_requests)
        VALUES (?,?,?,?,?,?,?,?,'Pending',?,?,?,?,?)
    """, (
        gen_ref(),
        data["guest_name"], data["email"], data["phone"], data["category"],
        data["check_in_date"], data["check_out_date"], data.get("total_price"),
        datetime.now().isoformat(timespec="seconds"),
        data.get("adults", 1),
        data.get("kids", 0),
        1 if data.get("pets") else 0,
        data.get("special_requests", ""),
    ))
    con.commit()
    bid = cur.lastrowid
    ref = cur.execute("SELECT reference_number FROM bookings WHERE id=?", (bid,)).fetchone()["reference_number"]
    con.close()
    return jsonify({"message": "Booking received.", "booking_id": bid, "reference_number": ref}), 201


@app.get("/api/bookings")
def get_bookings():
    con = get_con()
    rows = con.execute("""
        SELECT b.*, r.room_number as assigned_room_number
        FROM bookings b
        LEFT JOIN rooms r ON b.assigned_room_id = r.id
    """).fetchall()
    con.close()
    return jsonify([dict(r) for r in rows])


@app.get("/api/rooms")
def get_rooms():
    con  = get_con()
    rows = con.execute("SELECT * FROM rooms ORDER BY CAST(room_number AS INTEGER)").fetchall()
    con.close()
    return jsonify([dict(r) for r in rows])


@app.get("/api/bookings/<int:bid>/available-rooms")
def get_available_rooms_for_booking(bid):
    con = get_con()
    b   = con.execute("SELECT * FROM bookings WHERE id=?", (bid,)).fetchone()
    if not b:
        con.close()
        return jsonify({"error": "Not found"}), 404
    rooms = available_rooms(b["category"], b["check_in_date"], b["check_out_date"])
    con.close()
    return jsonify([{"id": r["id"], "room_number": r["room_number"], "room_type": r["room_type"]} for r in rooms])


@app.patch("/api/bookings/<int:bid>/approve")
def approve_booking(bid):
    data        = request.get_json(silent=True) or {}
    room_number = data.get("room_number")
    con = get_con()
    b   = con.execute("SELECT * FROM bookings WHERE id=?", (bid,)).fetchone()
    if not b:
        con.close()
        return jsonify({"error": "Not found"}), 404

    if room_number:
        room_row = con.execute("SELECT * FROM rooms WHERE room_number=?", (room_number,)).fetchone()
        if not room_row:
            con.close()
            return jsonify({"error": f"Room {room_number} not found"}), 404
        overlap = con.execute("""
            SELECT 1 FROM bookings
            WHERE assigned_room_id=? AND status='Approved'
              AND check_in_date < ? AND check_out_date > ?
        """, (room_row["id"], b["check_out_date"], b["check_in_date"])).fetchone()
        if overlap:
            con.close()
            return jsonify({"error": f"Room {room_number} is not available for those dates"}), 400
        room = dict(room_row)
    else:
        rooms = available_rooms(b["category"], b["check_in_date"], b["check_out_date"])
        if not rooms:
            con.close()
            return jsonify({"error": "No available rooms for this category and dates"}), 400
        room = rooms[0]

    con.execute(
        "UPDATE bookings SET status='Approved', assigned_room_id=? WHERE id=?",
        (room["id"], bid)
    )
    con.commit()
    con.close()
    return jsonify({"message": f"Approved. Room {room['room_number']} assigned."})


@app.patch("/api/bookings/<int:bid>/reject")
def reject_booking(bid):
    con = get_con()
    con.execute("UPDATE bookings SET status='Rejected' WHERE id=?", (bid,))
    con.commit()
    con.close()
    return jsonify({"message": "Rejected."})


@app.get("/api/admin/pricing")
def get_pricing():
    con  = get_con()
    rows = con.execute("SELECT * FROM category_rates").fetchall()
    con.close()
    return jsonify([dict(r) for r in rows])


@app.patch("/api/admin/pricing/<path:category>")
def update_pricing(category):
    rate = request.get_json().get("default_nightly_rate")
    con  = get_con()
    con.execute(
        "UPDATE category_rates SET default_nightly_rate=? WHERE category=?",
        (rate, category)
    )
    con.commit()
    row = con.execute("SELECT * FROM category_rates WHERE category=?", (category,)).fetchone()
    con.close()
    return jsonify(dict(row))


@app.get("/api/admin/pricing/overrides")
def get_overrides():
    con  = get_con()
    rows = con.execute(
        "SELECT * FROM price_overrides ORDER BY category, date"
    ).fetchall()
    con.close()
    return jsonify([dict(r) for r in rows])


@app.post("/api/admin/pricing/overrides")
def create_override():
    data = request.get_json()
    con  = get_con()
    con.execute("""
        INSERT INTO price_overrides (category, date, price) VALUES (?,?,?)
        ON CONFLICT(category, date) DO UPDATE SET price=excluded.price
    """, (data["category"], data["date"], data["price"]))
    con.commit()
    row = con.execute(
        "SELECT * FROM price_overrides WHERE category=? AND date=?",
        (data["category"], data["date"])
    ).fetchone()
    con.close()
    return jsonify(dict(row)), 201


@app.delete("/api/admin/pricing/overrides/<int:oid>")
def delete_override(oid):
    con = get_con()
    con.execute("DELETE FROM price_overrides WHERE id=?", (oid,))
    con.commit()
    con.close()
    return jsonify({"message": "Deleted."})


# ── Calendar endpoints ────────────────────────────────────────────────────────

@app.get("/api/admin/calendar")
def get_calendar():
    start_str = request.args.get("start", date.today().isoformat())
    days_n    = int(request.args.get("days", 14))
    start_d   = date.fromisoformat(start_str)
    dates     = [start_d + timedelta(days=i) for i in range(days_n)]
    con       = get_con()

    result = []
    for category in ["One King", "Two Queen", "2 Double Bed"]:
        types = CATEGORY_MAP[category]
        placeholders = ",".join("?" * len(types))
        ph = con.execute(
            f"SELECT COUNT(*) FROM rooms WHERE room_type IN ({placeholders}) AND status='Available'",
            types
        ).fetchone()[0]

        rate_row = con.execute(
            "SELECT default_nightly_rate FROM category_rates WHERE category=?", (category,)
        ).fetchone()
        default_rate = rate_row["default_nightly_rate"] if rate_row else 0.0

        days_out = []
        for d in dates:
            ds = d.isoformat()
            ov = con.execute(
                "SELECT rooms_to_sell FROM availability_overrides WHERE category=? AND date=?",
                (category, ds)
            ).fetchone()
            pr = con.execute(
                "SELECT price FROM price_overrides WHERE category=? AND date=?",
                (category, ds)
            ).fetchone()
            rts   = ov["rooms_to_sell"] if ov else ph
            price = pr["price"] if pr else default_rate
            booked = con.execute("""
                SELECT COUNT(DISTINCT b.id) FROM bookings b
                WHERE b.category=? AND b.status='Approved'
                  AND b.check_in_date <= ? AND b.check_out_date > ?
            """, (category, ds, ds)).fetchone()[0]
            days_out.append({
                "date":          ds,
                "rooms_to_sell": rts,
                "price":         price,
                "net_booked":    booked,
                "net_available": max(0, rts - booked),
            })

        result.append({"category": category, "physical_rooms": ph, "days": days_out})

    con.close()
    return jsonify(result)


@app.post("/api/admin/calendar/bulk")
def bulk_calendar_update():
    data     = request.get_json()
    category = data["category"]
    dates    = data["dates"]
    rts      = data.get("rooms_to_sell")
    price    = data.get("price")
    con      = get_con()
    for d in dates:
        if rts is not None:
            con.execute("""
                INSERT INTO availability_overrides (category, date, rooms_to_sell) VALUES (?,?,?)
                ON CONFLICT(category, date) DO UPDATE SET rooms_to_sell=excluded.rooms_to_sell
            """, (category, d, rts))
        if price is not None:
            con.execute("""
                INSERT INTO price_overrides (category, date, price) VALUES (?,?,?)
                ON CONFLICT(category, date) DO UPDATE SET price=excluded.price
            """, (category, d, price))
    con.commit()
    con.close()
    return jsonify({"updated": len(dates)})


# ── Google Reviews ───────────────────────────────────────────────────────────

@app.get("/api/reviews")
def get_reviews():
    con = get_con()
    cutoff = (datetime.utcnow() - timedelta(hours=REVIEWS_CACHE_HOURS)).isoformat()
    fresh = con.execute(
        "SELECT * FROM reviews_cache WHERE cached_at > ? ORDER BY rating DESC",
        (cutoff,)
    ).fetchall()
    if fresh:
        con.close()
        return jsonify([dict(r) for r in fresh])

    if not GOOGLE_API_KEY or not PLACE_ID:
        con.close()
        return jsonify([])

    url = (
        f"https://maps.googleapis.com/maps/api/place/details/json"
        f"?place_id={PLACE_ID}&fields=reviews,rating,user_ratings_total&key={GOOGLE_API_KEY}"
    )
    try:
        with urllib.request.urlopen(url) as resp:
            data = json.loads(resp.read())
        google_reviews = data.get("result", {}).get("reviews", [])
        now = datetime.utcnow().isoformat()
        con.execute("DELETE FROM reviews_cache")
        for r in google_reviews:
            con.execute(
                "INSERT INTO reviews_cache (author_name, rating, text, time_ago, cached_at) VALUES (?,?,?,?,?)",
                (r["author_name"], r["rating"], r["text"], r.get("relative_time_description", ""), now)
            )
        con.commit()
        rows = con.execute("SELECT * FROM reviews_cache ORDER BY rating DESC").fetchall()
        con.close()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        con.close()
        return jsonify({"error": str(e)}), 500


# ── Start ─────────────────────────────────────────────────────────────────────

# Always run setup_db so gunicorn workers initialise the DB on startup
setup_db()

if __name__ == "__main__":
    print("Three Oaks Motel API running on http://localhost:8000")
    app.run(host="0.0.0.0", port=8000, debug=False)
