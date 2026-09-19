import json
import sqlite3
import requests
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000"
DB_PATH = Path(__file__).resolve().parent / "roadsense.db"


def test_database_schema():
    print("=== 1. Checking Database Schema ===")
    assert DB_PATH.exists(), f"Database file not found at {DB_PATH}"
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall()]
    print("Tables found:", tables)
    assert "inspections" in tables, "inspections table missing"
    assert "detections" in tables, "detections table missing"

    cursor.execute("PRAGMA table_info(inspections);")
    inspection_cols = [row[1] for row in cursor.fetchall()]
    print("Inspections columns:", inspection_cols)

    cursor.execute("PRAGMA table_info(detections);")
    detection_cols = [row[1] for row in cursor.fetchall()]
    print("Detections columns:", detection_cols)
    conn.close()


def test_health():
    print("\n=== 2. Testing GET /api/health ===")
    res = requests.get(f"{BASE_URL}/api/health")
    print(f"Status Code: {res.status_code}")
    data = res.json()
    print("Response:", json.dumps(data, indent=2))
    assert res.status_code == 200
    assert data["status"] == "ok"
    assert data["ai_enabled"] is True
    assert data["model_loaded"] is True
    assert len(data["classes"]) == 7
    return data


def test_damage_inspection():
    print("\n=== 3. Testing POST /api/inspection/analyze (Road Damage Image) ===")
    image_path = Path(r"C:\Users\ADMIN\Desktop\project 1\backend\uploads\093d4ebd35b1453f86e66932c8651f83.jpg")
    with open(image_path, "rb") as f:
        files = {"image": (image_path.name, f, "image/jpeg")}
        res = requests.post(f"{BASE_URL}/api/inspection/analyze", files=files)
    
    print(f"Status Code: {res.status_code}")
    data = res.json()
    print("Response:", json.dumps(data, indent=2))
    assert res.status_code == 200
    assert data["success"] is True
    assert "inspection_id" in data
    assert data["inspection_id"] is not None
    assert data["detection_count"] >= 1
    assert len(data["detections"]) == data["detection_count"]
    return data


def test_zero_detection_inspection():
    print("\n=== 4. Testing POST /api/inspection/analyze (Clean Road Image / 0 Detections) ===")
    image_path = Path(r"C:\Users\ADMIN\Desktop\project 1\backend\uploads\test_pothole_road.jpg")
    with open(image_path, "rb") as f:
        files = {"image": (image_path.name, f, "image/jpeg")}
        res = requests.post(f"{BASE_URL}/api/inspection/analyze", files=files)
    
    print(f"Status Code: {res.status_code}")
    data = res.json()
    print("Response:", json.dumps(data, indent=2))
    assert res.status_code == 200
    assert data["success"] is True
    assert "inspection_id" in data
    assert data["inspection_id"] is not None
    assert data["detection_count"] == 0
    assert data["detections"] == []
    return data


def _check_history(insp1_id, insp2_id):
    """Verify history endpoint ordering. Called from __main__ with real IDs."""
    print("\n=== 5. Testing GET /api/inspection/history ===")
    res = requests.get(f"{BASE_URL}/api/inspection/history?limit=10")
    print(f"Status Code: {res.status_code}")
    data = res.json()
    print("Response:", json.dumps(data, indent=2))
    assert res.status_code == 200
    assert "inspections" in data
    ids = [item["id"] for item in data["inspections"]]
    assert insp1_id in ids
    assert insp2_id in ids
    # Verify newest first ordering
    assert ids.index(insp2_id) < ids.index(insp1_id)
    return data


def _check_single_inspection(inspection_id, expected_count):
    """Verify a single inspection record by ID. Called from __main__ with real IDs."""
    print(f"\n=== 6. Testing GET /api/inspection/{inspection_id} ===")
    res = requests.get(f"{BASE_URL}/api/inspection/{inspection_id}")
    print(f"Status Code: {res.status_code}")
    data = res.json()
    print("Response:", json.dumps(data, indent=2))
    assert res.status_code == 200
    assert data["id"] == inspection_id
    assert data["detection_count"] == expected_count
    assert len(data["detections"]) == expected_count
    return data


def test_nonexistent_inspection():
    print("\n=== 7. Testing GET /api/inspection/999999 (404 Test) ===")
    res = requests.get(f"{BASE_URL}/api/inspection/999999")
    print(f"Status Code: {res.status_code}")
    print("Response:", res.json())
    assert res.status_code == 404


def test_invalid_extension():
    print("\n=== 8. Testing POST /api/inspection/analyze with .txt ===")
    files = {"image": ("sample.txt", b"plain text", "text/plain")}
    res = requests.post(f"{BASE_URL}/api/inspection/analyze", files=files)
    print(f"Status Code: {res.status_code}")
    print("Response:", res.json())
    assert res.status_code == 400


def test_corrupt_image():
    print("\n=== 9. Testing POST /api/inspection/analyze with corrupt content ===")
    files = {"image": ("bad.jpg", b"NOT_IMAGE_BINARY", "image/jpeg")}
    res = requests.post(f"{BASE_URL}/api/inspection/analyze", files=files)
    print(f"Status Code: {res.status_code}")
    print("Response:", res.json())
    assert res.status_code == 400


if __name__ == "__main__":
    test_database_schema()
    test_health()
    damage_data = test_damage_inspection()
    zero_data = test_zero_detection_inspection()
    _check_history(damage_data["inspection_id"], zero_data["inspection_id"])
    _check_single_inspection(damage_data["inspection_id"], damage_data["detection_count"])
    _check_single_inspection(zero_data["inspection_id"], 0)
    test_nonexistent_inspection()
    test_invalid_extension()
    test_corrupt_image()
    print("\n[SUCCESS] All database and API tests passed!")
