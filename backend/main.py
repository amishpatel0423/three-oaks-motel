import io
import os
import json
import random
import secrets
import string
import threading
import urllib.request
import urllib.error
from datetime import date, timedelta, datetime
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
import psycopg2
import psycopg2.extras
import openpyxl

DATABASE_URL    = os.environ.get("DATABASE_URL", "")
RESEND_API_KEY  = os.environ.get("RESEND_API_KEY", "")
ADMIN_EMAIL     = "amishpatel0423@gmail.com"

# ── Google Reviews config ─────────────────────────────────────────────────────
GOOGLE_API_KEY      = os.environ.get("GOOGLE_API_KEY", "AIzaSyBy7FZLlpJ0HrcIipvP9vYOlmAVA0HFxDk")
PLACE_ID            = "ChIJxaHg5TKz4IgR-o2Bu-pnfhc"
REVIEWS_CACHE_HOURS = 24

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=False)

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

    cur.execute("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancel_token TEXT")

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

    cur.execute("""
        CREATE TABLE IF NOT EXISTS site_content (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL DEFAULT ''
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS gallery_photos (
            id         SERIAL PRIMARY KEY,
            url        TEXT NOT NULL,
            caption    TEXT NOT NULL DEFAULT '',
            sort_order INTEGER NOT NULL DEFAULT 0
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS room_photos (
            id         SERIAL PRIMARY KEY,
            category   TEXT NOT NULL,
            url        TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0
        )
    """)

    # Seed site_content with default about text and amenities
    cur.execute("SELECT COUNT(*) FROM site_content")
    if cur.fetchone()["count"] == 0:
        about_text = (
            "Welcome to the Three Oaks Motel, your premier Florida Coastal retreat. "
            "Perfectly positioned just minutes away from the legendary Kennedy Space Center, "
            "we offer a peaceful and comfortable stay for space enthusiasts, families, and beachgoers alike.\n\n"
            "Experience authentic local hospitality with modern conveniences designed to make your mission a success. "
            "Whether you're here to catch a launch or enjoy the sun, we're ready to host you."
        )
        amenities_list = json.dumps([
            "Non-smoking rooms", "Free Wifi", "Free parking", "Room service",
            "CCTV outside", "24-hour front desk", "Smoke-free property",
            "Air conditioning", "Heating", "24-hour security", "Smoke alarms",
            "Daily housekeeping", "Fire extinguishers", "Key card access",
            "Non-pet friendly", "Patio"
        ])
        cur.execute("INSERT INTO site_content (key, value) VALUES (%s,%s)", ("about", about_text))
        cur.execute("INSERT INTO site_content (key, value) VALUES (%s,%s)", ("amenities", amenities_list))
        print("  Seeded default site content.")

    # Seed gallery_photos with existing local images
    cur.execute("SELECT COUNT(*) FROM gallery_photos")
    if cur.fetchone()["count"] == 0:
        gallery_files = [
            "20230304_124651.jpg","20230304_124703.jpg","20230304_124750.jpg",
            "20230304_124805.jpg","20230304_124808.jpg","20230304_124822.jpg",
            "20230304_124838.jpg","20230304_124901.jpg","20230304_124914.jpg",
            "20230304_124938.jpg","20230304_125041.jpg","20230304_125110.jpg",
            "20230304_125125.jpg","20230729_155010.jpg","20230729_155048.jpg",
            "20230729_155114.jpg","20230729_155145.jpg","20230729_155208.jpg",
            "20230729_155235.jpg","20230729_155248.jpg","20230729_155300.jpg",
            "20230729_155335.jpg","20230729_155421.jpg","20230729_155429.jpg",
            "20230729_155447.jpg","20230729_155522.jpg","20230729_155536.jpg",
            "20230729_155539.jpg","20230729_155543.jpg","20230729_155546.jpg",
            "20230729_155920.jpg","20230729_155951.jpg","20230729_160023.jpg",
            "20230729_160044.jpg","20230729_160053.jpg","20230729_160055.jpg",
            "20230729_160108.jpg","20230729_160119.jpg","20230729_160135.jpg",
            "20230729_160146.jpg","20230729_160203.jpg",
        ]
        for i, fname in enumerate(gallery_files):
            cur.execute(
                "INSERT INTO gallery_photos (url, caption, sort_order) VALUES (%s,%s,%s)",
                (f"/images/gallery/{fname}", "", i)
            )
        print(f"  Seeded {len(gallery_files)} gallery photos.")

    # Seed room_photos with existing local images
    cur.execute("SELECT COUNT(*) FROM room_photos")
    if cur.fetchone()["count"] == 0:
        room_defaults = [
            ("One King",     "/images/one-king.jpg"),
            ("Two Queen",    "/images/two-queen.jpg"),
            ("2 Double Bed", "/images/two-double.jpg"),
        ]
        for i, (cat, url) in enumerate(room_defaults):
            cur.execute(
                "INSERT INTO room_photos (category, url, sort_order) VALUES (%s,%s,%s)",
                (cat, url, i)
            )
        print("  Seeded default room photos.")

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


# ── Email helpers ─────────────────────────────────────────────────────────────

def send_email(to: str, subject: str, html: str):
    if not RESEND_API_KEY:
        print("RESEND_API_KEY not set — skipping email.")
        return
    try:
        payload = json.dumps({
            "from": "Three Oaks Motel <onboarding@resend.dev>",
            "to": [to],
            "subject": subject,
            "html": html,
        }).encode()
        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=payload,
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
        )
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
        print(f"Email sent to {to} via Resend: {result}")
    except Exception as e:
        print(f"Email error ({to}): {e}")


@app.get("/api/admin/test-email")
def test_email():
    if not RESEND_API_KEY:
        return jsonify({"error": "RESEND_API_KEY env var not set on Render."}), 500
    try:
        payload = json.dumps({
            "from": "Three Oaks Motel <onboarding@resend.dev>",
            "to": [ADMIN_EMAIL],
            "subject": "Three Oaks Motel — Email Test",
            "html": "<p>Test email from Three Oaks Motel backend. Email is working!</p>",
        }).encode()
        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=payload,
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
        )
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
        return jsonify({"status": "sent", "to": ADMIN_EMAIL, "resend_id": result.get("id")})
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        return jsonify({"http_status": e.code, "error": body, "key_prefix": RESEND_API_KEY[:6] + "..."}), 500
    except Exception as e:
        return jsonify({"error": str(e), "key_prefix": RESEND_API_KEY[:6] + "..."}), 500


def fmt_date(iso: str) -> str:
    months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    y, m, d = iso.split("-")
    return f"{months[int(m)-1]} {int(d)}, {y}"


SITE_URL = "https://three-oaks-motel.vercel.app"


def _cancel_link_html(cancel_token: str) -> str:
    if not cancel_token:
        return ""
    url = f"{SITE_URL}/cancel?token={cancel_token}"
    return f"""
          <div style="text-align:center;margin-bottom:20px;">
            <a href="{url}" style="display:inline-block;background:#f8fafc;color:#64748b;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;border:1px solid #e2e8f0;">
              Need to cancel? Click here → <span style="color:#dc2626;font-weight:600;">Cancel Reservation</span>
            </a>
            <p style="margin:6px 0 0;color:#94a3b8;font-size:11px;">Cancellation is only available more than 24 hours before check-in.</p>
          </div>"""


def send_booking_emails(d: dict):
    ref   = d["reference_number"]
    name  = d["guest_name"]
    ci    = fmt_date(d["check_in_date"])
    co    = fmt_date(d["check_out_date"])
    total = f"${d['total_price']:.2f}" if d.get("total_price") is not None else "TBD"
    cat   = d["category"]
    sr    = d.get("special_requests") or "None"
    cancel_html = _cancel_link_html(d.get("cancel_token", ""))

    # ── Guest confirmation ────────────────────────────────────────────────────
    guest_html = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f0f8ff;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f8ff;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr><td style="background:#006994;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Three Oaks Motel</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">707 S. Hopkins Ave, Titusville, FL 32780</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:40px 40px 32px;">
          <p style="margin:0 0 6px;color:#64748b;font-size:13px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Booking Received</p>
          <h2 style="margin:0 0 24px;color:#0f172a;font-size:28px;font-weight:800;">Hi {name},</h2>
          <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
            Thank you for choosing Three Oaks Motel. Your booking request has been received and is pending confirmation. We'll be in touch shortly.
          </p>

          <!-- Reference -->
          <div style="background:#f0f8ff;border:2px solid #006994;border-radius:12px;padding:20px 24px;margin-bottom:28px;text-align:center;">
            <p style="margin:0 0 4px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;">Your Reference Number</p>
            <p style="margin:0;color:#006994;font-size:28px;font-weight:900;font-family:monospace;letter-spacing:2px;">{ref}</p>
          </div>

          <!-- Summary -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;overflow:hidden;margin-bottom:28px;">
            <tr><td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;">
              <span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Room</span><br>
              <span style="color:#0f172a;font-size:15px;font-weight:600;">{cat}</span>
            </td></tr>
            <tr><td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;">
              <span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Check-in</span><br>
              <span style="color:#0f172a;font-size:15px;font-weight:600;">{ci} <span style="color:#64748b;font-weight:400;">from 2:00 PM</span></span>
            </td></tr>
            <tr><td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;">
              <span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Check-out</span><br>
              <span style="color:#0f172a;font-size:15px;font-weight:600;">{co} <span style="color:#64748b;font-weight:400;">by 11:00 AM</span></span>
            </td></tr>
            <tr><td style="padding:16px 20px;">
              <span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Estimated Total</span><br>
              <span style="color:#006994;font-size:18px;font-weight:800;">{total}</span>
            </td></tr>
          </table>

          {cancel_html}

          <div style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:14px 18px;margin-bottom:28px;">
            <p style="margin:0;color:#92400e;font-size:13px;line-height:1.6;">
              <strong>Note:</strong> A deposit is required at check-in. Your booking is pending — we will call or email to confirm.
            </p>
          </div>

          <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">
            Questions? Call us at <a href="tel:3212676272" style="color:#006994;font-weight:600;">(321) 267-6272</a> or email
            <a href="mailto:threeoaksmotel707@gmail.com" style="color:#006994;font-weight:600;">threeoaksmotel707@gmail.com</a>.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">© {datetime.now().year} Three Oaks Motel · 707 S. Hopkins Ave, Titusville, FL 32780</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""

    # ── Admin notification ────────────────────────────────────────────────────
    adults = d.get("adults", 1)
    kids   = d.get("kids", 0)
    admin_html = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f0f8ff;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f8ff;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <tr><td style="background:#0f172a;padding:24px 32px;">
          <h2 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">New Booking Request</h2>
          <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">Three Oaks Motel · Admin Notification</p>
        </td></tr>

        <tr><td style="padding:32px;">

          <div style="background:#f0f8ff;border:2px solid #006994;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
            <p style="margin:0 0 2px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;">Reference</p>
            <p style="margin:0;color:#006994;font-size:22px;font-weight:900;font-family:monospace;">{ref}</p>
          </div>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
            <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;width:40%;">
              <span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Guest</span>
            </td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
              <span style="color:#0f172a;font-size:14px;font-weight:600;">{name}</span>
            </td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
              <span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Email</span>
            </td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
              <a href="mailto:{d['email']}" style="color:#006994;font-size:14px;">{d['email']}</a>
            </td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
              <span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Phone</span>
            </td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
              <a href="tel:{d['phone']}" style="color:#006994;font-size:14px;">{d['phone']}</a>
            </td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
              <span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Room</span>
            </td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
              <span style="color:#0f172a;font-size:14px;font-weight:600;">{cat}</span>
            </td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
              <span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Check-in</span>
            </td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
              <span style="color:#0f172a;font-size:14px;">{ci}</span>
            </td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
              <span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Check-out</span>
            </td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
              <span style="color:#0f172a;font-size:14px;">{co}</span>
            </td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
              <span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Total</span>
            </td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
              <span style="color:#006994;font-size:14px;font-weight:700;">{total}</span>
            </td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
              <span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Guests</span>
            </td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
              <span style="color:#0f172a;font-size:14px;">{adults} adult{'s' if adults != 1 else ''}{f', {kids} child' + ('ren' if kids != 1 else '') if kids else ''}</span>
            </td></tr>
            <tr><td style="padding:8px 0;">
              <span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Special Requests</span>
            </td><td style="padding:8px 0;">
              <span style="color:#0f172a;font-size:14px;font-style:italic;">{sr}</span>
            </td></tr>
          </table>

          <a href="https://three-oaks-motel.vercel.app/admin" style="display:inline-block;background:#006994;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:700;">
            View Admin Dashboard →
          </a>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    send_email(
        d["email"],
        f"Booking Received — Three Oaks Motel | Ref: {ref}",
        guest_html,
    )
    send_email(
        ADMIN_EMAIL,
        f"New Booking Request — {ref}",
        admin_html,
    )


def send_approval_email(b: dict):
    ref          = b["reference_number"]
    name         = b["guest_name"]
    ci           = fmt_date(b["check_in_date"])
    co           = fmt_date(b["check_out_date"])
    total        = f"${b['total_price']:.2f}" if b.get("total_price") is not None else "TBD"
    room_num     = b.get("room_number", "")
    cancel_html  = _cancel_link_html(b.get("cancel_token", ""))
    room_line    = f"Room <strong>{room_num}</strong> — {b['category']}" if room_num else b["category"]

    html = f"""
<!DOCTYPE html><html>
<body style="margin:0;padding:0;background:#f0f8ff;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f8ff;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:#16a34a;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Booking Confirmed!</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Three Oaks Motel · 707 S. Hopkins Ave, Titusville, FL 32780</p>
        </td></tr>
        <tr><td style="padding:40px 40px 32px;">
          <h2 style="margin:0 0 16px;color:#0f172a;font-size:24px;">Hi {name},</h2>
          <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">Great news — your reservation has been confirmed. We look forward to welcoming you!</p>
          <div style="background:#f0f8ff;border:2px solid #16a34a;border-radius:12px;padding:20px 24px;margin-bottom:28px;text-align:center;">
            <p style="margin:0 0 4px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;">Reference Number</p>
            <p style="margin:0;color:#16a34a;font-size:28px;font-weight:900;font-family:monospace;letter-spacing:2px;">{ref}</p>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;margin-bottom:28px;">
            <tr><td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;">
              <span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Room</span><br>
              <span style="color:#0f172a;font-size:15px;font-weight:600;">{room_line}</span>
            </td></tr>
            <tr><td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;">
              <span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Check-in</span><br>
              <span style="color:#0f172a;font-size:15px;font-weight:600;">{ci} <span style="color:#64748b;font-weight:400;">from 2:00 PM</span></span>
            </td></tr>
            <tr><td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;">
              <span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Check-out</span><br>
              <span style="color:#0f172a;font-size:15px;font-weight:600;">{co} <span style="color:#64748b;font-weight:400;">by 11:00 AM</span></span>
            </td></tr>
            <tr><td style="padding:16px 20px;">
              <span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Total</span><br>
              <span style="color:#16a34a;font-size:18px;font-weight:800;">{total}</span>
            </td></tr>
          </table>
          <div style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:14px 18px;margin-bottom:24px;">
            <p style="margin:0;color:#92400e;font-size:13px;">A deposit is required at check-in. Please call <a href="tel:3212676272" style="color:#92400e;">(321) 267-6272</a> with any questions.</p>
          </div>
          {cancel_html}
        </td></tr>
        <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">© {datetime.now().year} Three Oaks Motel</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""
    send_email(b["email"], f"Booking Confirmed — Three Oaks Motel | Ref: {ref}", html)


def send_rejection_email(b: dict):
    ref  = b["reference_number"]
    name = b["guest_name"]
    html = f"""
<!DOCTYPE html><html>
<body style="margin:0;padding:0;background:#f0f8ff;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f8ff;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:#006994;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Three Oaks Motel</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Booking Update · Ref: {ref}</p>
        </td></tr>
        <tr><td style="padding:40px 40px 32px;">
          <h2 style="margin:0 0 16px;color:#0f172a;font-size:22px;">Hi {name},</h2>
          <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
            Thank you for your interest in staying with us. Unfortunately, we were unable to accommodate your booking request at this time.
          </p>
          <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
            We apologize for any inconvenience. Please don't hesitate to contact us directly — we'd love to help find an alternative arrangement.
          </p>
          <div style="text-align:center;margin-bottom:24px;">
            <a href="tel:3212676272" style="display:inline-block;background:#006994;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;">
              Call Us: (321) 267-6272
            </a>
          </div>
          <p style="margin:0;color:#64748b;font-size:13px;text-align:center;">
            Or email us at <a href="mailto:threeoaksmotel707@gmail.com" style="color:#006994;">threeoaksmotel707@gmail.com</a>
          </p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">© {datetime.now().year} Three Oaks Motel · 707 S. Hopkins Ave, Titusville, FL 32780</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""
    send_email(b["email"], f"Booking Update — Three Oaks Motel | Ref: {ref}", html)


def send_cancellation_emails(b: dict):
    ref  = b["reference_number"]
    name = b["guest_name"]
    ci   = fmt_date(b["check_in_date"])
    co   = fmt_date(b["check_out_date"])
    cat  = b["category"]

    guest_html = f"""
<!DOCTYPE html><html>
<body style="margin:0;padding:0;background:#f0f8ff;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f8ff;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:#64748b;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Reservation Cancelled</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Three Oaks Motel · Ref: {ref}</p>
        </td></tr>
        <tr><td style="padding:40px 40px 32px;">
          <h2 style="margin:0 0 16px;color:#0f172a;font-size:22px;">Hi {name},</h2>
          <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
            Your reservation has been successfully cancelled. We're sorry to see you go!
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;margin-bottom:28px;">
            <tr><td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
              <span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Reference</span><br>
              <span style="color:#0f172a;font-size:14px;font-family:monospace;font-weight:700;">{ref}</span>
            </td></tr>
            <tr><td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
              <span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Room</span><br>
              <span style="color:#0f172a;font-size:14px;">{cat}</span>
            </td></tr>
            <tr><td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
              <span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Check-in</span><br>
              <span style="color:#0f172a;font-size:14px;">{ci}</span>
            </td></tr>
            <tr><td style="padding:14px 20px;">
              <span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Check-out</span><br>
              <span style="color:#0f172a;font-size:14px;">{co}</span>
            </td></tr>
          </table>
          <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">
            We hope to welcome you in the future. Call us anytime at
            <a href="tel:3212676272" style="color:#006994;font-weight:600;">(321) 267-6272</a>.
          </p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">© {datetime.now().year} Three Oaks Motel</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""

    admin_html = f"""
<!DOCTYPE html><html>
<body style="margin:0;padding:0;background:#f0f8ff;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f8ff;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:#dc2626;padding:24px 32px;">
          <h2 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">Guest Cancelled — {ref}</h2>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 12px;color:#475569;"><strong>{name}</strong> cancelled their reservation.</p>
          <p style="margin:0 0 4px;color:#64748b;font-size:13px;">Room: {cat} · {ci} → {co}</p>
          <p style="margin:16px 0 0;">
            <a href="{SITE_URL}/admin" style="display:inline-block;background:#006994;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:700;">View Admin Dashboard →</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""

    send_email(b["email"], f"Reservation Cancelled — Three Oaks Motel | Ref: {ref}", guest_html)
    send_email(ADMIN_EMAIL, f"Guest Cancelled — {ref}", admin_html)


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
    data         = request.get_json()
    cancel_token = secrets.token_urlsafe(32)
    con  = get_con()
    cur  = con.cursor()
    cur.execute("""
        INSERT INTO bookings (reference_number, guest_name, email, phone, category,
            check_in_date, check_out_date, total_price, status, created_at,
            adults, kids, pets, special_requests, cancel_token)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'Pending',%s,%s,%s,%s,%s,%s)
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
        cancel_token,
    ))
    row = cur.fetchone()
    con.commit()
    cur.close()
    con.close()

    booking_data = {
        "reference_number": row["reference_number"],
        "guest_name":       data["guest_name"],
        "email":            data["email"],
        "phone":            data["phone"],
        "category":         data["category"],
        "check_in_date":    data["check_in_date"],
        "check_out_date":   data["check_out_date"],
        "total_price":      data.get("total_price"),
        "adults":           data.get("adults", 1),
        "kids":             data.get("kids", 0),
        "special_requests": data.get("special_requests", ""),
        "cancel_token":     cancel_token,
    }
    threading.Thread(target=send_booking_emails, args=(booking_data,), daemon=True).start()

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

    approval_data = {**dict(b), "room_number": room["room_number"]}
    threading.Thread(target=send_approval_email, args=(approval_data,), daemon=True).start()

    return jsonify({"message": f"Approved. Room {room['room_number']} assigned."})


@app.patch("/api/bookings/<int:bid>/reject")
def reject_booking(bid):
    con = get_con()
    cur = con.cursor()
    cur.execute("SELECT * FROM bookings WHERE id=%s", (bid,))
    b = cur.fetchone()
    cur.execute("UPDATE bookings SET status='Rejected' WHERE id=%s", (bid,))
    con.commit()
    cur.close()
    con.close()
    if b:
        threading.Thread(target=send_rejection_email, args=(dict(b),), daemon=True).start()
    return jsonify({"message": "Rejected."})


# ── Guest cancellation ────────────────────────────────────────────────────────

def _can_cancel(check_in_date: str) -> bool:
    ci = datetime.fromisoformat(check_in_date + "T14:00:00")
    return (ci - datetime.now()) > timedelta(hours=24)


@app.get("/api/bookings/cancel/<token>")
def get_cancel_info(token):
    con = get_con()
    cur = con.cursor()
    cur.execute("SELECT * FROM bookings WHERE cancel_token=%s", (token,))
    b = cur.fetchone()
    cur.close(); con.close()
    if not b:
        return jsonify({"error": "Invalid or expired cancellation link."}), 404
    if b["status"] == "Cancelled":
        return jsonify({"error": "This reservation has already been cancelled."}), 409
    if b["status"] == "Rejected":
        return jsonify({"error": "This reservation was not confirmed."}), 409
    can = _can_cancel(b["check_in_date"])
    return jsonify({
        "reference_number": b["reference_number"],
        "guest_name":       b["guest_name"],
        "category":         b["category"],
        "check_in_date":    b["check_in_date"],
        "check_out_date":   b["check_out_date"],
        "total_price":      b["total_price"],
        "status":           b["status"],
        "can_cancel":       can,
    })


@app.post("/api/bookings/cancel/<token>")
def do_cancel(token):
    con = get_con()
    cur = con.cursor()
    cur.execute("SELECT * FROM bookings WHERE cancel_token=%s", (token,))
    b = cur.fetchone()
    if not b:
        cur.close(); con.close()
        return jsonify({"error": "Invalid or expired cancellation link."}), 404
    if b["status"] not in ("Pending", "Approved"):
        cur.close(); con.close()
        return jsonify({"error": f"Cannot cancel a booking with status '{b['status']}'."}), 409
    if not _can_cancel(b["check_in_date"]):
        cur.close(); con.close()
        return jsonify({"error": "Cancellation window has passed (within 24 hours of check-in). Please call (321) 267-6272."}), 400
    cur.execute("UPDATE bookings SET status='Cancelled' WHERE id=%s", (b["id"],))
    con.commit()
    cur.close(); con.close()
    threading.Thread(target=send_cancellation_emails, args=(dict(b),), daemon=True).start()
    return jsonify({"message": "Reservation cancelled successfully."})


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


# ── Site content ─────────────────────────────────────────────────────────────

@app.get("/api/content")
def get_content():
    con = get_con()
    cur = con.cursor()
    cur.execute("SELECT key, value FROM site_content")
    rows = {r["key"]: r["value"] for r in cur.fetchall()}
    cur.close(); con.close()
    return jsonify(rows)


@app.put("/api/admin/content")
def update_content():
    data = request.get_json()
    con  = get_con()
    cur  = con.cursor()
    for key, value in data.items():
        cur.execute("""
            INSERT INTO site_content (key, value) VALUES (%s, %s)
            ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value
        """, (key, value if isinstance(value, str) else json.dumps(value)))
    con.commit()
    cur.close(); con.close()
    return jsonify({"message": "Content updated."})


# ── Gallery photos ────────────────────────────────────────────────────────────

@app.get("/api/gallery")
@app.get("/api/admin/gallery")
def get_gallery():
    con = get_con()
    cur = con.cursor()
    cur.execute("SELECT * FROM gallery_photos ORDER BY sort_order, id")
    rows = cur.fetchall()
    cur.close(); con.close()
    return jsonify([dict(r) for r in rows])


@app.post("/api/admin/gallery")
def add_gallery_photo():
    data = request.get_json()
    con  = get_con()
    cur  = con.cursor()
    cur.execute(
        "INSERT INTO gallery_photos (url, caption, sort_order) VALUES (%s,%s,%s) RETURNING *",
        (data["url"], data.get("caption", ""), data.get("sort_order", 0))
    )
    row = cur.fetchone()
    con.commit(); cur.close(); con.close()
    return jsonify(dict(row)), 201


@app.delete("/api/admin/gallery/<int:pid>")
def delete_gallery_photo(pid):
    con = get_con()
    cur = con.cursor()
    cur.execute("DELETE FROM gallery_photos WHERE id=%s", (pid,))
    con.commit(); cur.close(); con.close()
    return jsonify({"message": "Deleted."})


# ── Room photos ────────────────────────────────────────────────────────────────

@app.get("/api/room-photos")
@app.get("/api/admin/room-photos")
def get_room_photos():
    con = get_con()
    cur = con.cursor()
    cur.execute("SELECT * FROM room_photos ORDER BY category, sort_order, id")
    rows = cur.fetchall()
    cur.close(); con.close()
    return jsonify([dict(r) for r in rows])


@app.post("/api/admin/room-photos")
def add_room_photo():
    data = request.get_json()
    con  = get_con()
    cur  = con.cursor()
    cur.execute(
        "INSERT INTO room_photos (category, url, sort_order) VALUES (%s,%s,%s) RETURNING *",
        (data["category"], data["url"], data.get("sort_order", 0))
    )
    row = cur.fetchone()
    con.commit(); cur.close(); con.close()
    return jsonify(dict(row)), 201


@app.delete("/api/admin/room-photos/<int:pid>")
def delete_room_photo(pid):
    con = get_con()
    cur = con.cursor()
    cur.execute("DELETE FROM room_photos WHERE id=%s", (pid,))
    con.commit(); cur.close(); con.close()
    return jsonify({"message": "Deleted."})


# ── Analytics ─────────────────────────────────────────────────────────────────

@app.get("/api/admin/analytics")
def get_analytics():
    con = get_con()
    cur = con.cursor()
    cur.execute("""
        SELECT
            SUBSTRING(check_in_date, 1, 7) AS month,
            COUNT(*)                        AS bookings,
            COALESCE(SUM(total_price), 0)   AS revenue
        FROM bookings
        WHERE status = 'Approved'
        GROUP BY month
        ORDER BY month DESC
    """)
    rows = cur.fetchall()
    cur.close(); con.close()
    return jsonify([dict(r) for r in rows])


# ── Excel export ──────────────────────────────────────────────────────────────

@app.get("/api/admin/export")
def export_reservations():
    con = get_con()
    cur = con.cursor()
    cur.execute("""
        SELECT b.reference_number, b.guest_name, b.email, b.phone,
               b.category, r.room_number AS room,
               b.check_in_date, b.check_out_date,
               b.adults, b.kids, b.pets, b.special_requests,
               b.total_price, b.status, b.created_at
        FROM bookings b
        LEFT JOIN rooms r ON b.assigned_room_id = r.id
        ORDER BY b.created_at DESC
    """)
    rows = cur.fetchall()
    cur.close(); con.close()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Reservations"

    headers = [
        "Reference", "Guest Name", "Email", "Phone", "Category", "Room",
        "Check-In", "Check-Out", "Adults", "Kids", "Pets",
        "Special Requests", "Total ($)", "Status", "Booked On"
    ]
    ws.append(headers)

    # Bold header row
    from openpyxl.styles import Font
    for cell in ws[1]:
        cell.font = Font(bold=True)

    for r in rows:
        ws.append([
            r["reference_number"], r["guest_name"], r["email"], r["phone"],
            r["category"], r["room"],
            r["check_in_date"], r["check_out_date"],
            r["adults"], r["kids"], r["pets"], r["special_requests"],
            r["total_price"], r["status"],
            r["created_at"].split("T")[0] if r["created_at"] else ""
        ])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return send_file(
        buf,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=f"reservations_{date.today().isoformat()}.xlsx"
    )


# ── Force reviews refresh ─────────────────────────────────────────────────────

@app.post("/api/admin/reviews/refresh")
def refresh_reviews():
    con = get_con()
    cur = con.cursor()
    cur.execute("DELETE FROM reviews_cache")
    con.commit()
    cur.close()
    con.close()
    # Now call get_reviews() logic to re-fetch immediately
    from flask import current_app
    with current_app.test_request_context('/api/reviews'):
        return get_reviews()


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
