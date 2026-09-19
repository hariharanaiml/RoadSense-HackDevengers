import io
import logging
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from PIL import Image, UnidentifiedImageError
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.repositories.inspection_repository import InspectionRepository
from app.services.yolo_service import yolo_service

logger = logging.getLogger("inspection_api")
router = APIRouter(prefix="/api/inspection", tags=["Inspection"])

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}


@router.post("/analyze", summary="Analyze Road Damage and Store Inspection")
async def analyze_road_damage(
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Accepts an uploaded image, validates format and integrity using Pillow,
    runs real YOLO inference, and persists the inspection and detection records to SQLite.
    """
    if not image or not image.filename:
        logger.warning("Analyze request rejected: missing filename or file.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An image file must be uploaded."
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
        # Re-open after verify() because verify() can leave the file descriptor unusable
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
        detections = yolo_service.predict(pil_image)
        detection_count = len(detections)
        logger.info(f"YOLO inference successful. Detected {detection_count} damage instances.")
    except Exception as e:
        logger.error(f"Inference execution failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during road damage AI inference."
        )

    # 6. Persist Inspection and Detection records into SQLite
    try:
        inspection = InspectionRepository.create_inspection_with_detections(
            db=db,
            image_filename=image.filename,
            detection_count=detection_count,
            detections=detections
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
        "detections": detections
    }


@router.get("/history", summary="Get Inspection History")
def get_inspection_history(
    limit: int = Query(default=50, ge=1, le=100, description="Maximum inspections to return"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Returns previously stored inspections sorted newest first.
    """
    inspections = InspectionRepository.get_all(db=db, limit=limit)
    return {
        "inspections": [
            {
                "id": insp.id,
                "image_filename": insp.image_filename,
                "created_at": insp.created_at.isoformat() if insp.created_at else None,
                "detection_count": insp.detection_count
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
    Retrieves a single inspection record and all its associated detections.
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
                }
            }
            for det in inspection.detections
        ]
    }
