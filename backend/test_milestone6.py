import json
import os
import requests
from pathlib import Path

BASE_URL = os.getenv("TEST_BASE_URL", "http://127.0.0.1:8000")



def _check_stats(initial_stats=None):
    r = requests.get(f"{BASE_URL}/api/inspection/stats")
    assert r.status_code == 200, f"Stats endpoint failed: {r.status_code} {r.text}"
    stats = r.json()
    assert "total_inspections" in stats
    assert "total_detections" in stats
    assert "total_estimated_cost" in stats
    assert "severity_distribution" in stats
    assert "priority_distribution" in stats
    assert "defect_frequency" in stats
    assert "gps_coverage" in stats

    for sev in ("HIGH", "MEDIUM", "LOW", "NONE"):
        assert sev in stats["severity_distribution"], f"Missing {sev} in severity_distribution"

    for prio in ("HIGH", "MEDIUM", "LOW", "NONE"):
        assert prio in stats["priority_distribution"], f"Missing {prio} in priority_distribution"

    assert "with_gps" in stats["gps_coverage"]
    assert "without_gps" in stats["gps_coverage"]
    assert stats["gps_coverage"]["with_gps"] + stats["gps_coverage"]["without_gps"] == stats["total_inspections"]

    if initial_stats:
        assert stats["total_inspections"] >= initial_stats["total_inspections"]

    return stats


def _check_pagination(total_expected):
    # First page
    r = requests.get(f"{BASE_URL}/api/inspection/history?limit=2&offset=0")
    assert r.status_code == 200
    d1 = r.json()
    assert d1["total"] == total_expected
    assert d1["limit"] == 2
    assert d1["offset"] == 0
    assert len(d1["inspections"]) <= 2

    # Second page if available
    if total_expected > 2:
        r2 = requests.get(f"{BASE_URL}/api/inspection/history?limit=2&offset=2")
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["total"] == total_expected
        assert d2["offset"] == 2
        # Ensure page 1 and page 2 don't overlap
        p1_ids = {i["id"] for i in d1["inspections"]}
        p2_ids = {i["id"] for i in d2["inspections"]}
        assert p1_ids.isdisjoint(p2_ids), "Pagination pages overlap"

    # Out of bounds offset
    r_empty = requests.get(f"{BASE_URL}/api/inspection/history?limit=10&offset=100000")
    assert r_empty.status_code == 200
    d_empty = r_empty.json()
    assert d_empty["total"] == total_expected
    assert d_empty["inspections"] == []


def _check_filters():
    # 1. Severity filter
    r_high = requests.get(f"{BASE_URL}/api/inspection/history?severity=HIGH")
    assert r_high.status_code == 200
    d_high = r_high.json()
    assert all(i["overall_severity"] == "HIGH" for i in d_high["inspections"])

    r_none = requests.get(f"{BASE_URL}/api/inspection/history?severity=NONE")
    assert r_none.status_code == 200
    d_none = r_none.json()
    assert all(i["overall_severity"] == "NONE" for i in d_none["inspections"])

    # 2. GPS filter
    r_gps = requests.get(f"{BASE_URL}/api/inspection/history?has_gps=true")
    assert r_gps.status_code == 200
    d_gps = r_gps.json()
    assert all(i["latitude"] is not None and i["longitude"] is not None for i in d_gps["inspections"])

    r_no_gps = requests.get(f"{BASE_URL}/api/inspection/history?has_gps=false")
    assert r_no_gps.status_code == 200
    d_no_gps = r_no_gps.json()
    assert all(i["latitude"] is None or i["longitude"] is None for i in d_no_gps["inspections"])

    # 3. Combined filter
    r_comb = requests.get(f"{BASE_URL}/api/inspection/history?severity=NONE&has_gps=false")
    assert r_comb.status_code == 200
    d_comb = r_comb.json()
    assert all(i["overall_severity"] == "NONE" and (i["latitude"] is None or i["longitude"] is None) for i in d_comb["inspections"])


def test_milestone6():
    print("=== 1. Health Endpoint ===")
    r = requests.get(f"{BASE_URL}/api/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["ai_enabled"] is True
    assert data["model_loaded"] is True
    print("PASSED: Health check ok.")

    print("\n=== 2. Check Global Stats API ===")
    initial_stats = _check_stats()
    print(f"PASSED: Stats endpoint returned {initial_stats['total_inspections']} inspections, "
          f"{initial_stats['total_detections']} detections, cost={initial_stats['total_estimated_cost']}")

    candidate_damage = Path(__file__).resolve().parent.parent.parent / "backend" / "uploads" / "093d4ebd35b1453f86e66932c8651f83.jpg"
    candidate_clean = Path(__file__).resolve().parent.parent.parent / "backend" / "uploads" / "test_pothole_road.jpg"
    img_damage = candidate_damage if candidate_damage.exists() else Path(r"C:\Users\ADMIN\Desktop\project 1\backend\uploads\093d4ebd35b1453f86e66932c8651f83.jpg")
    img_clean = candidate_clean if candidate_clean.exists() else Path(r"C:\Users\ADMIN\Desktop\project 1\backend\uploads\test_pothole_road.jpg")
    assert img_damage.exists(), "Test damage image missing"
    assert img_clean.exists(), "Test clean image missing"


    print("\n=== 3. Add Geotagged Inspection ===")
    with open(img_damage, "rb") as f:
        r = requests.post(
            f"{BASE_URL}/api/inspection/analyze",
            files={"image": (img_damage.name, f, "image/jpeg")},
            data={"latitude": 12.971598, "longitude": 77.594566}
        )
    assert r.status_code == 200
    gps_insp = r.json()
    gps_id = gps_insp["inspection_id"]
    print(f"PASSED: Created geotagged inspection #{gps_id}")

    print("\n=== 4. Add Zero-Detection Inspection without Coordinates ===")
    with open(img_clean, "rb") as f:
        r = requests.post(
            f"{BASE_URL}/api/inspection/analyze",
            files={"image": (img_clean.name, f, "image/jpeg")}
        )
    assert r.status_code == 200
    clean_insp = r.json()
    clean_id = clean_insp["inspection_id"]
    assert clean_insp["detection_count"] == 0
    assert clean_insp["overall_severity"] == "NONE"
    print(f"PASSED: Created zero-detection inspection #{clean_id}")

    print("\n=== 5. Verify Stats Update Accurately ===")
    updated_stats = _check_stats(initial_stats)
    assert updated_stats["total_inspections"] >= initial_stats["total_inspections"] + 2
    assert updated_stats["gps_coverage"]["with_gps"] >= 1
    assert updated_stats["gps_coverage"]["without_gps"] >= 1
    assert updated_stats["severity_distribution"]["NONE"] >= 1
    print(f"PASSED: Global stats reflect updated database records ({updated_stats['total_inspections']} total).")

    print("\n=== 6. Verify Pagination Envelope and Pages ===")
    _check_pagination(updated_stats["total_inspections"])
    print("PASSED: History pagination (limit, offset, total) works correctly.")

    print("\n=== 7. Verify Server-Side Filters ===")
    _check_filters()
    print("PASSED: Severity, GPS, and combined server-side filters work correctly.")

    print("\n=== 8. Backward Compatibility (limit only) ===")
    r_compat = requests.get(f"{BASE_URL}/api/inspection/history?limit=10")
    assert r_compat.status_code == 200
    compat_data = r_compat.json()
    assert "inspections" in compat_data
    assert "total" in compat_data
    assert len(compat_data["inspections"]) <= 10
    print("PASSED: Backward-compatible callers receiving 'inspections' list work seamlessly.")

    print("\n=== 9. Verification of Existing Details Endpoint ===")
    r_detail = requests.get(f"{BASE_URL}/api/inspection/{gps_id}")
    assert r_detail.status_code == 200
    assert r_detail.json()["id"] == gps_id
    assert r_detail.json()["latitude"] is not None

    r_clean_detail = requests.get(f"{BASE_URL}/api/inspection/{clean_id}")
    assert r_clean_detail.status_code == 200
    assert r_clean_detail.json()["id"] == clean_id
    assert r_clean_detail.json()["detection_count"] == 0
    print("PASSED: Inspection details endpoint remains fully intact.")

    print("\n=== 10. Validation Checks ===")
    # Invalid severity
    r_bad_sev = requests.get(f"{BASE_URL}/api/inspection/history?severity=EXTREME")
    assert r_bad_sev.status_code == 400
    assert "Invalid severity filter" in r_bad_sev.json()["detail"]

    # Invalid offset
    r_bad_off = requests.get(f"{BASE_URL}/api/inspection/history?offset=-1")
    assert r_bad_off.status_code == 422

    # Invalid limit
    r_bad_lim = requests.get(f"{BASE_URL}/api/inspection/history?limit=200")
    assert r_bad_lim.status_code == 422
    print("PASSED: Input validations for severity, offset, and limit rejected bad requests.")

    print("\n[SUCCESS] All Milestone 6 integration checks passed successfully!")


if __name__ == "__main__":
    test_milestone6()
