import logging
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload
from app.db.models import Inspection, Detection

logger = logging.getLogger("inspection_repository")


class InspectionRepository:
    @staticmethod
    def create_inspection_with_detections(
        db: Session,
        image_filename: str,
        detection_count: int,
        total_estimated_cost: float,
        overall_severity: str,
        overall_priority: str,
        detections: List[Dict[str, Any]],
        latitude: Optional[float] = None,
        longitude: Optional[float] = None
    ) -> Inspection:
        """
        Atomically creates an Inspection and its associated Detection records,
        including all road intelligence attributes (severity, priority, cost, recommendations)
        and optional geographic coordinates (latitude, longitude).
        Rolls back the transaction if any database error occurs.
        """
        try:
            inspection = Inspection(
                image_filename=image_filename,
                detection_count=detection_count,
                total_estimated_cost=total_estimated_cost,
                overall_severity=overall_severity,
                overall_priority=overall_priority,
                latitude=latitude,
                longitude=longitude
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
                    y2=bbox.get("y2", 0.0),
                    severity=item.get("severity", "LOW"),
                    priority=item.get("priority", "LOW"),
                    estimated_cost=float(item.get("estimated_cost", 0.0)),
                    recommended_action=item.get("recommended_action", "")
                )
                db.add(detection)

            db.commit()
            db.refresh(inspection)
            logger.info(
                f"Persisted Inspection ID={inspection.id} | "
                f"Count={detection_count} | Cost={total_estimated_cost} | "
                f"Severity={overall_severity} | Priority={overall_priority}"
            )
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
    def get_all_paginated(
        db: Session,
        limit: int = 50,
        offset: int = 0,
        severity: Optional[str] = None,
        has_gps: Optional[bool] = None
    ) -> Tuple[List[Inspection], int]:
        """
        Retrieves paginated and filtered inspections sorted newest first,
        along with the total matching record count before pagination.
        """
        query = db.query(Inspection)

        if severity:
            sev_norm = severity.strip().upper()
            if sev_norm != "ALL":
                query = query.filter(func.upper(Inspection.overall_severity) == sev_norm)

        if has_gps is not None:
            if has_gps:
                query = query.filter(Inspection.latitude.isnot(None), Inspection.longitude.isnot(None))
            else:
                query = query.filter(or_(Inspection.latitude.is_(None), Inspection.longitude.is_(None)))

        total = query.count()

        inspections = (
            query
            .order_by(Inspection.created_at.desc(), Inspection.id.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return inspections, total

    @staticmethod
    def get_stats(db: Session) -> Dict[str, Any]:
        """
        Calculates aggregate statistics from the entire database,
        including total counts, costs, severity & priority distributions,
        defect frequencies, and GPS coverage.
        Returns valid zero-valued statistics if the database is empty.
        """
        total_inspections = db.query(func.count(Inspection.id)).scalar() or 0
        total_detections = db.query(func.count(Detection.id)).scalar() or 0
        total_cost = db.query(func.sum(Inspection.total_estimated_cost)).scalar() or 0.0

        # Severity distribution: default keys HIGH, MEDIUM, LOW, NONE
        sev_dist = {"HIGH": 0, "MEDIUM": 0, "LOW": 0, "NONE": 0}
        sev_rows = (
            db.query(Inspection.overall_severity, func.count(Inspection.id))
            .group_by(Inspection.overall_severity)
            .all()
        )
        for sev, count in sev_rows:
            if sev:
                sev_key = sev.strip().upper()
                sev_dist[sev_key] = count

        # Priority distribution: default keys HIGH, MEDIUM, LOW, NONE
        prio_dist = {"HIGH": 0, "MEDIUM": 0, "LOW": 0, "NONE": 0}
        prio_rows = (
            db.query(Inspection.overall_priority, func.count(Inspection.id))
            .group_by(Inspection.overall_priority)
            .all()
        )
        for prio, count in prio_rows:
            if prio:
                prio_key = prio.strip().upper()
                prio_dist[prio_key] = count

        # Defect frequency: from Detection.class_name
        defect_freq: Dict[str, int] = {}
        defect_rows = (
            db.query(Detection.class_name, func.count(Detection.id))
            .group_by(Detection.class_name)
            .order_by(func.count(Detection.id).desc())
            .all()
        )
        for cname, count in defect_rows:
            if cname:
                defect_freq[cname] = count

        # GPS coverage:
        with_gps = (
            db.query(func.count(Inspection.id))
            .filter(Inspection.latitude.isnot(None), Inspection.longitude.isnot(None))
            .scalar()
            or 0
        )
        without_gps = total_inspections - with_gps

        return {
            "total_inspections": total_inspections,
            "total_detections": total_detections,
            "total_estimated_cost": round(float(total_cost), 2),
            "severity_distribution": sev_dist,
            "priority_distribution": prio_dist,
            "defect_frequency": defect_freq,
            "gps_coverage": {
                "with_gps": with_gps,
                "without_gps": without_gps
            }
        }

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
