import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.risk_engine import calculate_risk_score, generate_maintenance_recommendation, generate_explainability
from app.services.hotspot_service import detect_hotspots, haversine_distance

client = TestClient(app)


def test_risk_score_calculation():
    # Test zero detections
    res0 = calculate_risk_score([], "NONE", "NONE")
    assert res0["risk_score"] == 0
    assert res0["risk_level"] == "LOW"

    # Test single high severity detection
    detections = [
        {"class_name": "pothole", "severity": "HIGH", "confidence": 0.92}
    ]
    res1 = calculate_risk_score(detections, "HIGH", "HIGH")
    assert res1["risk_score"] > 30
    assert "risk_level" in res1
    assert len(res1["factors"]) > 0

    # Test multiple severe defects (should result in CRITICAL or HIGH score)
    detections_critical = [
        {"class_name": "pothole", "severity": "HIGH", "confidence": 0.95},
        {"class_name": "alligator crack", "severity": "HIGH", "confidence": 0.88},
        {"class_name": "manhole cover", "severity": "HIGH", "confidence": 0.91},
        {"class_name": "patchy road section", "severity": "MEDIUM", "confidence": 0.85}
    ]
    res_crit = calculate_risk_score(detections_critical, "HIGH", "HIGH")
    assert res_crit["risk_score"] >= 61
    assert res_crit["risk_level"] in ("HIGH", "CRITICAL")


def test_maintenance_recommendation():
    rec_p1 = generate_maintenance_recommendation(
        risk_score=85,
        overall_severity="HIGH",
        detection_count=4,
        total_cost=18500.0,
        has_gps=True
    )
    assert rec_p1["priority_code"] == "P1"
    assert "Immediate" in rec_p1["priority_label"]
    assert len(rec_p1["reasons"]) >= 3

    rec_p4 = generate_maintenance_recommendation(
        risk_score=0,
        overall_severity="NONE",
        detection_count=0,
        total_cost=0.0,
        has_gps=False
    )
    assert rec_p4["priority_code"] == "P4"


def test_haversine_and_hotspot_clustering():
    # Distance between two nearby coordinates (approx 100 meters)
    d = haversine_distance(12.9716, 77.5946, 12.9720, 77.5950)
    assert d < 0.5  # Less than 500m

    items = [
        {"id": 1, "latitude": 12.9716, "longitude": 77.5946, "detection_count": 3, "total_estimated_cost": 5000.0, "risk_score": 75, "overall_severity": "HIGH"},
        {"id": 2, "latitude": 12.9718, "longitude": 77.5948, "detection_count": 2, "total_estimated_cost": 3000.0, "risk_score": 60, "overall_severity": "MEDIUM"},
        {"id": 3, "latitude": 13.0827, "longitude": 80.2707, "detection_count": 1, "total_estimated_cost": 1000.0, "risk_score": 25, "overall_severity": "LOW"}
    ]

    hotspots = detect_hotspots(items, radius_km=0.5)
    assert len(hotspots) == 2  # Two distinct clusters (Bangalore items grouped, Chennai item separate)
    assert hotspots[0]["inspection_count"] == 2
    assert hotspots[0]["total_defects"] == 5


def test_priority_queue_api():
    response = client.get("/api/inspection/priority-queue")
    assert response.status_code == 200
    data = response.json()
    assert "count" in data
    assert "items" in data
    assert isinstance(data["items"], list)


def test_hotspots_api():
    response = client.get("/api/inspection/hotspots")
    assert response.status_code == 200
    data = response.json()
    assert "count" in data
    assert "hotspots" in data
    assert isinstance(data["hotspots"], list)


def test_stats_api_has_new_metrics():
    response = client.get("/api/inspection/stats")
    assert response.status_code == 200
    data = response.json()
    assert "average_risk_score" in data
    assert "critical_roads_count" in data
    assert "active_hotspots_count" in data
