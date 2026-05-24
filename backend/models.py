import enum
from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey, UniqueConstraint
from sqlalchemy.orm import sessionmaker, DeclarativeBase, relationship

SQLALCHEMY_DATABASE_URL = "sqlite:///./motel.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class RoomTypeEnum(str, enum.Enum):
    ONE_QUEEN = "One Queen"
    KING = "King"
    ONE_FULL = "One Full"
    TWO_FULL = "2 Full"
    TWO_QUEEN = "2 Queen"


class CategoryEnum(str, enum.Enum):
    ONE_KING = "One King"
    TWO_QUEEN = "Two Queen"
    TWO_DOUBLE = "2 Double Bed"


class RoomStatus(str, enum.Enum):
    AVAILABLE = "Available"
    OCCUPIED = "Occupied"
    MAINTENANCE = "Maintenance"


class BookingStatus(str, enum.Enum):
    PENDING = "Pending"
    APPROVED = "Approved"
    REJECTED = "Rejected"


# Maps display category -> actual room types that belong to it
CATEGORY_MAP = {
    CategoryEnum.ONE_KING:   [RoomTypeEnum.KING, RoomTypeEnum.ONE_QUEEN],
    CategoryEnum.TWO_QUEEN:  [RoomTypeEnum.TWO_QUEEN],
    CategoryEnum.TWO_DOUBLE: [RoomTypeEnum.TWO_FULL, RoomTypeEnum.ONE_FULL],
}


class PhysicalRoom(Base):
    __tablename__ = "physical_rooms"

    id = Column(Integer, primary_key=True, index=True)
    room_number = Column(String, unique=True, index=True, nullable=False)
    room_type = Column(String, nullable=False)   # RoomTypeEnum value
    status = Column(String, default=RoomStatus.AVAILABLE, nullable=False)

    bookings = relationship("Booking", back_populates="assigned_room")


class CategoryRate(Base):
    __tablename__ = "category_rates"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String, unique=True, nullable=False)   # CategoryEnum value
    default_nightly_rate = Column(Float, nullable=False)


class PriceOverride(Base):
    __tablename__ = "price_overrides"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String, nullable=False)   # CategoryEnum value
    date = Column(String, nullable=False)        # YYYY-MM-DD
    price = Column(Float, nullable=False)

    __table_args__ = (UniqueConstraint("category", "date", name="uq_category_date"),)


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    guest_name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    category = Column(String, nullable=False)       # CategoryEnum value
    check_in_date = Column(String, nullable=False)  # YYYY-MM-DD
    check_out_date = Column(String, nullable=False) # YYYY-MM-DD
    status = Column(String, default=BookingStatus.PENDING, nullable=False)
    assigned_room_id = Column(Integer, ForeignKey("physical_rooms.id"), nullable=True)
    total_price = Column(Float, nullable=True)
    created_at = Column(String, nullable=True)

    assigned_room = relationship("PhysicalRoom", back_populates="bookings")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
