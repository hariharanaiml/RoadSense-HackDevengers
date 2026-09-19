import io
import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from PIL import Image, UnidentifiedImageError
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.repositories.inspection_repository import InspectionRepository
from app.services.road_intelligence import apply_road_intelligence
from app.services.yolo_service import yolo_service

logger = logging.getLogger("inspection_api")
router = APIRouter(prefix="/api/inspection", tags=["Inspection"])

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}


@router.post("/analyze", summary="Analyze Road Damage with Intelligence and Store Inspection")
async def analyze_road_damage(
    image: UploadFile = File(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Accepts an uploaded image, validates format and integrity using Pillow,
    runs real YOLO inference, applies Road Intelligence rules (severity, priority,
    estimated cost, recommended action), and persists everything to SQLite.
    """
    if not image or not image.filename:
        logger.warning("Analyze request rejected: missing filename or file.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An image file must be uploaded."
        )

    # 0. Validate geographic coordinates if supplied (Milestone 5)
    if (latitude is None and longitude is not None) or (latitude is not None and longitude is None):
        logger.warning("Analyze request rejected: latitude and longitude must be provided together.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Latitude and longitude must be provided together."
        )

    if latitude is not None and not (-90.0 <= latitude <= 90.0):
        logger.warning(f"Analyze request rejected: invalid latitude {latitude}.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Latitude must be between -90 and 90 degrees."
        )

    if longitude is not None and not (-180.0 <= longitude <= 180.0):
        logger.warning(f"Analyze request rejected: invalid longitude {longitude}.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Longitude must be between -180 and 180 degrees."
        )

    # 1. Validate file extension
    filename_lower = image.filename.lower()
    has_valid_extension = any(filename_lower.endswith(ext) for ext in ALLOWED_EXTENSIONS)
    if not has_valid_extension:
        logger.warning(f"Analyze request rejected: unsupported extension in filename '{image.filename}'.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file extension. Allowed formats: JPEG, JPG, PNG."
        )

    # 2. Read file contents into memory
    try:
        content = await image.read()
    except Exception as e:
        logger.error(f"Failed to read uploaded image bytes: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to read the uploaded image."
        )

    if not content or len(content) == 0:
        logger.warning("Analyze request rejected: empty file uploaded.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded image file is empty."
        )

    # 3. Validate actual image format and integrity using Pillow
    try:
        pil_image = Image.open(io.BytesIO(content))
        pil_image.verify()
        pil_image = Image.open(io.BytesIO(content))

        format_name = pil_image.format
        if format_name not in ("JPEG", "PNG"):
            logger.warning(f"Analyze request rejected: Pillow detected format '{format_name}' not in [JPEG, PNG].")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported image format: '{format_name}'. Only JPEG, JPG, and PNG are supported."
            )

        pil_image = pil_image.convert("RGB")
    except UnidentifiedImageError:
        logger.warning("Analyze request rejected: content cannot be identified as a valid image.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is not a valid image or is corrupt."
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Image validation error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not process or validate the uploaded image."
        )

    # 4. Ensure YOLO model is loaded
    if not yolo_service.is_loaded():
        logger.error("YOLO inference service requested but model is not loaded.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="YOLO road-damage detection model is currently unavailable."
        )

    # 5. Run real YOLO inference
    try:
        raw_detections = yolo_service.predict(pil_image)
        detection_count = len(raw_detections)
        logger.info(f"YOLO inference successful. Detected {detection_count} damage instances.")
    except Exception as e:
        logger.error(f"Inference execution failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during road damage AI inference."
        )

    # 6. Apply Road Intelligence rules (Severity, Priority, Cost, Action)
    enriched_detections, summary = apply_road_intelligence(raw_detections)
    total_estimated_cost = summary["total_estimated_cost"]
    overall_severity = summary["overall_severity"]
    overall_priority = summary["overall_priority"]

    # 7. Persist Inspection and Detection records into SQLite
    try:
        inspection = InspectionRepository.create_inspection_with_detections(
            db=db,
            image_filename=image.filename,
            detection_count=detection_count,
            total_estimated_cost=total_estimated_cost,
            overall_severity=overall_severity,
            overall_priority=overall_priority,
            detections=enriched_detections,
            latitude=latitude,
            longitude=longitude
        )
    except Exception as e:
        logger.error(f"Database persistence failure for '{image.filename}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist inspection record to the database."
        )

    return {
        "success": True,
        "inspection_id": inspection.id,
        "detection_count": detection_count,
        "total_estimated_cost": total_estimated_cost,
        "overall_severity": overall_severity,
        "overall_priority": overall_priority,
        "latitude": inspection.latitude,
        "longitude": inspection.longitude,
        "detections": enriched_detections
    }


ALLOWED_SEVERITIES = {"HIGH", "MEDIUM", "LOW", "NONE", "ALL"}


@router.get("/stats", summary="Get Global Inspection Statistics")
def get_inspection_stats(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Returns aggregate statistics across the entire database, including total inspections,
    total detections, total estimated cost, severity & priority distributions,
    defect frequencies, and GPS coverage.
    """
    return InspectionRepository.get_stats(db=db)


@router.get("/history", summary="Get Inspection History")
def get_inspection_history(
    limit: int = Query(default=50, ge=1, le=100, description="Maximum inspections to return"),
    offset: int = Query(default=0, ge=0, description="Offset for pagination"),
    severity: Optional[str] = Query(default=None, description="Filter by overall severity (HIGH, MEDIUM, LOW, NONE, ALL)"),
    has_gps: Optional[bool] = Query(default=None, description="Filter by presence of GPS coordinates"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Returns previously stored inspections sorted newest first, supporting pagination (limit/offset)
    and server-side filters (severity, has_gps).
    """
    if severity is not None:
        sev_clean = severity.strip().upper()
        if sev_clean not in ALLOWED_SEVERITIES:
            logger.warning(f"Invalid severity filter '{severity}' requested.")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid severity filter '{severity}'. Allowed values: HIGH, MEDIUM, LOW, NONE, ALL."
            )

    inspections, total = InspectionRepository.get_all_paginated(
        db=db,
        limit=limit,
        offset=offset,
        severity=severity,
        has_gps=has_gps
    )

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "inspections": [
            {
                "id": insp.id,
                "image_filename": insp.image_filename,
                "created_at": insp.created_at.isoformat() if insp.created_at else None,
                "detection_count": insp.detection_count,
                "total_estimated_cost": insp.total_estimated_cost,
                "overall_severity": insp.overall_severity,
                "overall_priority": insp.overall_priority,
                "latitude": insp.latitude,
                "longitude": insp.longitude
            }
            for insp in inspections
        ]
    }



@router.get("/{inspection_id}", summary="Get Inspection by ID")
def get_inspection(
    inspection_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Retrieves a single inspection record and all its associated detections with Road Intelligence fields
    and geographic coordinates.
    Returns 404 if the inspection ID is not found.
    """
    inspection = InspectionRepository.get_by_id(db=db, inspection_id=inspection_id)
    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inspection with ID {inspection_id} not found."
        )

    return {
        "id": inspection.id,
        "image_filename": inspection.image_filename,
        "created_at": inspection.created_at.isoformat() if inspection.created_at else None,
        "detection_count": inspection.detection_count,
        "total_estimated_cost": inspection.total_estimated_cost,
        "overall_severity": inspection.overall_severity,
        "overall_priority": inspection.overall_priority,
        "latitude": inspection.latitude,
        "longitude": inspection.longitude,
        "detections": [
            {
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
            }
            for det in inspection.detections
        ]
    }
