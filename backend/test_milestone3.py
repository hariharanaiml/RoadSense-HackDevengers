import json
import requests
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000"


def test_health():
    print("=== 1. Testing GET /api/health ===")
    res = requests.get(f"{BASE_URL}/api/health")
    print(f"Status Code: {res.status_code}")
    data = res.json()
    print("Response JSON:", json.dumps(data, indent=2))
    assert res.status_code == 200
    assert data["status"] == "ok"
    assert data["ai_enabled"] is True
    assert data["model_loaded"] is True
    assert len(data["classes"]) == 7
    return data


def test_damage_inspection():
    print("\n=== 2. Testing POST /api/inspection/analyze (Road Damage Image) ===")
    image_path = Path(r"C:\Users\ADMIN\Desktop\project 1\backend\uploads\093d4ebd35b1453f86e66932c8651f83.jpg")
    assert image_path.exists(), f"Image not found at {image_path}"

    with open(image_path, "rb") as f:
        files = {"image": (image_path.name, f, "image/jpeg")}
        res = requests.post(f"{BASE_URL}/api/inspection/analyze", files=files)

    print(f"Status Code: {res.status_code}")
    data = res.json()
    print("Response JSON:", json.dumps(data, indent=2))
    assert res.status_code == 200
    assert data["success"] is True
    assert "inspection_id" in data
    assert data["detection_count"] >= 1
    assert data["total_estimated_cost"] > 0
    assert data["overall_severity"] in ("HIGH", "MEDIUM", "LOW")
    assert data["overall_priority"] in ("HIGH", "MEDIUM", "LOW")

    for det in data["detections"]:
        assert "severity" in det
        assert "priority" in det
        assert "estimated_cost" in det
        assert "recommended_action" in det
        assert det["estimated_cost"] > 0
        assert len(det["recommended_action"]) > 0

    return data


def test_zero_detection_inspection():
    print("\n=== 3. Testing POST /api/inspection/analyze (Clean Road Image / 0 Detections) ===")
    image_path = Path(r"C:\Users\ADMIN\Desktop\project 1\backend\uploads\test_pothole_road.jpg")
    assert image_path.exists(), f"Image not found at {image_path}"

    with open(image_path, "rb") as f:
        files = {"image": (image_path.name, f, "image/jpeg")}
        res = requests.post(f"{BASE_URL}/api/inspection/analyze", files=files)

    print(f"Status Code: {res.status_code}")
    data = res.json()
    print("Response JSON:", json.dumps(data, indent=2))
    assert res.status_code == 200
    assert data["success"] is True
    assert "inspection_id" in data
    assert data["detection_count"] == 0
    assert data["total_estimated_cost"] == 0
    assert data["overall_severity"] == "NONE"
    assert data["overall_priority"] == "NONE"
    assert data["detections"] == []
    return data


def test_history(insp_damage_id, insp_zero_id):
    print("\n=== 4. Testing GET /api/inspection/history ===")
    res = requests.get(f"{BASE_URL}/api/inspection/history?limit=20")
    print(f"Status Code: {res.status_code}")
    data = res.json()
    print("Response JSON:", json.dumps(data, indent=2))
    assert res.status_code == 200
    assert "inspections" in data

    ids = [item["id"] for item in data["inspections"]]
    assert insp_damage_id in ids
    assert insp_zero_id in ids

    # Check newest first ordering
    assert ids.index(insp_zero_id) < ids.index(insp_damage_id)

    # Check that road intelligence fields exist on every item
    for insp in data["inspections"]:
        assert "total_estimated_cost" in insp
        assert "overall_severity" in insp
        assert "overall_priority" in insp

    return data


def test_single_inspection(inspection_id, expected_has_detections):
    print(f"\n=== 5. Testing GET /api/inspection/{inspection_id} ===")
    res = requests.get(f"{BASE_URL}/api/inspection/{inspection_id}")
    print(f"Status Code: {res.status_code}")
    data = res.json()
    print("Response JSON:", json.dumps(data, indent=2))
    assert res.status_code == 200
    assert data["id"] == inspection_id
    assert "total_estimated_cost" in data
    assert "overall_severity" in data
    assert "overall_priority" in data

    if expected_has_detections:
        assert data["detection_count"] > 0
        assert len(data["detections"]) == data["detection_count"]
        for det in data["detections"]:
            assert "severity" in det
            assert "priority" in det
            assert "estimated_cost" in det
            assert "recommended_action" in det
    else:
        assert data["detection_count"] == 0
        assert data["detections"] == []
        assert data["total_estimated_cost"] == 0
        assert data["overall_severity"] == "NONE"
        assert data["overall_priority"] == "NONE"

    return data


def test_nonexistent_inspection():
    print("\n=== 6. Testing GET /api/inspection/999999 (404 Test) ===")
    res = requests.get(f"{BASE_URL}/api/inspection/999999")
    print(f"Status Code: {res.status_code}")
    print("Response JSON:", res.json())
    assert res.status_code == 404
    assert res.json()["detail"] == "Inspection with ID 999999 not found."


def test_invalid_extension():
    print("\n=== 7. Testing POST /api/inspection/analyze with .txt ===")
    files = {"image": ("test.txt", b"dummy plain text", "text/plain")}
    res = requests.post(f"{BASE_URL}/api/inspection/analyze", files=files)
    print(f"Status Code: {res.status_code}")
    print("Response JSON:", res.json())
    assert res.status_code == 400


def test_corrupt_image():
    print("\n=== 8. Testing POST /api/inspection/analyze with corrupt content ===")
    files = {"image": ("broken.png", b"INVALID_CORRUPT_BYTES", "image/png")}
    res = requests.post(f"{BASE_URL}/api/inspection/analyze", files=files)
    print(f"Status Code: {res.status_code}")
    print("Response JSON:", res.json())
    assert res.status_code == 400


if __name__ == "__main__":
    test_health()
    damage_data = test_damage_inspection()
    zero_data = test_zero_detection_inspection()
    test_history(damage_data["inspection_id"], zero_data["inspection_id"])
    test_single_inspection(damage_data["inspection_id"], True)
    test_single_inspection(zero_data["inspection_id"], False)
    test_nonexistent_inspection()
    test_invalid_extension()
    test_corrupt_image()
    print("\n[SUCCESS] All Milestone 3 Road Intelligence API tests passed successfully!")
