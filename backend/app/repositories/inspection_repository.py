import logging
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session, joinedload
from app.db.models import Inspection, Detection

logger = logging.getLogger("inspection_repository")


class InspectionRepository:
    @staticmethod
    def create_inspection_with_detections(
        db: Session,
        image_filename: str,
        detection_count: int,
        detections: List[Dict[str, Any]]
    ) -> Inspection:
        """
        Atomically creates an Inspection and its associated Detection records.
        Rolls back the transaction if any database error occurs.
        """
        try:
            inspection = Inspection(
                image_filename=image_filename,
                detection_count=detection_count
            )
            db.add(inspection)
            db.flush()  # Populates inspection.id for detections

            for item in detections:
                bbox = item.get("bbox", {})
                detection = Detection(
                    inspection_id=inspection.id,
                    class_id=item["class_id"],
                    class_name=item["class_name"],
                    confidence=item["confidence"],
                    x1=bbox.get("x1", 0.0),
                    y1=bbox.get("y1", 0.0),
                    x2=bbox.get("x2", 0.0),
                    y2=bbox.get("y2", 0.0)
                )
                db.add(detection)

            db.commit()
            db.refresh(inspection)
            logger.info(f"Persisted Inspection ID={inspection.id} with {len(detections)} detections.")
            return inspection
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to persist inspection record: {e}", exc_info=True)
            raise

    @staticmethod
    def get_all(db: Session, limit: int = 50) -> List[Inspection]:
        """
        Retrieves recent inspection records sorted newest first up to the given limit.
        """
        return (
            db.query(Inspection)
            .order_by(Inspection.created_at.desc(), Inspection.id.desc())
            .limit(limit)
            .all()
        )

    @staticmethod
    def get_by_id(db: Session, inspection_id: int) -> Optional[Inspection]:
        """
        Retrieves a single Inspection by ID along with its associated Detections.
        """
        return (
            db.query(Inspection)
            .options(joinedload(Inspection.detections))
            .filter(Inspection.id == inspection_id)
            .first()
        )
