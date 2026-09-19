import math
from typing import Any, Dict, List

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculates the Great Circle distance between two points in kilometers.
    """
    R = 6371.0  # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2.0) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def detect_hotspots(
    inspections: List[Dict[str, Any]],
    radius_km: float = 0.5
) -> List[Dict[str, Any]]:
    """
    Groups GPS-enabled inspections into geographic defect hotspots using spatial proximity.
    """
    gps_items = [
        item for item in inspections
        if item.get("latitude") is not None and item.get("longitude") is not None
    ]

    if not gps_items:
        return []

    visited = set()
    clusters = []

    for i, base in enumerate(gps_items):
        if i in visited:
            continue

        cluster_members = [base]
        visited.add(i)

        for j, candidate in enumerate(gps_items):
            if j in visited:
                continue
            dist = haversine_distance(
                base["latitude"], base["longitude"],
                candidate["latitude"], candidate["longitude"]
            )
            if dist <= radius_km:
                cluster_members.append(candidate)
                visited.add(j)

        # Calculate cluster metrics
        avg_lat = sum(item["latitude"] for item in cluster_members) / len(cluster_members)
        avg_lng = sum(item["longitude"] for item in cluster_members) / len(cluster_members)
        total_defects = sum(item.get("detection_count", 0) for item in cluster_members)
        total_cost = sum(item.get("total_estimated_cost", 0.0) for item in cluster_members)
        avg_risk = sum(item.get("risk_score", 0) for item in cluster_members) / len(cluster_members)

        # Determine overall cluster severity
        severities = [item.get("overall_severity", "NONE").upper() for item in cluster_members]
        if "HIGH" in severities or avg_risk >= 61:
            severity = "CRITICAL" if avg_risk >= 81 or total_defects >= 5 else "HIGH"
        elif "MEDIUM" in severities or avg_risk >= 31:
            severity = "MODERATE"
        else:
            severity = "LOW"

        clusters.append({
            "id": f"hotspot-{len(clusters) + 1}",
            "name": f"Hotspot Zone #{len(clusters) + 1}",
            "center_latitude": round(avg_lat, 6),
            "center_longitude": round(avg_lng, 6),
            "inspection_count": len(cluster_members),
            "total_defects": total_defects,
            "total_estimated_cost": round(total_cost, 2),
            "average_risk_score": int(round(avg_risk)),
            "severity": severity,
            "inspection_ids": [item["id"] for item in cluster_members],
            "radius_km": radius_km
        })

    # Sort hotspots by total defects and average risk score descending
    clusters.sort(key=lambda x: (x["total_defects"], x["average_risk_score"]), reverse=True)
    return clusters
