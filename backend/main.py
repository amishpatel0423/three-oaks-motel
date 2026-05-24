from flask import Flask, jsonify, request, abort
from flask_cors import CORS
from datetime import date, timedelta, datetime
from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey, UniqueConstraint
from sqlalchemy.orm import sessionmaker, DeclarativeBase, relationship
import enum

# ── Database setup ────────────────────────────────────────────────────────────

DATABASE_URL = "sqlite:///./motel.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


# ── Enums ─────────────────────────────────────────────────────────────────────

class RoomTypeEnum(str, enum.Enum):
    ONE_QUEEN = "One Queen"
    KING      = "King"
    ONE_FULL  = "One Full"
    TWO_FULL  = "2 Full"
    TWO_QUEEN = "2 Queen"

class CategoryEnum(str, enum.Enum):
    ONE_KING   = "One King"
    TWO_QUEEN  = "Two Queen"
    TWO_DOUBLE = "2 Double Bed"

class RoomStatus(str, enum.Enum):
    AVAILABLE   = "Available"
    OCCUPIED    = "Occupied"
    MAINTENANCE = "Maintenance"

class BookingStatus(str, enum.Enum):
    PENDING  = "Pending"
    APPROVED = "Approved"
    REJECTED = "Rejected"

CATEGORY_MAP = {
    CategoryEnum.ONE_KING:   [RoomTypeEnum.KING, RoomTypeEnum.ONE_QUEEN],
    CategoryEnum.TWO_QUEEN:  [RoomTypeEnum.TWO_QUEEN],
    CategoryEnum.TWO_DOUBLE: [RoomTypeEnum.TWO_FULL, RoomTypeEnum.ONE_FULL],
}

# ── Models ────────────────────────────────────────────────────────────────────

class PhysicalRoom(Base):
    __tablename__ = "physical_rooms"
    id          = Column(Integer, primary_key=True)
    room_number = Column(String, unique=True, nullable=False)
    room_type   = Column(String, nullable=False)
    status      = Column(String, default=RoomStatus.AVAILABLE.value, nullable=False)
    bookings    = relationship("Booking", back_populates="assigned_room")

class CategoryRate(Base):
    __tablename__ = "category_rates"
    id                   = Column(Integer, primary_key=True)
    category             = Column(String, unique=True, nullable=False)
    default_nightly_rate = Column(Float, nullable=False)

class PriceOverride(Base):
    __tablename__  = "price_overrides"
    id             = Column(Integer, primary_key=True)
    category       = Column(String, nullable=False)
    date           = Column(String, nullable=False)
    price          = Column(Float, nullable=False)
    __table_args__ = (UniqueConstraint("category", "date", name="uq_category_date"),)

class Booking(Base):
    __tablename__    = "bookings"
    id               = Column(Integer, primary_key=True)
    guest_name       = Column(String, nullable=False)
    email            = Column(String, nullable=False)
    phone            = Column(String, nullable=False)
    category         = Column(String, nullable=False)
    check_in_date    = Column(String, nullable=False)
    check_out_date   = Column(String, nullable=False)
    status           = Column(String, default=BookingStatus.PENDING.value)
    assigned_room_id = Column(Integer, ForeignKey("physical_rooms.id"), nullable=True)
    total_price      = Column(Float, nullable=True)
    created_at       = Column(String, nullable=True)
    assigned_room    = relationship("PhysicalRoom", back_populates="bookings")

# ── Auto-seed ─────────────────────────────────────────────────────────────────

def seed_if_empty():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    rooms = [
        ("1","One Queen"),("2","One Queen"),("3","King"),("4","King"),("5","King"),
        ("6","One Full"),("7","2 Full"),("8","King"),("9","2 Queen"),("10","2 Queen"),
        ("11","2 Queen"),("12","King"),("14","2 Full"),("15","2 Full"),("16","King"),
        ("17","King"),("18","2 Queen"),("19","King"),("20","2 Queen"),("21","2 Queen"),
        ("22","2 Queen"),("24","2 Queen"),("25","2 Full"),("26","King"),("27","2 Queen"),
    ]
    for number, rtype in rooms:
        db.add(PhysicalRoom(room_number=number, room_type=rtype, status="Available"))

    db.add(CategoryRate(category="One King",    default_nightly_rate=89.0))
    db.add(CategoryRate(category="Two Queen",   default_nightly_rate=109.0))
    db.add(CategoryRate(category="2 Double Bed",default_nightly_rate=99.0))

    db.commit()
    db.close()
    print("✓ Database seeded: 25 rooms + default rates.")

# ── Flask app ─────────────────────────────────────────────────────────────────

app = Flask(__name__)
CORS(app)

def get_db():
    return SessionLocal()

def nightly_prices(db, category, check_in, check_out):
    start = date.fromisoformat(check_in)
    end   = date.fromisoformat(check_out)
    row   = db.query(CategoryRate).filter(CategoryRate.category == category).first()
    default = row.default_nightly_rate if row else 0.0
    overrides = {
        o.date: o.price
        for o in db.query(PriceOverride).filter(
            PriceOverride.category == category,
            PriceOverride.date >= check_in,
            PriceOverride.date <  check_out,
        ).all()
    }
    nights, cur = [], start
    while cur < end:
        ds = cur.isoformat()
        nights.append({"date": ds, "price": overrides.get(ds, default)})
        cur += timedelta(days=1)
    return nights

def available_rooms(db, category, check_in, check_out):
    types = [rt.value for rt in CATEGORY_MAP[CategoryEnum(category)]]
    candidates = db.query(PhysicalRoom).filter(
        PhysicalRoom.room_type.in_(types),
        PhysicalRoom.status == RoomStatus.AVAILABLE.value,
    ).all()
    result = []
    for room in candidates:
        overlap = db.query(Booking).filter(
            Booking.assigned_room_id == room.id,
            Booking.status == BookingStatus.APPROVED.value,
            Booking.check_in_date  < check_out,
            Booking.check_out_date > check_in,
        ).first()
        if not overlap:
            result.append(room)
    return result

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/api/availability")
def get_availability():
    check_in  = request.args.get("check_in")
    check_out = request.args.get("check_out")
    if not check_in or not check_out:
        return jsonify({"error": "check_in and check_out required"}), 400
    db = get_db()
    try:
        results = []
        for cat in CategoryEnum:
            rooms  = available_rooms(db, cat.value, check_in, check_out)
            nights = nightly_prices(db, cat.value, check_in, check_out)
            results.append({
                "category":        cat.value,
                "available_count": len(rooms),
                "room_numbers":    sorted([r.room_number for r in rooms], key=lambda x: int(x)),
                "nightly_prices":  nights,
                "total_price":     round(sum(n["price"] for n in nights), 2),
            })
        return jsonify(results)
    finally:
        db.close()

@app.post("/api/bookings")
def create_booking():
    data = request.get_json()
    db = get_db()
    try:
        b = Booking(
            guest_name     = data["guest_name"],
            email          = data["email"],
            phone          = data["phone"],
            category       = data["category"],
            check_in_date  = data["check_in_date"],
            check_out_date = data["check_out_date"],
            total_price    = data.get("total_price"),
            status         = BookingStatus.PENDING.value,
            created_at     = datetime.now().isoformat(timespec="seconds"),
        )
        db.add(b)
        db.commit()
        db.refresh(b)
        return jsonify({"message": "Booking received.", "booking_id": b.id}), 201
    finally:
        db.close()

@app.get("/api/bookings")
def get_bookings():
    db = get_db()
    try:
        return jsonify([{
            "id": b.id, "guest_name": b.guest_name, "email": b.email, "phone": b.phone,
            "category": b.category, "check_in_date": b.check_in_date,
            "check_out_date": b.check_out_date, "status": b.status,
            "assigned_room_id": b.assigned_room_id,
            "assigned_room_number": b.assigned_room.room_number if b.assigned_room else None,
            "total_price": b.total_price, "created_at": b.created_at,
        } for b in db.query(Booking).all()])
    finally:
        db.close()

@app.get("/api/rooms")
def get_rooms():
    db = get_db()
    try:
        return jsonify([
            {"id": r.id, "room_number": r.room_number, "room_type": r.room_type, "status": r.status}
            for r in db.query(PhysicalRoom).all()
        ])
    finally:
        db.close()

@app.patch("/api/bookings/<int:bid>/approve")
def approve_booking(bid):
    db = get_db()
    try:
        b = db.query(Booking).filter(Booking.id == bid).first()
        if not b:
            return jsonify({"error": "Not found"}), 404
        rooms = available_rooms(db, b.category, b.check_in_date, b.check_out_date)
        if not rooms:
            return jsonify({"error": "No available rooms for this category and dates"}), 400
        b.status = BookingStatus.APPROVED.value
        b.assigned_room_id = rooms[0].id
        db.commit()
        return jsonify({"message": f"Approved. Room {rooms[0].room_number} assigned."})
    finally:
        db.close()

@app.patch("/api/bookings/<int:bid>/reject")
def reject_booking(bid):
    db = get_db()
    try:
        b = db.query(Booking).filter(Booking.id == bid).first()
        if not b:
            return jsonify({"error": "Not found"}), 404
        b.status = BookingStatus.REJECTED.value
        db.commit()
        return jsonify({"message": "Rejected."})
    finally:
        db.close()

@app.get("/api/admin/pricing")
def get_pricing():
    db = get_db()
    try:
        return jsonify([
            {"id": r.id, "category": r.category, "default_nightly_rate": r.default_nightly_rate}
            for r in db.query(CategoryRate).all()
        ])
    finally:
        db.close()

@app.patch("/api/admin/pricing/<path:category>")
def update_pricing(category):
    db = get_db()
    try:
        r = db.query(CategoryRate).filter(CategoryRate.category == category).first()
        if not r:
            return jsonify({"error": "Not found"}), 404
        r.default_nightly_rate = request.get_json()["default_nightly_rate"]
        db.commit()
        return jsonify({"id": r.id, "category": r.category, "default_nightly_rate": r.default_nightly_rate})
    finally:
        db.close()

@app.get("/api/admin/pricing/overrides")
def get_overrides():
    db = get_db()
    try:
        return jsonify([
            {"id": o.id, "category": o.category, "date": o.date, "price": o.price}
            for o in db.query(PriceOverride).order_by(PriceOverride.category, PriceOverride.date).all()
        ])
    finally:
        db.close()

@app.post("/api/admin/pricing/overrides")
def create_override():
    data = request.get_json()
    db = get_db()
    try:
        existing = db.query(PriceOverride).filter(
            PriceOverride.category == data["category"],
            PriceOverride.date == data["date"],
        ).first()
        if existing:
            existing.price = data["price"]
            db.commit()
            return jsonify({"id": existing.id, "category": existing.category, "date": existing.date, "price": existing.price})
        o = PriceOverride(category=data["category"], date=data["date"], price=data["price"])
        db.add(o)
        db.commit()
        db.refresh(o)
        return jsonify({"id": o.id, "category": o.category, "date": o.date, "price": o.price}), 201
    finally:
        db.close()

@app.delete("/api/admin/pricing/overrides/<int:oid>")
def delete_override(oid):
    db = get_db()
    try:
        o = db.query(PriceOverride).filter(PriceOverride.id == oid).first()
        if not o:
            return jsonify({"error": "Not found"}), 404
        db.delete(o)
        db.commit()
        return jsonify({"message": "Deleted."})
    finally:
        db.close()

# ── Start ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Setting up database...")
    seed_if_empty()
    print("Starting Three Oaks Motel API on http://localhost:8000")
    app.run(host="0.0.0.0", port=8000, debug=False)
