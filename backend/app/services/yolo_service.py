import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv
from PIL import Image
from ultralytics import YOLO

# Setup logger
logger = logging.getLogger("yolo_service")
logging.basicConfig(level=logging.INFO)

# Load environment variables
backend_dir = Path(__file__).resolve().parent.parent.parent
env_path = backend_dir / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

# Read confidence threshold
try:
    DEFAULT_CONFIDENCE_THRESHOLD = float(os.getenv("YOLO_CONFIDENCE_THRESHOLD", "0.25"))
except ValueError:
    logger.warning("Invalid YOLO_CONFIDENCE_THRESHOLD in environment. Defaulting to 0.25")
    DEFAULT_CONFIDENCE_THRESHOLD = 0.25

MODEL_PATH = Path(os.getenv("YOLO_MODEL_PATH", str(backend_dir / "models" / "best.pt")))


class YOLOService:
    _instance: Optional["YOLOService"] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(YOLOService, cls).__new__(cls)
            cls._instance._model: Optional[YOLO] = None
            cls._instance._model_loaded: bool = False
            cls._instance._class_names: Dict[int, str] = {}
            cls._instance._conf_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD
            cls._instance._initialize_model()
        return cls._instance

    def _initialize_model(self) -> None:
        """Loads the YOLO model once at service startup."""
        try:
            if not MODEL_PATH.exists():
                logger.error(f"YOLO model file not found at: {MODEL_PATH}")
                self._model_loaded = False
                return

            logger.info(f"Loading YOLO model from: {MODEL_PATH} (confidence: {self._conf_threshold})")
            self._model = YOLO(str(MODEL_PATH))
            self._model_loaded = True
            
            # Read class names directly from the model
            if hasattr(self._model, "names") and isinstance(self._model.names, dict):
                self._class_names = self._model.names
            else:
                self._class_names = {}
                
            logger.info(f"YOLO model successfully loaded with {len(self._class_names)} classes.")
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}", exc_info=True)
            self._model = None
            self._model_loaded = False
            self._class_names = {}

    def is_loaded(self) -> bool:
        """Returns whether the YOLO model is currently loaded and ready."""
        return self._model_loaded and self._model is not None

    def get_classes(self) -> List[str]:
        """Returns the list of class names extracted directly from the loaded model."""
        if not self.is_loaded():
            return []
        # Return sorted list of class names by class ID
        return [self._class_names[k] for k in sorted(self._class_names.keys())]

    def get_class_dict(self) -> Dict[int, str]:
        """Returns the dictionary mapping class IDs to class names."""
        return dict(self._class_names)

    def get_status(self) -> Dict[str, Any]:
        """Returns current YOLO status and metadata."""
        return {
            "model_loaded": self.is_loaded(),
            "confidence_threshold": self._conf_threshold,
            "classes": self.get_classes(),
            "num_classes": len(self._class_names),
            "model_path": str(MODEL_PATH)
        }

    def predict(self, image: Image.Image, conf_threshold: Optional[float] = None) -> List[Dict[str, Any]]:
        """
        Runs real YOLO inference on a PIL Image.
        Returns a list of structured detections.
        Does NOT reload the model.
        """
        if not self.is_loaded():
            raise RuntimeError("YOLO model is not loaded or unavailable.")

        threshold = conf_threshold if conf_threshold is not None else self._conf_threshold
        logger.info(f"Running YOLO inference with conf_threshold={threshold}")

        # Run inference using the pre-loaded YOLO model
        results = self._model.predict(source=image, conf=threshold, verbose=False)

        detections: List[Dict[str, Any]] = []
        if not results:
            return detections

        first_result = results[0]
        boxes = first_result.boxes

        if boxes is None or len(boxes) == 0:
            return detections

        for box in boxes:
            cls_id = int(box.cls[0].item())
            confidence = float(box.conf[0].item())
            coords = box.xyxy[0].tolist()  # [x1, y1, x2, y2]

            class_name = self._class_names.get(cls_id, f"class_{cls_id}")

            detection = {
                "class_id": cls_id,
                "class_name": class_name,
                "confidence": round(confidence, 4),
                "bbox": {
                    "x1": round(coords[0], 2),
                    "y1": round(coords[1], 2),
                    "x2": round(coords[2], 2),
                    "y2": round(coords[3], 2)
                }
            }
            detections.append(detection)

        return detections


# Singleton instance accessible throughout the backend
yolo_service = YOLOService()
