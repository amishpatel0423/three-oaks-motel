import os
import json
import random
import string
import urllib.request
from datetime import date, timedelta, datetime
from flask import Flask, jsonify, request
from flask_cors import CORS
import psycopg2
import psycopg2.extras

DATABASE_URL = os.environ.get("DATABASE_URL", "")

# ── Google Reviews config ─────────────────────────────────────────────────────
GOOGLE_API_KEY      = os.environ.get("GOOGLE_API_KEY", "AIzaSyBy7FZLlpJ0HrcIipvP9vYOlmAVA0HFxDk")
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
    con = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    return con


def setup_db():
    con = get_con()
    cur = con.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS rooms (
            id          SERIAL PRIMARY KEY,
            room_number TEXT UNIQUE NOT NULL,
            room_type   TEXT NOT NULL,
            status      TEXT NOT NULL DEFAULT 'Available'
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS category_rates (
            id                   SERIAL PRIMARY KEY,
            category             TEXT UNIQUE NOT NULL,
            default_nightly_rate REAL NOT NULL
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS price_overrides (
            id       SERIAL PRIMARY KEY,
            category TEXT NOT NULL,
            date     TEXT NOT NULL,
            price    REAL NOT NULL,
            UNIQUE(category, date)
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS availability_overrides (
            id            SERIAL PRIMARY KEY,
            category      TEXT NOT NULL,
            date          TEXT NOT NULL,
            rooms_to_sell INTEGER NOT NULL,
            UNIQUE(category, date)
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS bookings (
            id               SERIAL PRIMARY KEY,
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
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS reviews_cache (
            id          SERIAL PRIMARY KEY,
            author_name TEXT,
            rating      INTEGER,
            text        TEXT,
            time_ago    TEXT,
            cached_at   TEXT
        )
    """)

    # Seed rooms if empty
    cur.execute("SELECT COUNT(*) FROM rooms")
    if cur.fetchone()["count"] == 0:
        rooms = [
            ("1","One Queen"),("2","One Queen"),("3","King"),("4","King"),("5","King"),
            ("6","One Full"),("7","2 Full"),("8","King"),("9","2 Queen"),("10","2 Queen"),
            ("11","2 Queen"),("12","King"),("14","2 Full"),("15","2 Full"),("16","King"),
            ("17","King"),("18","2 Queen"),("19","King"),("20","2 Queen"),("21","2 Queen"),
            ("22","2 Queen"),("24","2 Queen"),("25","2 Full"),("26","King"),("27","2 Queen"),
        ]
        cur.executemany("INSERT INTO rooms (room_number, room_type) VALUES (%s, %s)", rooms)
        print(f"  Seeded {len(rooms)} rooms.")

    # Seed default rates if empty
    cur.execute("SELECT COUNT(*) FROM category_rates")
    if cur.fetchone()["count"] == 0:
        rates = [("One King", 89.0), ("Two Queen", 109.0), ("2 Double Bed", 99.0)]
        cur.executemany(
            "INSERT INTO category_rates (category, default_nightly_rate) VALUES (%s, %s)", rates
        )
        print("  Seeded default nightly rates.")

    con.commit()
    cur.close()
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
    cur   = con.cursor()

    cur.execute(
        "SELECT default_nightly_rate FROM category_rates WHERE category=%s", (category,)
    )
    row = cur.fetchone()
    default = row["default_nightly_rate"] if row else 0.0

    cur.execute(
        "SELECT date, price FROM price_overrides WHERE category=%s AND date>=%s AND date<%s",
        (category, check_in, check_out)
    )
    overrides = {r["date"]: r["price"] for r in cur.fetchall()}

    cur.close()
    con.close()

    nights, cur_d = [], start
    while cur_d < end:
        ds = cur_d.isoformat()
        nights.append({"date": ds, "price": overrides.get(ds, default)})
        cur_d += timedelta(days=1)
    return nights


def available_rooms(category, check_in, check_out):
    types = CATEGORY_MAP.get(category, [])
    con = get_con()
    cur = con.cursor()

    cur.execute(
        "SELECT * FROM rooms WHERE room_type = ANY(%s) AND status='Available'",
        (types,)
    )
    candidates = cur.fetchall()

    result = []
    for room in candidates:
        cur.execute("""
            SELECT 1 FROM bookings
            WHERE assigned_room_id=%s AND status='Approved'
              AND check_in_date < %s AND check_out_date > %s
        """, (room["id"], check_out, check_in))
        if not cur.fetchone():
            result.append(dict(room))

    cur.close()
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
    cur = con.cursor()
    results = []
    for category in ["One King", "Two Queen", "2 Double Bed"]:
        rooms  = available_rooms(category, check_in, check_out)
        nights = nightly_prices(category, check_in, check_out)
        total  = round(sum(n["price"] for n in nights), 2)

        cur_d, caps = ci, []
        while cur_d < co:
            cur.execute(
                "SELECT rooms_to_sell FROM availability_overrides WHERE category=%s AND date=%s",
                (category, cur_d.isoformat())
            )
            row = cur.fetchone()
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
    cur.close()
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
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'Pending',%s,%s,%s,%s,%s)
        RETURNING id, reference_number
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
    row = cur.fetchone()
    con.commit()
    cur.close()
    con.close()
    return jsonify({"message": "Booking received.", "booking_id": row["id"], "reference_number": row["reference_number"]}), 201


@app.get("/api/bookings")
def get_bookings():
    con = get_con()
    cur = con.cursor()
    cur.execute("""
        SELECT b.*, r.room_number as assigned_room_number
        FROM bookings b
        LEFT JOIN rooms r ON b.assigned_room_id = r.id
    """)
    rows = cur.fetchall()
    cur.close()
    con.close()
    return jsonify([dict(r) for r in rows])


@app.get("/api/rooms")
def get_rooms():
    con = get_con()
    cur = con.cursor()
    cur.execute("SELECT * FROM rooms ORDER BY CAST(room_number AS INTEGER)")
    rows = cur.fetchall()
    cur.close()
    con.close()
    return jsonify([dict(r) for r in rows])


@app.get("/api/bookings/<int:bid>/available-rooms")
def get_available_rooms_for_booking(bid):
    con = get_con()
    cur = con.cursor()
    cur.execute("SELECT * FROM bookings WHERE id=%s", (bid,))
    b = cur.fetchone()
    cur.close()
    con.close()
    if not b:
        return jsonify({"error": "Not found"}), 404
    rooms = available_rooms(b["category"], b["check_in_date"], b["check_out_date"])
    return jsonify([{"id": r["id"], "room_number": r["room_number"], "room_type": r["room_type"]} for r in rooms])


@app.patch("/api/bookings/<int:bid>/approve")
def approve_booking(bid):
    data        = request.get_json(silent=True) or {}
    room_number = data.get("room_number")
    con = get_con()
    cur = con.cursor()
    cur.execute("SELECT * FROM bookings WHERE id=%s", (bid,))
    b = cur.fetchone()
    if not b:
        cur.close(); con.close()
        return jsonify({"error": "Not found"}), 404

    if room_number:
        cur.execute("SELECT * FROM rooms WHERE room_number=%s", (room_number,))
        room_row = cur.fetchone()
        if not room_row:
            cur.close(); con.close()
            return jsonify({"error": f"Room {room_number} not found"}), 404
        cur.execute("""
            SELECT 1 FROM bookings
            WHERE assigned_room_id=%s AND status='Approved'
              AND check_in_date < %s AND check_out_date > %s
        """, (room_row["id"], b["check_out_date"], b["check_in_date"]))
        if cur.fetchone():
            cur.close(); con.close()
            return jsonify({"error": f"Room {room_number} is not available for those dates"}), 400
        room = dict(room_row)
    else:
        rooms = available_rooms(b["category"], b["check_in_date"], b["check_out_date"])
        if not rooms:
            cur.close(); con.close()
            return jsonify({"error": "No available rooms for this category and dates"}), 400
        room = rooms[0]

    cur.execute(
        "UPDATE bookings SET status='Approved', assigned_room_id=%s WHERE id=%s",
        (room["id"], bid)
    )
    con.commit()
    cur.close()
    con.close()
    return jsonify({"message": f"Approved. Room {room['room_number']} assigned."})


@app.patch("/api/bookings/<int:bid>/reject")
def reject_booking(bid):
    con = get_con()
    cur = con.cursor()
    cur.execute("UPDATE bookings SET status='Rejected' WHERE id=%s", (bid,))
    con.commit()
    cur.close()
    con.close()
    return jsonify({"message": "Rejected."})


@app.get("/api/admin/pricing")
def get_pricing():
    con = get_con()
    cur = con.cursor()
    cur.execute("SELECT * FROM category_rates")
    rows = cur.fetchall()
    cur.close()
    con.close()
    return jsonify([dict(r) for r in rows])


@app.patch("/api/admin/pricing/<path:category>")
def update_pricing(category):
    rate = request.get_json().get("default_nightly_rate")
    con  = get_con()
    cur  = con.cursor()
    cur.execute(
        "UPDATE category_rates SET default_nightly_rate=%s WHERE category=%s RETURNING *",
        (rate, category)
    )
    row = cur.fetchone()
    con.commit()
    cur.close()
    con.close()
    return jsonify(dict(row))


@app.get("/api/admin/pricing/overrides")
def get_overrides():
    con = get_con()
    cur = con.cursor()
    cur.execute("SELECT * FROM price_overrides ORDER BY category, date")
    rows = cur.fetchall()
    cur.close()
    con.close()
    return jsonify([dict(r) for r in rows])


@app.post("/api/admin/pricing/overrides")
def create_override():
    data = request.get_json()
    con  = get_con()
    cur  = con.cursor()
    cur.execute("""
        INSERT INTO price_overrides (category, date, price) VALUES (%s, %s, %s)
        ON CONFLICT(category, date) DO UPDATE SET price=EXCLUDED.price
        RETURNING *
    """, (data["category"], data["date"], data["price"]))
    row = cur.fetchone()
    con.commit()
    cur.close()
    con.close()
    return jsonify(dict(row)), 201


@app.delete("/api/admin/pricing/overrides/<int:oid>")
def delete_override(oid):
    con = get_con()
    cur = con.cursor()
    cur.execute("DELETE FROM price_overrides WHERE id=%s", (oid,))
    con.commit()
    cur.close()
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
    cur       = con.cursor()

    result = []
    for category in ["One King", "Two Queen", "2 Double Bed"]:
        types = CATEGORY_MAP[category]
        cur.execute(
            "SELECT COUNT(*) FROM rooms WHERE room_type = ANY(%s) AND status='Available'",
            (types,)
        )
        ph = cur.fetchone()["count"]

        cur.execute(
            "SELECT default_nightly_rate FROM category_rates WHERE category=%s", (category,)
        )
        rate_row = cur.fetchone()
        default_rate = rate_row["default_nightly_rate"] if rate_row else 0.0

        days_out = []
        for d in dates:
            ds = d.isoformat()
            cur.execute(
                "SELECT rooms_to_sell FROM availability_overrides WHERE category=%s AND date=%s",
                (category, ds)
            )
            ov = cur.fetchone()
            cur.execute(
                "SELECT price FROM price_overrides WHERE category=%s AND date=%s",
                (category, ds)
            )
            pr = cur.fetchone()
            rts   = ov["rooms_to_sell"] if ov else ph
            price = pr["price"] if pr else default_rate
            cur.execute("""
                SELECT COUNT(DISTINCT b.id) FROM bookings b
                WHERE b.category=%s AND b.status='Approved'
                  AND b.check_in_date <= %s AND b.check_out_date > %s
            """, (category, ds, ds))
            booked = cur.fetchone()["count"]
            days_out.append({
                "date":          ds,
                "rooms_to_sell": rts,
                "price":         price,
                "net_booked":    booked,
                "net_available": max(0, rts - booked),
            })

        result.append({"category": category, "physical_rooms": ph, "days": days_out})

    cur.close()
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
    cur      = con.cursor()
    for d in dates:
        if rts is not None:
            cur.execute("""
                INSERT INTO availability_overrides (category, date, rooms_to_sell) VALUES (%s, %s, %s)
                ON CONFLICT(category, date) DO UPDATE SET rooms_to_sell=EXCLUDED.rooms_to_sell
            """, (category, d, rts))
        if price is not None:
            cur.execute("""
                INSERT INTO price_overrides (category, date, price) VALUES (%s, %s, %s)
                ON CONFLICT(category, date) DO UPDATE SET price=EXCLUDED.price
            """, (category, d, price))
    con.commit()
    cur.close()
    con.close()
    return jsonify({"updated": len(dates)})


# ── Google Reviews ────────────────────────────────────────────────────────────

@app.get("/api/reviews")
def get_reviews():
    con = get_con()
    cur = con.cursor()
    cutoff = (datetime.utcnow() - timedelta(hours=REVIEWS_CACHE_HOURS)).isoformat()
    cur.execute(
        "SELECT * FROM reviews_cache WHERE cached_at > %s ORDER BY rating DESC", (cutoff,)
    )
    fresh = cur.fetchall()
    if fresh:
        cur.close(); con.close()
        return jsonify([dict(r) for r in fresh])

    if not GOOGLE_API_KEY or not PLACE_ID:
        cur.close(); con.close()
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
        cur.execute("DELETE FROM reviews_cache")
        for r in google_reviews:
            cur.execute(
                "INSERT INTO reviews_cache (author_name, rating, text, time_ago, cached_at) VALUES (%s,%s,%s,%s,%s)",
                (r["author_name"], r["rating"], r["text"], r.get("relative_time_description", ""), now)
            )
        con.commit()
        cur.execute("SELECT * FROM reviews_cache ORDER BY rating DESC")
        rows = cur.fetchall()
        cur.close(); con.close()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        cur.close(); con.close()
        return jsonify({"error": str(e)}), 500


# ── Health check ─────────────────────────────────────────────────────────────

@app.get("/")
@app.get("/health")
def health():
    if not DATABASE_URL:
        return jsonify({"status": "error", "message": "DATABASE_URL not set"}), 500
    try:
        con = get_con()
        con.close()
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# ── Start ─────────────────────────────────────────────────────────────────────

# Run setup on startup (gunicorn workers will each call this — safe due to IF NOT EXISTS)
if DATABASE_URL:
    try:
        setup_db()
    except Exception as e:
        print(f"WARNING: setup_db() failed: {e}")

if __name__ == "__main__":
    if not DATABASE_URL:
        print("WARNING: DATABASE_URL not set. Set it to your Postgres connection string.")
    else:
        setup_db()
    print("Three Oaks Motel API running on http://localhost:8000")
    app.run(host="0.0.0.0", port=8000, debug=False)
