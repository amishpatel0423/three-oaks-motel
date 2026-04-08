import uvicorn
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

import models
from models import engine, get_db, PhysicalRoom, BookingRequest, RoomStatus, RoomTypeEnum

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Three Oaks Motel - Mission Control API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict to frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic schema for creating a booking
class BookingCreate(BaseModel):
    guest_name: str
    email: str
    phone: str
    room_preference: str
    check_in_date: str
    check_out_date: str

class PhysicalRoomResponse(BaseModel):
    id: int
    room_number: str
    room_type: str
    status: str

    class Config:
        from_attributes = True

class BookingResponse(BaseModel):
    id: int
    guest_name: str
    email: str
    phone: str
    room_preference: str
    check_in_date: str
    check_out_date: str
    status: str
    assigned_room_id: int | None = None
    assigned_room: PhysicalRoomResponse | None = None

    class Config:
        from_attributes = True

@app.get("/api/rooms", response_model=List[PhysicalRoomResponse])
def get_rooms(db: Session = Depends(get_db)):
    rooms = db.query(PhysicalRoom).all()
    # Map Enum to string for Pydantic
    return [{"id": r.id, "room_number": r.room_number, "room_type": r.room_type.value, "status": r.status.value} for r in rooms]

@app.get("/api/bookings", response_model=List[BookingResponse])
def get_bookings(db: Session = Depends(get_db)):
    bookings = db.query(BookingRequest).all()
    response = []
    for b in bookings:
        resp_b = {
            "id": b.id, "guest_name": b.guest_name, "email": b.email,
            "phone": b.phone, "room_preference": b.room_preference.value,
            "check_in_date": b.check_in_date, "check_out_date": b.check_out_date,
            "status": b.status, "assigned_room_id": b.assigned_room_id,
            "assigned_room": None
        }
        if b.assigned_room:
            resp_b["assigned_room"] = {
                "id": b.assigned_room.id,
                "room_number": b.assigned_room.room_number,
                "room_type": b.assigned_room.room_type.value,
                "status": b.assigned_room.status.value
            }
        response.append(resp_b)
    return response

@app.post("/api/bookings")
def create_booking(booking: BookingCreate, db: Session = Depends(get_db)):
    try:
        pref = RoomTypeEnum(booking.room_preference)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid room preference")

    new_booking = BookingRequest(
        guest_name=booking.guest_name,
        email=booking.email,
        phone=booking.phone,
        room_preference=pref,
        check_in_date=booking.check_in_date,
        check_out_date=booking.check_out_date
    )
    db.add(new_booking)
    db.commit()
    db.refresh(new_booking)
    return {"message": "Transmission Received", "booking_id": new_booking.id}

@app.patch("/api/bookings/{booking_id}/approve")
def approve_booking(booking_id: int, db: Session = Depends(get_db)):
    booking = db.query(BookingRequest).filter(BookingRequest.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.status == "Approved":
        return {"message": "Booking already approved"}

    # Find available room of the preferred type
    available_room = db.query(PhysicalRoom).filter(
        PhysicalRoom.room_type == booking.room_preference,
        PhysicalRoom.status == RoomStatus.AVAILABLE
    ).first()

    if not available_room:
        raise HTTPException(status_code=400, detail="No available rooms of preferred type")

    # Update logic
    booking.status = "Approved"
    booking.assigned_room_id = available_room.id
    available_room.status = RoomStatus.OCCUPIED
    
    db.commit()
    return {"message": f"Booking approved, assigned to Room {available_room.room_number}"}

@app.patch("/api/bookings/{booking_id}/reject")
def reject_booking(booking_id: int, db: Session = Depends(get_db)):
    booking = db.query(BookingRequest).filter(BookingRequest.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking.status = "Rejected"
    db.commit()
    return {"message": "Booking rejected"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
