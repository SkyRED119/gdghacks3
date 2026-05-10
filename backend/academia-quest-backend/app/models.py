from sqlalchemy import Column, String, Float, Boolean, DateTime, Integer, Text
from sqlalchemy.sql import func
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)        # Google sub (unique per Google account)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=True)
    picture = Column(String, nullable=True)
    xp = Column(Integer, default=0)
    level = Column(Integer, default=1)
    streak = Column(Integer, default=0)
    last_active_date = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=True, index=True)
    course_id = Column(String, nullable=True)
    course = Column(String, nullable=True)
    title = Column(String, nullable=False)
    due_date = Column(String, nullable=True)
    status = Column(String, default="pending")
    grade = Column(Float, nullable=True)
    max_grade = Column(Float, nullable=True)
    priority = Column(Float, default=0.0)
    url = Column(Text, nullable=True)
    source = Column(String, nullable=True)
    completed_at = Column(String, nullable=True)
    synced_at = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Grade(Base):
    __tablename__ = "grades"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=True, index=True)
    course_id = Column(String, nullable=True)
    course = Column(String, nullable=True)
    title = Column(String, nullable=False)
    grade = Column(Float, nullable=True)
    max_grade = Column(Float, nullable=True)
    percentage = Column(Float, nullable=True)
    source = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
