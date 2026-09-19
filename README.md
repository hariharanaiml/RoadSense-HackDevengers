# RoadSense AI — HackDevengers

An automated, AI-powered road infrastructure inspection platform providing real-time surface defect detection, intelligent severity grading, cost estimation, geospatial mapping, and enterprise-grade inspection analytics.

---

## 1. Problem Statement

Traditional road infrastructure monitoring is manual, slow, labor-intensive, and inconsistent. Municipalities, highway authorities, and engineering teams lack scalable, real-time mechanisms to continuously detect roadway defects, assess repair urgency, estimate remediation costs, and spatially prioritize maintenance schedules.

---

## 2. Solution Overview

**RoadSense AI** solves this with an end-to-end computer vision and infrastructure analytics pipeline:
- **Real-Time AI Vision**: Ingests roadway imagery and executes inference using a custom-trained YOLOv8 defect detection model across 7 distinct defect classes.
- **Road Intelligence Engine**: Translates raw machine learning bounding boxes into actionable maintenance recommendations, priority ranking, and automated repair cost estimates.
- **Geographic Mapping**: Leverages browser-native GPS capture and OpenStreetMap via Leaflet to plot geolocated road hazards with severity-coded pins.
- **Historical Audit & Analytics**: Computes database-wide aggregate stats, distributions, defect frequencies, and paginated audit histories with server-side filtering.

---

## 3. Architecture

```text
┌────────────────────────────────────────────────────────┐
│               React + Vite Frontend                    │
│   (Dashboard, Inspect Page, History, Road Map, Detail) │
└───────────────────────────┬────────────────────────────┘
                            │ REST APIs / JSON / FormData
                            ▼
┌────────────────────────────────────────────────────────┐
│                   FastAPI Backend                      │
│   - Image Validation (Format, Pillow Integrity, Size)  │
│   - Geolocation & Bounds Validation                    │
│   - History & Stats Endpoints                          │
└─────────────┬────────────────────────────┬─────────────┘
              │                            │
              ▼                            ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│   YOLOv8 Inference       │  │  Road Intelligence Rules │
│   (PyTorch / Ultralytics)│  │  - Severity Grading       │
│   - 7 Defect Classes     │  │  - Priority Assignment    │
│   - Confidence Scores    │  │  - Cost Estimation        │
│   - Normalized BBoxes    │  │  - Repair Recommendations │
└─────────────┬────────────┘  └────────────┬─────────────┘
              │                            │
              └─────────────┬──────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│             SQLite Relational Database                 │
│   - Inspections Table (Coordinates, Cost, Severity)    │
│   - Detections Table (Class, Box, Priority, Action)    │
└────────────────────────────────────────────────────────┘
```

---

## 4. Key Features

- **YOLOv8 Road Defect Detection**: Detects potholes, alligator cracks, longitudinal cracks, transverse cracks, patchy road sections, lane line blur, and manhole covers.
- **Road Intelligence**: Automated computation of overall severity (`HIGH`, `MEDIUM`, `LOW`, `NONE`), priority level, cumulative repair cost, and engineering actions.
- **Optional GPS Capture**: Geolocation capture with browser permissions, accuracy validation, and graceful degradation for uploads without coordinates.
- **Interactive OpenStreetMap Visualization**: Interactive Leaflet map with dynamic severity-colored markers, defect summaries, and direct detail navigation.
- **Full Database Analytics**: `GET /api/inspection/stats` returns real-time defect frequency distributions, risk counts, GPS coverage, and cumulative remediation estimates.
- **Server-Side Paginated History**: `GET /api/inspection/history` with `limit`, `offset`, `severity`, and `has_gps` filters for scalable database querying.
- **Responsive Web Interface**: Optimized for desktop, tablet, and mobile with card fallbacks for tabular data.

---

## 5. Technology Stack

- **Backend**: Python 3.10+, FastAPI, Uvicorn, SQLAlchemy, Pillow, Ultralytics YOLOv8, PyTorch
- **Frontend**: React 18, Vite, Leaflet, React-Leaflet, Lucide React icons
- **Database**: SQLite (SQLAlchemy ORM with transactional persistence)
- **Testing**: Pytest, Starlette TestClient, Requests

---

## 6. Project Structure

```text
RoadSense-HackDevengers/
├── .env.example                     # Environment variables template
├── .gitignore                       # Ignored build and local artifacts
├── README.md                        # Documentation
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── inspection.py        # Analysis, history, stats, and detail routes
│   │   ├── db/
│   │   │   ├── database.py          # SQLAlchemy engine, session, and migration
│   │   │   └── models.py            # Inspection and Detection ORM models
│   │   ├── repositories/
│   │   │   └── inspection_repository.py  # DB queries, pagination, aggregates
│   │   ├── services/
│   │   │   ├── road_intelligence.py # Cost, severity, priority calculation
│   │   │   └── yolo_service.py      # YOLOv8 singleton inference loader
│   │   └── main.py                  # FastAPI application & CORS setup
│   ├── models/
│   │   └── best.pt                  # Trained YOLOv8 road-defect weights
│   ├── requirements.txt             # Python dependencies
│   ├── test_milestone3.py           # Milestone 3 regression test suite
│   ├── test_milestone5.py           # Milestone 5 GPS/Map regression suite
│   ├── test_milestone6.py           # Milestone 6 Integration test suite
│   └── test_milestone6_unit.py      # Milestone 6 in-memory unit tests
└── frontend/
    ├── src/
    │   ├── components/              # Layout, Badges, DetectionCard, States
    │   ├── pages/                   # Dashboard, InspectPage, History, Map, Detail
    │   ├── services/api.js          # Unified API client
    │   ├── utils/format.js          # Formatting helpers
    │   └── index.css                # Production CSS design system
    ├── package.json
    └── vite.config.js               # Dev server & reverse proxy config
```

---

## 7. Installation & Local Setup

### Prerequisites
- Python 3.10 or higher
- Node.js 18 or higher & npm

### 1. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows:
.\.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run backend server
uvicorn app.main:app --port 8000 --host 127.0.0.1
```
The API is available at `http://127.0.0.1:8000` (Interactive docs at `http://127.0.0.1:8000/docs`).

### 2. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```
The web dashboard opens at `http://localhost:5173`.

---

## 8. Environment Variables

Create a `.env` file in the project root or configure these variables in production:

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `PORT` | `8000` | Backend port |
| `HOST` | `127.0.0.1` | Backend host binding |
| `DATABASE_URL` | `sqlite:///roadsense.db` | SQLAlchemy connection string |
| `YOLO_MODEL_PATH` | `models/best.pt` | Path to YOLO model weights |
| `YOLO_CONFIDENCE_THRESHOLD` | `0.25` | Minimum confidence score for defect detection |
| `CORS_ORIGINS` | `*` | Allowed CORS origins (comma-separated) |
| `VITE_API_URL` | `""` | Production frontend API base URL (empty uses Vite proxy) |

---

## 9. API Reference

### Health Check
- `GET /api/health`
  - Returns engine status, model status, and detected defect classes.

### Analyze Image
- `POST /api/inspection/analyze`
  - **Body (multipart/form-data)**: `image` (JPEG/PNG/WEBP/BMP, max 20MB), `latitude` (optional), `longitude` (optional).
  - **Response**: Detection results, bounding boxes, road intelligence summary, and inspection ID.

### Global Statistics
- `GET /api/inspection/stats`
  - **Response**: Entire database metrics: total inspections, total detections, cumulative repair cost, severity distribution, priority distribution, defect frequency, and GPS coverage.

### Inspection History
- `GET /api/inspection/history?limit=20&offset=0&severity=HIGH&has_gps=true`
  - **Query Params**: `limit` (1–100), `offset` (>=0), `severity` (HIGH/MEDIUM/LOW/NONE/ALL), `has_gps` (true/false).
  - **Response**: `{ "total": N, "offset": N, "limit": N, "inspections": [...] }`.

### Inspection Detail
- `GET /api/inspection/{id}`
  - **Response**: Complete inspection details including all individual detection boxes and road intelligence metrics.

---

## 10. Automated Testing

Run the comprehensive test suites from the project directory:

```bash
# Full Pytest Suite (Unit + Integration)
.\backend\.venv\Scripts\python.exe -m pytest -v

# Milestone 6 Unit Tests (Runs without server)
.\backend\.venv\Scripts\python.exe -m pytest backend/test_milestone6_unit.py -v

# Regression Integration Suites (Requires server running on port 8000)
.\backend\.venv\Scripts\python.exe backend/test_milestone3.py
.\backend\.venv\Scripts\python.exe backend/test_milestone5.py
.\backend\.venv\Scripts\python.exe backend/test_milestone6.py

# Frontend Production Build Test
cd frontend && npm run build
```

---

## 11. Production Deployment

### Production Backend Execution
Run Uvicorn with multiple workers or behind Gunicorn / Nginx:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
```

### Production Frontend Build
```bash
cd frontend
npm run build
```
Serve the generated `dist/` directory via Nginx, Caddy, Vercel, or Netlify with `VITE_API_URL` pointed to your backend domain.
