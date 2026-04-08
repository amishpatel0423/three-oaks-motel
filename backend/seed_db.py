import models
from models import SessionLocal, engine, PhysicalRoom, BookingRequest, RoomStatus, RoomTypeEnum

def seed_database():
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Check if we already seeded
    if db.query(PhysicalRoom).count() > 0:
        print("Database already seeded.")
        db.close()
        return

    # Seed Address: 707 S. Hopkins Ave, Titusville, FL 32780 | (321) 267-6272
    # 3 Room Types
    rooms_data = [
        ("101", RoomTypeEnum.APOLLO, RoomStatus.AVAILABLE),
        ("102", RoomTypeEnum.APOLLO, RoomStatus.AVAILABLE),
        ("103", RoomTypeEnum.APOLLO, RoomStatus.OCCUPIED),
        ("201", RoomTypeEnum.GEMINI, RoomStatus.AVAILABLE),
        ("202", RoomTypeEnum.GEMINI, RoomStatus.MAINTENANCE),
        ("203", RoomTypeEnum.GEMINI, RoomStatus.AVAILABLE),
        ("301", RoomTypeEnum.ARTEMIS, RoomStatus.AVAILABLE),
        ("302", RoomTypeEnum.ARTEMIS, RoomStatus.AVAILABLE),
    ]

    for number, r_type, status in rooms_data:
        room = PhysicalRoom(room_number=number, room_type=r_type, status=status)
        db.add(room)

    # Commit rooms first
    db.commit()

    # Seed Bookings
    bookings_data = [
        ("Neil Armstrong", "neil@nasa.gov", "555-123-4567", RoomTypeEnum.APOLLO, "2026-05-10", "2026-05-15"),
        ("Buzz Aldrin", "buzz@nasa.gov", "555-987-6543", RoomTypeEnum.GEMINI, "2026-05-12", "2026-05-16"),
        ("Sally Ride", "sally@nasa.gov", "555-555-5555", RoomTypeEnum.ARTEMIS, "2026-05-20", "2026-05-25")
    ]

    for name, email, phone, pref, check_in, check_out in bookings_data:
        b = BookingRequest(
            guest_name=name,
            email=email,
            phone=phone,
            room_preference=pref,
            check_in_date=check_in,
            check_out_date=check_out,
            status="Pending"
        )
        db.add(b)

    db.commit()
    print("Mission Control database initialized with fleet and pending logs.")
    db.close()

if __name__ == "__main__":
    seed_database()
