import json
import requests
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000"


def test_milestone5():
    print("=== 1. Health Endpoint ===")
    r = requests.get(f"{BASE_URL}/api/health")
    assert r.status_code == 200, f"Health check failed: {r.status_code}"
    data = r.json()
    assert data["status"] == "ok"
    assert data["ai_enabled"] is True
    assert data["model_loaded"] is True
    assert len(data["classes"]) == 7
    print("PASSED: Health endpoint ok.")

    img_damage = Path(r"C:\Users\ADMIN\Desktop\project 1\backend\uploads\093d4ebd35b1453f86e66932c8651f83.jpg")
    img_clean = Path(r"C:\Users\ADMIN\Desktop\project 1\backend\uploads\test_pothole_road.jpg")
    assert img_damage.exists(), "Test damage image missing"
    assert img_clean.exists(), "Test clean image missing"

    print("\n=== 2. Analysis without Coordinates ===")
    with open(img_damage, "rb") as f:
        r = requests.post(f"{BASE_URL}/api/inspection/analyze", files={"image": (img_damage.name, f, "image/jpeg")})
    assert r.status_code == 200, f"Analysis without coordinates failed: {r.status_code} {r.text}"
    d_no_gps = r.json()
    assert d_no_gps["success"] is True
    assert d_no_gps["latitude"] is None
    assert d_no_gps["longitude"] is None
    assert d_no_gps["detection_count"] >= 1
    no_gps_id = d_no_gps["inspection_id"]
    print(f"PASSED: Inspection #{no_gps_id} saved without GPS (lat=None, lon=None).")

    print("\n=== 3. Analysis with Valid Coordinates ===")
    test_lat = 11.016844
    test_lon = 76.955832
    with open(img_damage, "rb") as f:
        r = requests.post(
            f"{BASE_URL}/api/inspection/analyze",
            files={"image": (img_damage.name, f, "image/jpeg")},
            data={"latitude": test_lat, "longitude": test_lon}
        )
    assert r.status_code == 200, f"Analysis with coordinates failed: {r.status_code} {r.text}"
    d_gps = r.json()
    assert d_gps["success"] is True
    assert abs(d_gps["latitude"] - test_lat) < 1e-4
    assert abs(d_gps["longitude"] - test_lon) < 1e-4
    assert d_gps["detection_count"] == 1
    assert d_gps["overall_severity"] == "MEDIUM"
    assert d_gps["overall_priority"] == "MEDIUM"
    assert d_gps["total_estimated_cost"] == 3000.0
    gps_id = d_gps["inspection_id"]
    print(f"PASSED: Inspection #{gps_id} saved with GPS: ({d_gps['latitude']}, {d_gps['longitude']}).")

    print("\n=== 4. Zero Detection with Coordinates ===")
    with open(img_clean, "rb") as f:
        r = requests.post(
            f"{BASE_URL}/api/inspection/analyze",
            files={"image": (img_clean.name, f, "image/jpeg")},
            data={"latitude": test_lat, "longitude": test_lon}
        )
    assert r.status_code == 200
    d_clean_gps = r.json()
    assert d_clean_gps["detection_count"] == 0
    assert d_clean_gps["total_estimated_cost"] == 0.0
    assert d_clean_gps["overall_severity"] == "NONE"
    assert d_clean_gps["overall_priority"] == "NONE"
    assert abs(d_clean_gps["latitude"] - test_lat) < 1e-4
    assert abs(d_clean_gps["longitude"] - test_lon) < 1e-4
    clean_gps_id = d_clean_gps["inspection_id"]
    print(f"PASSED: Zero-detection inspection #{clean_gps_id} saved with coordinates.")

    print("\n=== 5. History API Returns Coordinates ===")
    r = requests.get(f"{BASE_URL}/api/inspection/history?limit=10")
    assert r.status_code == 200
    history_data = r.json()["inspections"]
    assert any(h["id"] == gps_id and h["latitude"] is not None and h["longitude"] is not None for h in history_data)
    assert any(h["id"] == no_gps_id and h["latitude"] is None and h["longitude"] is None for h in history_data)
    print("PASSED: History endpoint includes coordinates for geolocated inspections and null for non-geolocated.")

    print("\n=== 6. Inspection Detail API Returns Coordinates ===")
    r = requests.get(f"{BASE_URL}/api/inspection/{gps_id}")
    assert r.status_code == 200
    detail_gps = r.json()
    assert abs(detail_gps["latitude"] - test_lat) < 1e-4
    assert abs(detail_gps["longitude"] - test_lon) < 1e-4
    assert len(detail_gps["detections"]) == 1

    r = requests.get(f"{BASE_URL}/api/inspection/{no_gps_id}")
    assert r.status_code == 200
    detail_no_gps = r.json()
    assert detail_no_gps["latitude"] is None
    assert detail_no_gps["longitude"] is None
    print("PASSED: Detail endpoint returns coordinates properly.")

    print("\n=== 7. Validation: Invalid Latitude (> 90) ===")
    with open(img_damage, "rb") as f:
        r = requests.post(
            f"{BASE_URL}/api/inspection/analyze",
            files={"image": (img_damage.name, f, "image/jpeg")},
            data={"latitude": 95.0, "longitude": 77.0}
        )
    assert r.status_code == 400
    assert "Latitude must be between -90 and 90 degrees" in r.text
    print(f"PASSED: Invalid latitude rejected with: {r.json()['detail']}")

    print("\n=== 8. Validation: Invalid Longitude (> 180) ===")
    with open(img_damage, "rb") as f:
        r = requests.post(
            f"{BASE_URL}/api/inspection/analyze",
            files={"image": (img_damage.name, f, "image/jpeg")},
            data={"latitude": 11.0, "longitude": 185.0}
        )
    assert r.status_code == 400
    assert "Longitude must be between -180 and 180 degrees" in r.text
    print(f"PASSED: Invalid longitude rejected with: {r.json()['detail']}")

    print("\n=== 9. Validation: Latitude without Longitude ===")
    with open(img_damage, "rb") as f:
        r = requests.post(
            f"{BASE_URL}/api/inspection/analyze",
            files={"image": (img_damage.name, f, "image/jpeg")},
            data={"latitude": 11.0}
        )
    assert r.status_code == 400
    assert "Latitude and longitude must be provided together" in r.text
    print(f"PASSED: Missing longitude rejected with: {r.json()['detail']}")

    print("\n=== 10. Validation: Longitude without Latitude ===")
    with open(img_damage, "rb") as f:
        r = requests.post(
            f"{BASE_URL}/api/inspection/analyze",
            files={"image": (img_damage.name, f, "image/jpeg")},
            data={"longitude": 77.0}
        )
    assert r.status_code == 400
    assert "Latitude and longitude must be provided together" in r.text
    print(f"PASSED: Missing latitude rejected with: {r.json()['detail']}")

    print("\n=== 11. Existing Older Inspections Remain Readable ===")
    r = requests.get(f"{BASE_URL}/api/inspection/1")
    assert r.status_code == 200
    old_insp = r.json()
    assert old_insp["id"] == 1
    assert old_insp["latitude"] is None
    assert old_insp["longitude"] is None
    print(f"PASSED: Old inspection #1 is intact with lat=None, lon=None.")

    print("\n[SUCCESS] All Milestone 5 backend tests passed!")


if __name__ == "__main__":
    test_milestone5()
