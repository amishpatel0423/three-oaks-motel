import uvicorn
from datetime import date, timedelta
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from pydantic import BaseModel

import models
from models import (
    engine, get_db, Base,
    PhysicalRoom, CategoryRate, PriceOverride, Booking,
    RoomTypeEnum, CategoryEnum, RoomStatus, BookingStatus,
    CATEGORY_MAP
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Three Oaks Motel API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ──────────────────────────────────────────────────────────────────

def get_nightly_prices(db: Session, category: str, check_in: str, check_out: str) -> list[dict]:
    """Return a list of {date, price} for each night of the stay."""
    start = date.fromisoformat(check_in)
    end = date.fromisoformat(check_out)
    rate_row = db.query(CategoryRate).filter(CategoryRate.category == category).first()
    default_rate = rate_row.default_nightly_rate if rate_row else 0.0

    overrides = {
        o.date: o.price
        for o in db.query(PriceOverride).filter(
            PriceOverride.category == category,
            PriceOverride.date >= check_in,
            PriceOverride.date < check_out,
        ).all()
    }

    nights = []
    current = start
    while current < end:
        ds = current.isoformat()
        nights.append({"date": ds, "price": overrides.get(ds, default_rate)})
        current += timedelta(days=1)
    return nights


def get_available_rooms(db: Session, category: str, check_in: str, check_out: str) -> list[PhysicalRoom]:
    """Return rooms in the given category that are free for the date range."""
    room_types = [rt.value for rt in CATEGORY_MAP[CategoryEnum(category)]]

    # Rooms in the right category that aren't under maintenance
    candidate_rooms = db.query(PhysicalRoom).filter(
        PhysicalRoom.room_type.in_(room_types),
        PhysicalRoom.status != RoomStatus.OCCUPIED.value,
        PhysicalRoom.status != RoomStatus.MAINTENANCE.value,
    ).all()

    # Filter out rooms with overlapping approved bookings
    available = []
    for room in candidate_rooms:
        overlap = db.query(Booking).filter(
            Booking.assigned_room_id == room.id,
            Booking.status == BookingStatus.APPROVED.value,
            Booking.check_in_date < check_out,
            Booking.check_out_date > check_in,
        ).first()
        if not overlap:
            available.append(room)

    return available


# ── Pydantic Schemas ──────────────────────────────────────────────────────────

class BookingCreate(BaseModel):
    guest_name: str
    email: str
    phone: str
    category: str
    check_in_date: str
    check_out_date: str
    total_price: Optional[float] = None


class BookingResponse(BaseModel):
    id: int
    guest_name: str
    email: str
    phone: str
    category: str
    check_in_date: str
    check_out_date: str
    status: str
    assigned_room_id: Optional[int] = None
    assigned_room_number: Optional[str] = None
    total_price: Optional[float] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class RoomResponse(BaseModel):
    id: int
    room_number: str
    room_type: str
    status: str

    class Config:
        from_attributes = True


class CategoryRateResponse(BaseModel):
    id: int
    category: str
    default_nightly_rate: float

    class Config:
        from_attributes = True


class CategoryRateUpdate(BaseModel):
    default_nightly_rate: float


class PriceOverrideCreate(BaseModel):
    category: str
    date: str
    price: float


class PriceOverrideResponse(BaseModel):
    id: int
    category: str
    date: str
    price: float

    class Config:
        from_attributes = True


class AvailabilityCategoryResult(BaseModel):
    category: str
    available_count: int
    room_numbers: List[str]
    nightly_prices: List[dict]
    total_price: float


# ── Public Endpoints ──────────────────────────────────────────────────────────

@app.get("/api/availability", response_model=List[AvailabilityCategoryResult])
def get_availability(
    check_in: str = Query(...),
    check_out: str = Query(...),
    db: Session = Depends(get_db)
):
    try:
        ci = date.fromisoformat(check_in)
        co = date.fromisoformat(check_out)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    if co <= ci:
        raise HTTPException(status_code=400, detail="Check-out must be after check-in.")

    results = []
    for cat in CategoryEnum:
        rooms = get_available_rooms(db, cat.value, check_in, check_out)
        nights = get_nightly_prices(db, cat.value, check_in, check_out)
        total = sum(n["price"] for n in nights)
        results.append(AvailabilityCategoryResult(
            category=cat.value,
            available_count=len(rooms),
            room_numbers=sorted([r.room_number for r in rooms], key=lambda x: int(x)),
            nightly_prices=nights,
            total_price=round(total, 2),
        ))
    return results


@app.post("/api/bookings")
def create_booking(booking: BookingCreate, db: Session = Depends(get_db)):
    try:
        CategoryEnum(booking.category)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid room category.")

    from datetime import datetime
    new_booking = Booking(
        guest_name=booking.guest_name,
        email=booking.email,
        phone=booking.phone,
        category=booking.category,
        check_in_date=booking.check_in_date,
        check_out_date=booking.check_out_date,
        total_price=booking.total_price,
        status=BookingStatus.PENDING.value,
        created_at=datetime.now().isoformat(timespec="seconds"),
    )
    db.add(new_booking)
    db.commit()
    db.refresh(new_booking)
    return {"message": "Booking request received.", "booking_id": new_booking.id}


@app.get("/api/bookings", response_model=List[BookingResponse])
def get_bookings(db: Session = Depends(get_db)):
    bookings = db.query(Booking).all()
    result = []
    for b in bookings:
        result.append(BookingResponse(
            id=b.id,
            guest_name=b.guest_name,
            email=b.email,
            phone=b.phone,
            category=b.category,
            check_in_date=b.check_in_date,
            check_out_date=b.check_out_date,
            status=b.status,
            assigned_room_id=b.assigned_room_id,
            assigned_room_number=b.assigned_room.room_number if b.assigned_room else None,
            total_price=b.total_price,
            created_at=b.created_at,
        ))
    return result


@app.get("/api/rooms", response_model=List[RoomResponse])
def get_rooms(db: Session = Depends(get_db)):
    rooms = db.query(PhysicalRoom).all()
    return [RoomResponse(id=r.id, room_number=r.room_number, room_type=r.room_type, status=r.status) for r in rooms]


@app.patch("/api/bookings/{booking_id}/approve")
def approve_booking(booking_id: int, db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    if booking.status == BookingStatus.APPROVED.value:
        return {"message": "Booking already approved."}

    available = get_available_rooms(db, booking.category, booking.check_in_date, booking.check_out_date)
    if not available:
        raise HTTPException(status_code=400, detail="No available rooms for this category and date range.")

    room = available[0]
    booking.status = BookingStatus.APPROVED.value
    booking.assigned_room_id = room.id
    db.commit()
    return {"message": f"Booking approved. Assigned to Room {room.room_number}."}


@app.patch("/api/bookings/{booking_id}/reject")
def reject_booking(booking_id: int, db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    booking.status = BookingStatus.REJECTED.value
    db.commit()
    return {"message": "Booking rejected."}


# ── Admin Pricing Endpoints ───────────────────────────────────────────────────

@app.get("/api/admin/pricing", response_model=List[CategoryRateResponse])
def get_pricing(db: Session = Depends(get_db)):
    return db.query(CategoryRate).all()


@app.patch("/api/admin/pricing/{category}")
def update_pricing(category: str, update: CategoryRateUpdate, db: Session = Depends(get_db)):
    try:
        CategoryEnum(category)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid category.")
    rate = db.query(CategoryRate).filter(CategoryRate.category == category).first()
    if not rate:
        raise HTTPException(status_code=404, detail="Category rate not found.")
    rate.default_nightly_rate = update.default_nightly_rate
    db.commit()
    db.refresh(rate)
    return rate


@app.get("/api/admin/pricing/overrides", response_model=List[PriceOverrideResponse])
def get_overrides(db: Session = Depends(get_db)):
    return db.query(PriceOverride).order_by(PriceOverride.category, PriceOverride.date).all()


@app.post("/api/admin/pricing/overrides", response_model=PriceOverrideResponse)
def create_override(override: PriceOverrideCreate, db: Session = Depends(get_db)):
    try:
        CategoryEnum(override.category)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid category.")
    try:
        date.fromisoformat(override.date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    # Upsert: update if exists
    existing = db.query(PriceOverride).filter(
        PriceOverride.category == override.category,
        PriceOverride.date == override.date,
    ).first()
    if existing:
        existing.price = override.price
        db.commit()
        db.refresh(existing)
        return existing

    new_override = PriceOverride(category=override.category, date=override.date, price=override.price)
    db.add(new_override)
    db.commit()
    db.refresh(new_override)
    return new_override


@app.delete("/api/admin/pricing/overrides/{override_id}")
def delete_override(override_id: int, db: Session = Depends(get_db)):
    override = db.query(PriceOverride).filter(PriceOverride.id == override_id).first()
    if not override:
        raise HTTPException(status_code=404, detail="Override not found.")
    db.delete(override)
    db.commit()
    return {"message": "Override deleted."}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
