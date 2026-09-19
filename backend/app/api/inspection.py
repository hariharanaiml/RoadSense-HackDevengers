import io
import logging
from typing import Any, Dict
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError
from app.services.yolo_service import yolo_service

logger = logging.getLogger("inspection_api")
router = APIRouter(prefix="/api/inspection", tags=["Inspection"])

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/jpg"}


@router.post("/analyze", summary="Analyze Road Damage Image with Real YOLO")
async def analyze_road_damage(image: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Accepts an uploaded image, validates its format and integrity using Pillow,
    and runs real inference using the loaded YOLO model.
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
            detail=f"Unsupported file extension. Allowed formats: JPEG, JPG, PNG."
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
        # Verify basic image headers
        pil_image.verify()
        # Re-open after verify() because verify() can leave the file in an unusable state for further reading
        pil_image = Image.open(io.BytesIO(content))
        
        # Check detected format
        format_name = pil_image.format
        if format_name not in ("JPEG", "PNG"):
            logger.warning(f"Analyze request rejected: Pillow detected format '{format_name}' not in [JPEG, PNG].")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported image format: '{format_name}'. Only JPEG, JPG, and PNG are supported."
            )
            
        # Convert to RGB to standardize color space for YOLO inference
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
        logger.info(f"YOLO inference completed successfully. Found {len(detections)} detections.")
        return {
            "success": True,
            "detection_count": len(detections),
            "detections": detections
        }
    except Exception as e:
        logger.error(f"Inference execution failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during road damage AI inference."
        )
