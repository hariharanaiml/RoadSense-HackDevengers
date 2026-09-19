import json
import requests
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000"

def test_health():
    print("=== 1. Testing GET /api/health ===")
    res = requests.get(f"{BASE_URL}/api/health")
    print(f"Status Code: {res.status_code}")
    data = res.json()
    print("Response JSON:")
    print(json.dumps(data, indent=2))
    assert res.status_code == 200
    assert data["status"] == "ok"
    assert data["ai_enabled"] is True
    assert data["model_loaded"] is True
    assert len(data["classes"]) == 7
    return data

def test_damage_detection():
    print("\n=== 2. Testing POST /api/inspection/analyze (Road Damage Detected) ===")
    image_path = Path(r"C:\Users\ADMIN\Desktop\project 1\backend\uploads\093d4ebd35b1453f86e66932c8651f83.jpg")
    assert image_path.exists(), f"Image not found at {image_path}"
    
    with open(image_path, "rb") as f:
        files = {"image": (image_path.name, f, "image/jpeg")}
        res = requests.post(f"{BASE_URL}/api/inspection/analyze", files=files)
    
    print(f"Status Code: {res.status_code}")
    data = res.json()
    print("Response JSON:")
    print(json.dumps(data, indent=2))
    assert res.status_code == 200
    assert data["success"] is True
    assert data["detection_count"] >= 1
    return data

def test_no_damage_detection():
    print("\n=== 3. Testing POST /api/inspection/analyze (Clean Road / 0 Detections) ===")
    image_path = Path(r"C:\Users\ADMIN\Desktop\project 1\backend\uploads\test_pothole_road.jpg")
    assert image_path.exists(), f"Image not found at {image_path}"
    
    with open(image_path, "rb") as f:
        files = {"image": (image_path.name, f, "image/jpeg")}
        res = requests.post(f"{BASE_URL}/api/inspection/analyze", files=files)
    
    print(f"Status Code: {res.status_code}")
    data = res.json()
    print("Response JSON:")
    print(json.dumps(data, indent=2))
    assert res.status_code == 200
    assert data["success"] is True
    assert data["detection_count"] == 0
    assert data["detections"] == []
    return data

def test_invalid_extension():
    print("\n=== 4. Testing POST /api/inspection/analyze (Unsupported Extension) ===")
    files = {"image": ("document.txt", b"plain text content", "text/plain")}
    res = requests.post(f"{BASE_URL}/api/inspection/analyze", files=files)
    print(f"Status Code: {res.status_code}")
    print("Response JSON:", res.json())
    assert res.status_code == 400

def test_corrupt_image():
    print("\n=== 5. Testing POST /api/inspection/analyze (Corrupt Image Content) ===")
    files = {"image": ("damaged.jpg", b"INVALID_BINARY_DATA", "image/jpeg")}
    res = requests.post(f"{BASE_URL}/api/inspection/analyze", files=files)
    print(f"Status Code: {res.status_code}")
    print("Response JSON:", res.json())
    assert res.status_code == 400

if __name__ == "__main__":
    health_res = test_health()
    damage_res = test_damage_detection()
    no_damage_res = test_no_damage_detection()
    test_invalid_extension()
    test_corrupt_image()
    print("\n[SUCCESS] All verification tests executed and passed!")
