import os
from pathlib import Path
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# Define path to backend/roadsense.db
backend_dir = Path(__file__).resolve().parent.parent.parent
DB_PATH = backend_dir / "roadsense.db"
DATABASE_URL = f"sqlite:///{DB_PATH.as_posix()}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Dependency for providing a transactional database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Creates database tables automatically if they do not already exist."""
    # Import models here so Base knows about them before creating tables
    import app.db.models  # noqa: F401
    Base.metadata.create_all(bind=engine)
