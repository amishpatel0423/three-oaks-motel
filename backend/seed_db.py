import models
from models import SessionLocal, engine, PhysicalRoom, BookingRequest, RoomStatus, RoomTypeEnum

def seed_database():
    # Force reset for the new aesthetic/schema
    models.Base.metadata.drop_all(bind=engine)
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    rooms_data = [
        ("101", RoomTypeEnum.ONE_QUEEN, RoomStatus.AVAILABLE),
        ("102", RoomTypeEnum.ONE_QUEEN, RoomStatus.AVAILABLE),
        ("103", RoomTypeEnum.ONE_QUEEN, RoomStatus.OCCUPIED),
        ("201", RoomTypeEnum.TWO_QUEEN, RoomStatus.AVAILABLE),
        ("202", RoomTypeEnum.TWO_QUEEN, RoomStatus.MAINTENANCE),
        ("203", RoomTypeEnum.TWO_QUEEN, RoomStatus.AVAILABLE),
        ("301", RoomTypeEnum.KING, RoomStatus.AVAILABLE),
        ("302", RoomTypeEnum.KING, RoomStatus.AVAILABLE),
    ]

    for number, r_type, status in rooms_data:
        room = PhysicalRoom(room_number=number, room_type=r_type, status=status)
        db.add(room)

    db.commit()

    bookings_data = [
        ("John Smith", "john.smith@gmail.com", "321-555-0101", RoomTypeEnum.KING, "2026-06-15", "2026-06-20"),
        ("Maria Garcia", "m.garcia@outlook.com", "407-555-0202", RoomTypeEnum.TWO_QUEEN, "2026-06-22", "2026-06-25"),
        ("David Wilson", "david.w@yahoo.com", "904-555-0303", RoomTypeEnum.ONE_QUEEN, "2026-06-18", "2026-06-19")
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
    print("Three Oaks Motel database initialized with fresh Florida fleet and pending requests.")
    db.close()

if __name__ == "__main__":
    seed_database()
