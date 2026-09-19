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

        # Calculate high-risk count and aggregate stats
        all_inspections = db.query(Inspection).options(joinedload(Inspection.detections)).all()
        risk_scores = []
        critical_count = 0
        formatted_list = []

        for insp in all_inspections:
            f_item = InspectionRepository.format_inspection_dict(insp)
            formatted_list.append(f_item)
            r_score = f_item["risk_score"]
            risk_scores.append(r_score)
            if r_score >= 81 or f_item["overall_severity"] == "HIGH":
                critical_count += 1

        avg_risk = round(sum(risk_scores) / len(risk_scores), 1) if risk_scores else 0.0

        # Calculate active hotspots
        from app.services.hotspot_service import detect_hotspots
        hotspots = detect_hotspots(formatted_list)

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
            },
            "average_risk_score": avg_risk,
            "critical_roads_count": critical_count,
            "active_hotspots_count": len(hotspots)
        }

    @staticmethod
    def format_inspection_dict(insp: Inspection) -> Dict[str, Any]:
        """
        Converts an Inspection DB model into a rich dictionary including
        Road Intelligence, Risk Score (0-100), Maintenance Recommendation (P1-P4),
        and AI Explainability.
        """
        from app.services.risk_engine import calculate_risk_score, generate_maintenance_recommendation, generate_explainability

        detections_data = []
        if insp.detections:
            for det in insp.detections:
                detections_data.append({
                    "class_id": det.class_id,
                    "class_name": det.class_name,
                    "confidence": det.confidence,
                    "bbox": {
                        "x1": det.x1,
                        "y1": det.y1,
                        "x2": det.x2,
                        "y2": det.y2
                    },
                    "severity": det.severity,
                    "priority": det.priority,
                    "estimated_cost": det.estimated_cost,
                    "recommended_action": det.recommended_action
                })

        risk_info = calculate_risk_score(
            detections=detections_data,
            overall_severity=insp.overall_severity,
            overall_priority=insp.overall_priority
        )

        has_gps = insp.latitude is not None and insp.longitude is not None

        recommendation = generate_maintenance_recommendation(
            risk_score=risk_info["risk_score"],
            overall_severity=insp.overall_severity,
            detection_count=insp.detection_count,
            total_cost=insp.total_estimated_cost,
            has_gps=has_gps
        )

        explainability = generate_explainability(
            detections=detections_data,
            risk_data=risk_info,
            recommendation=recommendation
        )

        road_name = f"Inspection #{insp.id}"
        if has_gps:
            road_name = f"GPS Site #{insp.id} ({round(insp.latitude, 4)}, {round(insp.longitude, 4)})"

        return {
            "id": insp.id,
            "image_filename": insp.image_filename,
            "created_at": insp.created_at.isoformat() if insp.created_at else None,
            "detection_count": insp.detection_count,
            "total_estimated_cost": insp.total_estimated_cost,
            "overall_severity": insp.overall_severity,
            "overall_priority": insp.overall_priority,
            "latitude": insp.latitude,
            "longitude": insp.longitude,
            "road_name": road_name,
            "risk_score": risk_info["risk_score"],
            "risk_level": risk_info["risk_level"],
            "risk_factors": risk_info["factors"],
            "maintenance_recommendation": recommendation,
            "explainability": explainability,
            "detections": detections_data
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

    @staticmethod
    def get_priority_queue(db: Session, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Returns the top priority inspection items requiring action, ordered by Risk Score & Cost.
        """
        inspections = db.query(Inspection).options(joinedload(Inspection.detections)).all()
        formatted = [InspectionRepository.format_inspection_dict(i) for i in inspections]
        
        # Filter items that have defects or risk > 0
        active_queue = [item for item in formatted if item["detection_count"] > 0 or item["risk_score"] > 0]
        active_queue.sort(key=lambda x: (x["risk_score"], x["total_estimated_cost"]), reverse=True)
        return active_queue[:limit]

    @staticmethod
    def get_previous_inspection(db: Session, current_id: int) -> Optional[Dict[str, Any]]:
        """
        Finds the most relevant previous historical inspection before current_id.
        If current inspection has GPS, attempts to find the closest prior GPS inspection.
        Otherwise falls back to the immediate preceding inspection by ID.
        """
        current = InspectionRepository.get_by_id(db, current_id)
        if not current:
            return None

        from app.services.hotspot_service import haversine_distance

        prior_inspections = (
            db.query(Inspection)
            .options(joinedload(Inspection.detections))
            .filter(Inspection.id < current_id)
            .order_by(Inspection.id.desc())
            .all()
        )

        if not prior_inspections:
            return None

        if current.latitude is not None and current.longitude is not None:
            # Find nearest prior GPS inspection within 2km
            best_prior = None
            min_dist = float("inf")
            for prior in prior_inspections:
                if prior.latitude is not None and prior.longitude is not None:
                    dist = haversine_distance(current.latitude, current.longitude, prior.latitude, prior.longitude)
                    if dist <= 2.0 and dist < min_dist:
                        min_dist = dist
                        best_prior = prior
            if best_prior:
                return InspectionRepository.format_inspection_dict(best_prior)

        # Fallback to immediate preceding inspection
        return InspectionRepository.format_inspection_dict(prior_inspections[0])

