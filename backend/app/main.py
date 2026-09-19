import logging
from contextlib import asynccontextmanager
from typing import Any, Dict
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.inspection import router as inspection_router
from app.services.yolo_service import yolo_service

# Setup root logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager to handle startup and shutdown."""
    logger.info("Initializing RoadSense AI Backend (HackDevengers 2.0)...")
    if yolo_service.is_loaded():
        logger.info(f"YOLO model ready with {len(yolo_service.get_classes())} classes: {yolo_service.get_classes()}")
    else:
        logger.warning("YOLO model failed to load at startup!")
    yield
    logger.info("Shutting down RoadSense AI Backend...")


app = FastAPI(
    title="RoadSense AI - Hack Devengers Backend",
    description="Real YOLO-powered road damage inspection API",
    version="2.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(inspection_router)


@app.get("/api/health", summary="Health and Model Status")
def health_check() -> Dict[str, Any]:
    """
    Returns backend health and real YOLO model loading status,
    including the actual class names retrieved directly from best.pt.
    """
    model_loaded = yolo_service.is_loaded()
    classes = yolo_service.get_classes()

    return {
        "status": "ok",
        "ai_enabled": True,
        "model_loaded": model_loaded,
        "classes": classes
    }


@app.get("/", summary="Root Endpoint")
def root_endpoint() -> Dict[str, str]:
    return {
        "message": "RoadSense AI HackDevengers Backend is running.",
        "docs": "/docs",
        "health": "/api/health"
    }
