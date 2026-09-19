import logging
import os
from contextlib import asynccontextmanager
from typing import Any, Dict
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.inspection import router as inspection_router
from app.db.database import init_db
from app.services.yolo_service import yolo_service

# Setup root logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown."""
    logger.info("Initializing RoadSense AI Backend (HackDevengers 2.0)...")
    
    # 1. Initialize database tables
    try:
        init_db()
        logger.info("SQLite database tables verified/initialized.")
    except Exception as e:
        logger.error(f"Failed to initialize SQLite database: {e}", exc_info=True)

    # 2. Check YOLO model status
    if yolo_service.is_loaded():
        logger.info(f"YOLO model ready with {len(yolo_service.get_classes())} classes: {yolo_service.get_classes()}")
    else:
        logger.warning("YOLO model failed to load at startup!")
        
    yield
    logger.info("Shutting down RoadSense AI Backend...")


app = FastAPI(
    title="RoadSense AI - Hack Devengers Backend",
    description="Real YOLO-powered road damage inspection API with SQLite persistence",
    version="2.0.0",
    lifespan=lifespan
)

# CORS configuration
cors_origins_raw = os.getenv("CORS_ORIGINS", "*")
cors_origins = [orig.strip() for orig in cors_origins_raw.split(",") if orig.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins if "*" not in cors_origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Mount Routers
app.include_router(inspection_router)


@app.get("/api/health", summary="Health and Model Status")
def health_check() -> Dict[str, Any]:
    """
    Returns backend health, database status, and real YOLO model loading status,
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


from pathlib import Path
from fastapi.staticfiles import StaticFiles

frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists() and (frontend_dist / "index.html").exists():
    logger.info(f"Mounting production frontend build from: {frontend_dist}")
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
else:
    @app.get("/", summary="Root Endpoint")
    def root_endpoint() -> Dict[str, str]:
        return {
            "message": "RoadSense AI HackDevengers Backend is running.",
            "docs": "/docs",
            "health": "/api/health"
        }
