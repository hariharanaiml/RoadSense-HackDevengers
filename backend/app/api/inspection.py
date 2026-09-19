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

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB limit


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
            detail="Unsupported file extension. Allowed formats: JPEG, JPG, PNG, WEBP, BMP."
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

    if len(content) > MAX_IMAGE_SIZE_BYTES:
        logger.warning(f"Analyze request rejected: file size ({len(content)} bytes) exceeds limit.")
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="The uploaded image exceeds the 20MB size limit."
        )

    # 3. Validate actual image format and integrity using Pillow
    try:
        pil_image = Image.open(io.BytesIO(content))
        pil_image.verify()
        pil_image = Image.open(io.BytesIO(content))

        format_name = pil_image.format
        if format_name not in ("JPEG", "PNG", "WEBP", "BMP"):
            logger.warning(f"Analyze request rejected: Pillow detected format '{format_name}' not in allowed list.")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported image format: '{format_name}'. Only JPEG, JPG, PNG, WEBP, and BMP are supported."
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

    formatted = InspectionRepository.format_inspection_dict(inspection)
    formatted["success"] = True
    formatted["inspection_id"] = inspection.id
    return formatted


ALLOWED_SEVERITIES = {"HIGH", "MEDIUM", "LOW", "NONE", "ALL"}


@router.get("/stats", summary="Get Global Inspection Statistics")
def get_inspection_stats(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Returns aggregate statistics across the entire database, including total inspections,
    total detections, total estimated cost, severity & priority distributions,
    defect frequencies, GPS coverage, average risk score, critical road count, and active hotspots.
    """
    return InspectionRepository.get_stats(db=db)


@router.get("/priority-queue", summary="Get Maintenance Priority Queue")
def get_priority_queue(
    limit: int = Query(default=10, ge=1, le=50, description="Max priority items to return"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Returns the top inspection items requiring urgent maintenance attention,
    sorted deterministically by Risk Score and Repair Cost.
    """
    queue_items = InspectionRepository.get_priority_queue(db=db, limit=limit)
    return {
        "count": len(queue_items),
        "items": queue_items
    }


@router.get("/hotspots", summary="Get AI Road Defect Hotspot Clusters")
def get_road_hotspots(
    radius_km: float = Query(default=0.5, ge=0.1, le=10.0, description="Clustering radius in km"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Performs spatial proximity clustering on GPS-enabled road inspections
    to identify defect hotspot zones for municipal action.
    """
    from app.services.hotspot_service import detect_hotspots
    inspections, _ = InspectionRepository.get_all_paginated(db=db, limit=500, offset=0)
    formatted_list = [InspectionRepository.format_inspection_dict(insp) for insp in inspections]
    hotspots = detect_hotspots(formatted_list, radius_km=radius_km)
    return {
        "count": len(hotspots),
        "radius_km": radius_km,
        "hotspots": hotspots
    }


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
    and server-side filters (severity, has_gps), enriched with Road Risk Score & Recommendations.
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
            InspectionRepository.format_inspection_dict(insp)
            for insp in inspections
        ]
    }


@router.get("/{inspection_id}", summary="Get Inspection by ID")
def get_inspection(
    inspection_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Retrieves a single inspection record and all its associated detections with Road Intelligence fields,
    geographic coordinates, Risk Score, Maintenance Recommendations, and Explainability.
    """
    inspection = InspectionRepository.get_by_id(db=db, inspection_id=inspection_id)
    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inspection with ID {inspection_id} not found."
        )

    return InspectionRepository.format_inspection_dict(inspection)


@router.get("/{inspection_id}/comparison", summary="Get Before/After Historical Inspection Comparison")
def get_inspection_comparison(
    inspection_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Compares the requested inspection with its previous historical baseline inspection.
    Calculates condition improvement / deterioration metrics.
    """
    current = InspectionRepository.get_by_id(db=db, inspection_id=inspection_id)
    if not current:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inspection with ID {inspection_id} not found."
        )

    current_data = InspectionRepository.format_inspection_dict(current)
    previous_data = InspectionRepository.get_previous_inspection(db=db, current_id=inspection_id)

    if not previous_data:
        return {
            "has_previous": False,
            "message": "No previous inspection baseline available for comparison.",
            "current": current_data,
            "previous": None,
            "comparison": None
        }

    # Compute comparative metrics
    prev_risk = previous_data["risk_score"]
    curr_risk = current_data["risk_score"]
    risk_diff = curr_risk - prev_risk
    
    prev_defects = previous_data["detection_count"]
    curr_defects = current_data["detection_count"]
    defect_diff = curr_defects - prev_defects

    if prev_risk > 0:
        improvement_pct = round(((prev_risk - curr_risk) / prev_risk) * 100.0, 1)
    else:
        improvement_pct = 0.0 if curr_risk == 0 else -100.0

    status_label = "IMPROVED" if risk_diff < 0 else ("DETERIORATED" if risk_diff > 0 else "UNCHANGED")

    return {
        "has_previous": True,
        "message": f"Historical comparison against Inspection #{previous_data['id']}.",
        "current": current_data,
        "previous": previous_data,
        "comparison": {
            "status": status_label,
            "improvement_percentage": improvement_pct,
            "risk_score_change": risk_diff,
            "defect_count_change": defect_diff,
            "cost_change": round(current_data["total_estimated_cost"] - previous_data["total_estimated_cost"], 2)
        }
    }

