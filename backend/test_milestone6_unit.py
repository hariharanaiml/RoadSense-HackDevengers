import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.db.database import Base, get_db
from app.repositories.inspection_repository import InspectionRepository
from app.main import app


@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def populated_db(test_db):
    # Record 1: HIGH severity, HIGH priority, 2 detections (pothole, alligator crack), with GPS
    InspectionRepository.create_inspection_with_detections(
        db=test_db,
        image_filename="high_damage_1.jpg",
        detection_count=2,
        total_estimated_cost=8000.0,
        overall_severity="HIGH",
        overall_priority="HIGH",
        detections=[
            {
                "class_id": 0, "class_name": "pothole", "confidence": 0.88,
                "bbox": {"x1": 10, "y1": 10, "x2": 50, "y2": 50},
                "severity": "HIGH", "priority": "HIGH",
                "estimated_cost": 5000.0, "recommended_action": "Deep patch"
            },
            {
                "class_id": 1, "class_name": "alligator crack", "confidence": 0.75,
                "bbox": {"x1": 60, "y1": 60, "x2": 100, "y2": 100},
                "severity": "MEDIUM", "priority": "MEDIUM",
                "estimated_cost": 3000.0, "recommended_action": "Resurfacing"
            }
        ],
        latitude=12.971598,
        longitude=77.594566
    )

    # Record 2: MEDIUM severity, MEDIUM priority, 1 detection (pothole), NO GPS
    InspectionRepository.create_inspection_with_detections(
        db=test_db,
        image_filename="med_damage_2.jpg",
        detection_count=1,
        total_estimated_cost=3000.0,
        overall_severity="MEDIUM",
        overall_priority="MEDIUM",
        detections=[
            {
                "class_id": 0, "class_name": "pothole", "confidence": 0.65,
                "bbox": {"x1": 20, "y1": 20, "x2": 40, "y2": 40},
                "severity": "MEDIUM", "priority": "MEDIUM",
                "estimated_cost": 3000.0, "recommended_action": "Standard patch"
            }
        ],
        latitude=None,
        longitude=None
    )

    # Record 3: LOW severity, LOW priority, 1 detection (longitudinal crack), with GPS
    InspectionRepository.create_inspection_with_detections(
        db=test_db,
        image_filename="low_damage_3.jpg",
        detection_count=1,
        total_estimated_cost=1500.0,
        overall_severity="LOW",
        overall_priority="LOW",
        detections=[
            {
                "class_id": 2, "class_name": "longitudinal crack", "confidence": 0.72,
                "bbox": {"x1": 5, "y1": 5, "x2": 25, "y2": 80},
                "severity": "LOW", "priority": "LOW",
                "estimated_cost": 1500.0, "recommended_action": "Crack sealing"
            }
        ],
        latitude=13.082680,
        longitude=80.270721
    )

    # Record 4: NONE severity, NONE priority, 0 detections, NO GPS
    InspectionRepository.create_inspection_with_detections(
        db=test_db,
        image_filename="clean_road_4.jpg",
        detection_count=0,
        total_estimated_cost=0.0,
        overall_severity="NONE",
        overall_priority="NONE",
        detections=[],
        latitude=None,
        longitude=None
    )

    # Record 5: HIGH severity, HIGH priority, 1 detection (pothole), with GPS
    InspectionRepository.create_inspection_with_detections(
        db=test_db,
        image_filename="high_damage_5.jpg",
        detection_count=1,
        total_estimated_cost=5000.0,
        overall_severity="HIGH",
        overall_priority="HIGH",
        detections=[
            {
                "class_id": 0, "class_name": "pothole", "confidence": 0.92,
                "bbox": {"x1": 15, "y1": 15, "x2": 75, "y2": 75},
                "severity": "HIGH", "priority": "HIGH",
                "estimated_cost": 5000.0, "recommended_action": "Emergency patch"
            }
        ],
        latitude=11.016844,
        longitude=76.955832
    )

    return test_db


# =====================================================================
# 1. Statistics Unit Tests
# =====================================================================

def test_stats_empty_database(test_db):
    stats = InspectionRepository.get_stats(test_db)
    assert stats["total_inspections"] == 0
    assert stats["total_detections"] == 0
    assert stats["total_estimated_cost"] == 0.0
    assert stats["severity_distribution"] == {"HIGH": 0, "MEDIUM": 0, "LOW": 0, "NONE": 0}
    assert stats["priority_distribution"] == {"HIGH": 0, "MEDIUM": 0, "LOW": 0, "NONE": 0}
    assert stats["defect_frequency"] == {}
    assert stats["gps_coverage"] == {"with_gps": 0, "without_gps": 0}


def test_stats_populated_database(populated_db):
    stats = InspectionRepository.get_stats(populated_db)

    assert stats["total_inspections"] == 5
    assert stats["total_detections"] == 5
    assert stats["total_estimated_cost"] == 17500.0

    # Severity distribution
    assert stats["severity_distribution"]["HIGH"] == 2
    assert stats["severity_distribution"]["MEDIUM"] == 1
    assert stats["severity_distribution"]["LOW"] == 1
    assert stats["severity_distribution"]["NONE"] == 1

    # Priority distribution
    assert stats["priority_distribution"]["HIGH"] == 2
    assert stats["priority_distribution"]["MEDIUM"] == 1
    assert stats["priority_distribution"]["LOW"] == 1
    assert stats["priority_distribution"]["NONE"] == 1

    # Defect frequency
    assert stats["defect_frequency"]["pothole"] == 3
    assert stats["defect_frequency"]["alligator crack"] == 1
    assert stats["defect_frequency"]["longitudinal crack"] == 1

    # GPS coverage
    assert stats["gps_coverage"]["with_gps"] == 3
    assert stats["gps_coverage"]["without_gps"] == 2


# =====================================================================
# 2. Filtering Unit Tests
# =====================================================================

def test_filter_severity_high(populated_db):
    items, total = InspectionRepository.get_all_paginated(populated_db, severity="HIGH")
    assert total == 2
    assert len(items) == 2
    assert all(i.overall_severity == "HIGH" for i in items)


def test_filter_severity_medium(populated_db):
    items, total = InspectionRepository.get_all_paginated(populated_db, severity="MEDIUM")
    assert total == 1
    assert len(items) == 1
    assert items[0].overall_severity == "MEDIUM"


def test_filter_severity_none(populated_db):
    items, total = InspectionRepository.get_all_paginated(populated_db, severity="NONE")
    assert total == 1
    assert len(items) == 1
    assert items[0].overall_severity == "NONE"


def test_filter_severity_all(populated_db):
    items, total = InspectionRepository.get_all_paginated(populated_db, severity="ALL")
    assert total == 5
    assert len(items) == 5


def test_filter_gps_with_gps(populated_db):
    items, total = InspectionRepository.get_all_paginated(populated_db, has_gps=True)
    assert total == 3
    assert len(items) == 3
    assert all(i.latitude is not None and i.longitude is not None for i in items)


def test_filter_gps_without_gps(populated_db):
    items, total = InspectionRepository.get_all_paginated(populated_db, has_gps=False)
    assert total == 2
    assert len(items) == 2
    assert all(i.latitude is None or i.longitude is None for i in items)


def test_filter_combined_severity_and_gps(populated_db):
    # HIGH severity + WITH GPS -> 2 records
    items, total = InspectionRepository.get_all_paginated(populated_db, severity="HIGH", has_gps=True)
    assert total == 2
    assert len(items) == 2

    # HIGH severity + WITHOUT GPS -> 0 records
    items, total = InspectionRepository.get_all_paginated(populated_db, severity="HIGH", has_gps=False)
    assert total == 0
    assert len(items) == 0

    # MEDIUM severity + WITHOUT GPS -> 1 record
    items, total = InspectionRepository.get_all_paginated(populated_db, severity="MEDIUM", has_gps=False)
    assert total == 1
    assert len(items) == 1


# =====================================================================
# 3. Pagination Unit Tests
# =====================================================================

def test_pagination_first_page(populated_db):
    items, total = InspectionRepository.get_all_paginated(populated_db, limit=2, offset=0)
    assert total == 5
    assert len(items) == 2


def test_pagination_second_page(populated_db):
    items_p1, _ = InspectionRepository.get_all_paginated(populated_db, limit=2, offset=0)
    items_p2, total = InspectionRepository.get_all_paginated(populated_db, limit=2, offset=2)
    assert total == 5
    assert len(items_p2) == 2
    # Records should not overlap
    p1_ids = {i.id for i in items_p1}
    p2_ids = {i.id for i in items_p2}
    assert p1_ids.isdisjoint(p2_ids)


def test_pagination_offset_beyond_available(populated_db):
    items, total = InspectionRepository.get_all_paginated(populated_db, limit=10, offset=50)
    assert total == 5
    assert len(items) == 0


def test_pagination_limit_handling(populated_db):
    items, total = InspectionRepository.get_all_paginated(populated_db, limit=10, offset=0)
    assert total == 5
    assert len(items) == 5


# =====================================================================
# 4. API Validation Unit Tests (via TestClient)
# =====================================================================

def test_api_validation_invalid_severity(populated_db):
    def override_get_db():
        try:
            yield populated_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    try:
        response = client.get("/api/inspection/history?severity=INVALID_LEVEL")
        assert response.status_code == 400
        assert "Invalid severity filter" in response.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_api_validation_invalid_pagination(populated_db):
    def override_get_db():
        try:
            yield populated_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    try:
        # Negative offset
        r1 = client.get("/api/inspection/history?offset=-1")
        assert r1.status_code == 422

        # Limit zero
        r2 = client.get("/api/inspection/history?limit=0")
        assert r2.status_code == 422

        # Limit exceeds 100
        r3 = client.get("/api/inspection/history?limit=150")
        assert r3.status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_api_stats_endpoint_via_client(populated_db):
    def override_get_db():
        try:
            yield populated_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    try:
        response = client.get("/api/inspection/stats")
        assert response.status_code == 200
        data = response.json()
        assert data["total_inspections"] == 5
        assert data["total_detections"] == 5
        assert data["total_estimated_cost"] == 17500.0
        assert data["gps_coverage"]["with_gps"] == 3
        assert data["gps_coverage"]["without_gps"] == 2
    finally:
        app.dependency_overrides.clear()
