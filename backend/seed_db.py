import models
from models import (
    SessionLocal, engine, Base,
    PhysicalRoom, CategoryRate, Booking,
    RoomTypeEnum, CategoryEnum, RoomStatus
)


def seed_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # All 25 physical rooms (1-27, skipping 13 and 23)
    rooms_data = [
        ("1",  RoomTypeEnum.ONE_QUEEN),
        ("2",  RoomTypeEnum.ONE_QUEEN),
        ("3",  RoomTypeEnum.KING),
        ("4",  RoomTypeEnum.KING),
        ("5",  RoomTypeEnum.KING),
        ("6",  RoomTypeEnum.ONE_FULL),
        ("7",  RoomTypeEnum.TWO_FULL),
        ("8",  RoomTypeEnum.KING),
        ("9",  RoomTypeEnum.TWO_QUEEN),
        ("10", RoomTypeEnum.TWO_QUEEN),
        ("11", RoomTypeEnum.TWO_QUEEN),
        ("12", RoomTypeEnum.KING),
        ("14", RoomTypeEnum.TWO_FULL),
        ("15", RoomTypeEnum.TWO_FULL),
        ("16", RoomTypeEnum.KING),
        ("17", RoomTypeEnum.KING),
        ("18", RoomTypeEnum.TWO_QUEEN),
        ("19", RoomTypeEnum.KING),
        ("20", RoomTypeEnum.TWO_QUEEN),
        ("21", RoomTypeEnum.TWO_QUEEN),
        ("22", RoomTypeEnum.TWO_QUEEN),
        ("24", RoomTypeEnum.TWO_QUEEN),
        ("25", RoomTypeEnum.TWO_FULL),
        ("26", RoomTypeEnum.KING),
        ("27", RoomTypeEnum.TWO_QUEEN),
    ]

    for number, r_type in rooms_data:
        room = PhysicalRoom(
            room_number=number,
            room_type=r_type.value,
            status=RoomStatus.AVAILABLE.value
        )
        db.add(room)

    # Default nightly rates per display category
    rates_data = [
        (CategoryEnum.ONE_KING,   89.0),
        (CategoryEnum.TWO_QUEEN,  109.0),
        (CategoryEnum.TWO_DOUBLE, 99.0),
    ]

    for category, rate in rates_data:
        cr = CategoryRate(category=category.value, default_nightly_rate=rate)
        db.add(cr)

    db.commit()
    print("Database seeded: 25 rooms + default nightly rates.")
    db.close()


if __name__ == "__main__":
    seed_database()
