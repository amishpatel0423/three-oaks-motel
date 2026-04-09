from sqlalchemy import create_engine, Column, Integer, String, Boolean, Enum, ForeignKey
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from datetime import date
import enum

Base = declarative_base()

class RoomStatus(enum.Enum):
    AVAILABLE = "Available"
    PENDING = "Pending"
    OCCUPIED = "Occupied"
    MAINTENANCE = "Maintenance"

class RoomTypeEnum(enum.Enum):
    ONE_QUEEN = "One Queen"
    TWO_QUEEN = "Two Queen"
    KING = "King"

class PhysicalRoom(Base):
    __tablename__ = 'physical_rooms'
    id = Column(Integer, primary_key=True, index=True)
    room_number = Column(String, unique=True, index=True)
    room_type = Column(Enum(RoomTypeEnum), nullable=False)
    status = Column(Enum(RoomStatus), default=RoomStatus.AVAILABLE)

class BookingRequest(Base):
    __tablename__ = 'booking_requests'
    id = Column(Integer, primary_key=True, index=True)
    guest_name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    room_preference = Column(Enum(RoomTypeEnum), nullable=False)
    check_in_date = Column(String, nullable=False) # e.g. YYYY-MM-DD
    check_out_date = Column(String, nullable=False)
    status = Column(String, default="Pending") # Pending, Approved, Rejected
    assigned_room_id = Column(Integer, ForeignKey('physical_rooms.id'), nullable=True)
    
    assigned_room = relationship("PhysicalRoom")

# Setup sqlite engine and session
SQLALCHEMY_DATABASE_URL = "sqlite:///./motel.db"
# Use check_same_thread=False for sqlite in FastAPI
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
