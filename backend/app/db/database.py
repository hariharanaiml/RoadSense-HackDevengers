import logging
from pathlib import Path
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session

logger = logging.getLogger("database")

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
    """
    Creates database tables automatically if they do not already exist,
    and safely applies non-destructive schema migrations for new columns.
    """
    import app.db.models  # noqa: F401
    Base.metadata.create_all(bind=engine)

    # Safe lightweight SQLite migration for new columns
    try:
        with engine.connect() as conn:
            # 1. Inspect and migrate 'inspections' table
            res = conn.exec_driver_sql("PRAGMA table_info(inspections);")
            inspection_cols = {row[1] for row in res.fetchall()}

            if "total_estimated_cost" not in inspection_cols:
                logger.info("Migrating: Adding 'total_estimated_cost' to 'inspections' table.")
                conn.exec_driver_sql("ALTER TABLE inspections ADD COLUMN total_estimated_cost FLOAT DEFAULT 0.0;")
            if "overall_severity" not in inspection_cols:
                logger.info("Migrating: Adding 'overall_severity' to 'inspections' table.")
                conn.exec_driver_sql("ALTER TABLE inspections ADD COLUMN overall_severity VARCHAR(20) DEFAULT 'NONE';")
            if "overall_priority" not in inspection_cols:
                logger.info("Migrating: Adding 'overall_priority' to 'inspections' table.")
                conn.exec_driver_sql("ALTER TABLE inspections ADD COLUMN overall_priority VARCHAR(20) DEFAULT 'NONE';")

            # 2. Inspect and migrate 'detections' table
            res = conn.exec_driver_sql("PRAGMA table_info(detections);")
            detection_cols = {row[1] for row in res.fetchall()}

            if "severity" not in detection_cols:
                logger.info("Migrating: Adding 'severity' to 'detections' table.")
                conn.exec_driver_sql("ALTER TABLE detections ADD COLUMN severity VARCHAR(20) DEFAULT 'LOW';")
            if "priority" not in detection_cols:
                logger.info("Migrating: Adding 'priority' to 'detections' table.")
                conn.exec_driver_sql("ALTER TABLE detections ADD COLUMN priority VARCHAR(20) DEFAULT 'LOW';")
            if "estimated_cost" not in detection_cols:
                logger.info("Migrating: Adding 'estimated_cost' to 'detections' table.")
                conn.exec_driver_sql("ALTER TABLE detections ADD COLUMN estimated_cost FLOAT DEFAULT 0.0;")
            if "recommended_action" not in detection_cols:
                logger.info("Migrating: Adding 'recommended_action' to 'detections' table.")
                conn.exec_driver_sql("ALTER TABLE detections ADD COLUMN recommended_action VARCHAR(255) DEFAULT '';")

            # 3. Ensure defaults and backfill any pre-existing rows
            conn.exec_driver_sql("UPDATE inspections SET total_estimated_cost = 0.0 WHERE total_estimated_cost IS NULL;")
            conn.exec_driver_sql("UPDATE inspections SET overall_severity = 'NONE' WHERE overall_severity IS NULL;")
            conn.exec_driver_sql("UPDATE inspections SET overall_priority = 'NONE' WHERE overall_priority IS NULL;")

            conn.exec_driver_sql("""
                UPDATE detections
                SET severity = 'MEDIUM', priority = 'MEDIUM', estimated_cost = 3000.0, recommended_action = 'Resurface the damaged road section.'
                WHERE class_name = 'patchy road section' AND (estimated_cost IS NULL OR estimated_cost = 0.0);
            """)
            conn.exec_driver_sql("""
                UPDATE inspections
                SET total_estimated_cost = 3000.0, overall_severity = 'MEDIUM', overall_priority = 'MEDIUM'
                WHERE id = 1 AND detection_count = 1 AND total_estimated_cost = 0.0;
            """)

            conn.commit()
            logger.info("Database migration check completed successfully.")
    except Exception as e:
        logger.error(f"Database migration error: {e}", exc_info=True)
