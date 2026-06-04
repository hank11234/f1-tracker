from sqlalchemy import (
    Column, Integer, String, Float, Boolean,
    DateTime, ForeignKey, Text, UniqueConstraint
)
from sqlalchemy.orm import relationship
from database import Base


class Team(Base):
    __tablename__ = "teams"
    id = Column(Integer, primary_key=True)
    constructor_id = Column(String, unique=True, index=True)
    name = Column(String)
    nationality = Column(String)
    color = Column(String, default="#e8002d")
    drivers = relationship("Driver", back_populates="team")
    standings = relationship("TeamStanding", back_populates="team")


class Driver(Base):
    __tablename__ = "drivers"
    id = Column(Integer, primary_key=True)
    driver_number = Column(Integer, index=True)
    driver_id = Column(String, unique=True, index=True)
    first_name = Column(String)
    last_name = Column(String)
    abbreviation = Column(String)
    nationality = Column(String)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    team = relationship("Team", back_populates="drivers")
    standings = relationship("DriverStanding", back_populates="driver")
    results = relationship("SessionResult", back_populates="driver")
    laps = relationship("Lap", back_populates="driver")
    car_parts = relationship("CarPart", back_populates="driver")


class Circuit(Base):
    __tablename__ = "circuits"
    id = Column(Integer, primary_key=True)
    circuit_id = Column(String, unique=True, index=True)
    name = Column(String)
    location = Column(String)
    country = Column(String)
    country_code = Column(String, nullable=True)
    total_laps = Column(Integer, nullable=True)
    lap_length_km = Column(Float, nullable=True)
    sessions = relationship("Session", back_populates="circuit")


class Session(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True)
    session_key = Column(Integer, unique=True, index=True)
    openf1_key = Column(Integer, nullable=True)
    year = Column(Integer)
    round_number = Column(Integer)
    circuit_id = Column(Integer, ForeignKey("circuits.id"), nullable=True)
    session_type = Column(String)
    session_name = Column(String)
    race_name = Column(String, nullable=True)  # official GP name, e.g. "Lenovo Grand Prix Du Canada"
    date_start = Column(DateTime, nullable=True)
    date_end = Column(DateTime, nullable=True)
    status = Column(String, default="upcoming")
    circuit = relationship("Circuit", back_populates="sessions")
    results = relationship("SessionResult", back_populates="session")
    laps = relationship("Lap", back_populates="session")
    pit_stops = relationship("PitStop", back_populates="session")
    stints = relationship("Stint", back_populates="session")


class SessionResult(Base):
    __tablename__ = "session_results"
    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    driver_id = Column(Integer, ForeignKey("drivers.id"))
    position = Column(Integer, nullable=True)
    grid_position = Column(Integer, nullable=True)
    points = Column(Float, default=0)
    laps_completed = Column(Integer, nullable=True)
    status = Column(String, nullable=True)
    gap_to_leader = Column(String, nullable=True)
    best_lap_time = Column(Float, nullable=True)
    best_lap_number = Column(Integer, nullable=True)
    __table_args__ = (UniqueConstraint("session_id", "driver_id"),)
    session = relationship("Session", back_populates="results")
    driver = relationship("Driver", back_populates="results")


class Lap(Base):
    __tablename__ = "laps"
    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    driver_id = Column(Integer, ForeignKey("drivers.id"))
    lap_number = Column(Integer)
    lap_time = Column(Float, nullable=True)
    sector1 = Column(Float, nullable=True)
    sector2 = Column(Float, nullable=True)
    sector3 = Column(Float, nullable=True)
    compound = Column(String, nullable=True)
    tyre_age = Column(Integer, nullable=True)
    is_pit_out_lap = Column(Boolean, default=False)
    is_personal_best = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    __table_args__ = (UniqueConstraint("session_id", "driver_id", "lap_number"),)
    session = relationship("Session", back_populates="laps")
    driver = relationship("Driver", back_populates="laps")


class PitStop(Base):
    __tablename__ = "pit_stops"
    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    driver_id = Column(Integer, ForeignKey("drivers.id"))
    lap_number = Column(Integer)
    pit_duration = Column(Float, nullable=True)
    __table_args__ = (UniqueConstraint("session_id", "driver_id", "lap_number"),)
    session = relationship("Session", back_populates="pit_stops")
    driver = relationship("Driver")


class Stint(Base):
    __tablename__ = "stints"
    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    driver_id = Column(Integer, ForeignKey("drivers.id"))
    stint_number = Column(Integer)
    lap_start = Column(Integer)
    lap_end = Column(Integer, nullable=True)
    compound = Column(String)
    tyre_age_at_start = Column(Integer, default=0)
    __table_args__ = (UniqueConstraint("session_id", "driver_id", "stint_number"),)
    session = relationship("Session", back_populates="stints")
    driver = relationship("Driver")


class DriverStanding(Base):
    __tablename__ = "driver_standings"
    id = Column(Integer, primary_key=True)
    year = Column(Integer)
    round_number = Column(Integer)
    driver_id = Column(Integer, ForeignKey("drivers.id"))
    position = Column(Integer)
    points = Column(Float)
    wins = Column(Integer, default=0)
    __table_args__ = (UniqueConstraint("year", "round_number", "driver_id"),)
    driver = relationship("Driver", back_populates="standings")


class TeamStanding(Base):
    __tablename__ = "team_standings"
    id = Column(Integer, primary_key=True)
    year = Column(Integer)
    round_number = Column(Integer)
    team_id = Column(Integer, ForeignKey("teams.id"))
    position = Column(Integer)
    points = Column(Float)
    wins = Column(Integer, default=0)
    __table_args__ = (UniqueConstraint("year", "round_number", "team_id"),)
    team = relationship("Team", back_populates="standings")


class CarPart(Base):
    __tablename__ = "car_parts"
    id = Column(Integer, primary_key=True)
    driver_id = Column(Integer, ForeignKey("drivers.id"))
    year = Column(Integer)
    round_number = Column(Integer)
    component = Column(String)
    pool_count = Column(Integer, default=1)
    penalty_applied = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    driver = relationship("Driver", back_populates="car_parts")


class SyncLog(Base):
    __tablename__ = "sync_log"
    id = Column(Integer, primary_key=True)
    sync_time = Column(DateTime)
    sync_type = Column(String)
    status = Column(String)
    message = Column(Text, nullable=True)
