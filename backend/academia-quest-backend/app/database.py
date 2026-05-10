import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Local: SQLite. GCP Cloud Run: set DATABASE_URL to postgres connection string.
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./academia_quest.db"
)

# Cloud SQL (postgres) needs this, SQLite doesn't
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
