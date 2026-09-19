import math
from typing import Any, Dict, List, Optional

SEVERITY_WEIGHTS = {
    "HIGH": 60,
    "MEDIUM": 35,
    "LOW": 15,
    "NONE": 0
}

CLASS_SEVERITY_WEIGHTS = {
    "pothole": 25,
    "alligator crack": 25,
    "manhole cover": 20,
    "patchy road section": 15,
    "longitudinal crack": 12,
    "transverse crack": 12,
    "lane line blur": 8
}


def calculate_risk_score(
    detections: List[Dict[str, Any]],
    overall_severity: str,
    overall_priority: str
) -> Dict[str, Any]:
    """
    Calculates a transparent, deterministic RoadSense AI Risk Score (0-100).
    Factors:
    - Overall severity base score
    - High-severity defect counts
    - Defect density & class diversity
    - Detection confidence scores
    """
    if not detections or overall_severity.upper() == "NONE":
        return {
            "risk_score": 0,
            "risk_level": "LOW",
            "factors": ["No active road defects detected.", "Road surface is in good structural condition."]
        }

    # 1. Base score from overall severity
    sev_upper = overall_severity.upper()
    base_score = SEVERITY_WEIGHTS.get(sev_upper, 15)

    # 2. Defect count and class weight contribution
    high_count = 0
    med_count = 0
    low_count = 0
    class_types = set()
    class_score_total = 0

    for det in detections:
        cname = det.get("class_name", "").strip().lower()
        class_types.add(cname)
        weight = CLASS_SEVERITY_WEIGHTS.get(cname, 10)
        class_score_total += weight

        det_sev = det.get("severity", "LOW").upper()
        if det_sev == "HIGH":
            high_count += 1
        elif det_sev == "MEDIUM":
            med_count += 1
        else:
            low_count += 1

    # Additional points for multiple severe defects
    severe_defect_bonus = min(high_count * 12, 30)
    
    # Defect density bonus (more defects = higher urgency)
    density_bonus = min(len(detections) * 5, 20)

    # Class diversity bonus (multiple defect types indicates complex failure)
    diversity_bonus = min(len(class_types) * 5, 15)

    raw_score = base_score * 0.4 + class_score_total * 0.3 + severe_defect_bonus + density_bonus + diversity_bonus
    final_score = max(0, min(100, int(round(raw_score))))

    # Determine Risk Level classification
    if final_score >= 81:
        risk_level = "CRITICAL"
    elif final_score >= 61:
        risk_level = "HIGH"
    elif final_score >= 31:
        risk_level = "MODERATE"
    else:
        risk_level = "LOW"

    # Build human-readable explainability factors
    factors = []
    if high_count > 0:
        factors.append(f"{high_count} severe defect(s) detected ({', '.join(sorted(class_types))}).")
    if len(detections) >= 3:
        factors.append(f"High defect density ({len(detections)} total instances).")
    if len(class_types) > 1:
        factors.append(f"Multiple defect types present indicating structural road stress.")
    if sev_upper == "HIGH":
        factors.append("Overall inspection classified as HIGH severity.")
    elif sev_upper == "MEDIUM":
        factors.append("Overall inspection classified as MODERATE severity.")
    if not factors:
        factors.append("Minor surface wear detected.")

    return {
        "risk_score": final_score,
        "risk_level": risk_level,
        "factors": factors
    }


def generate_maintenance_recommendation(
    risk_score: int,
    overall_severity: str,
    detection_count: int,
    total_cost: float,
    has_gps: bool = False
) -> Dict[str, Any]:
    """
    Generates deterministic AI Maintenance Recommendation (P1 to P4).
    """
    if detection_count == 0 or risk_score == 0:
        return {
            "priority_code": "P4",
            "priority_label": "Monitor Condition",
            "action": "Routine Monitoring — No active repair required at present.",
            "reasons": [
                "Zero defect instances identified.",
                "Road surface integrity is clear.",
                "Standard municipal inspection cycle applies."
            ],
            "estimated_cost": 0.0,
            "risk_score": 0,
            "risk_level": "LOW"
        }

    if risk_score >= 81 or overall_severity.upper() == "HIGH" and detection_count >= 2:
        priority_code = "P1"
        priority_label = "Immediate Intervention"
        action = "Dispatch maintenance crew immediately for urgent pothole & structural repair."
    elif risk_score >= 61 or overall_severity.upper() == "HIGH":
        priority_code = "P2"
        priority_label = "Schedule Repair Soon"
        action = "Schedule asphalt repair & pavement sealing within 48-72 hours."
    elif risk_score >= 31 or overall_severity.upper() == "MEDIUM":
        priority_code = "P3"
        priority_label = "Routine Maintenance"
        action = "Include in upcoming monthly road maintenance resurfacing schedule."
    else:
        priority_code = "P4"
        priority_label = "Monitor Condition"
        action = "Monitor road section during next scheduled patrol."

    reasons = [
        f"{detection_count} defect(s) detected on road surface.",
        f"Estimated repair cost calculated at ₹{total_cost:,.2f}.",
        f"Risk Score evaluated at {risk_score}/100."
    ]
    if has_gps:
        reasons.append("GPS coordinates logged for field dispatch.")
    else:
        reasons.append("Location relies on manual dispatch coordinates.")

    return {
        "priority_code": priority_code,
        "priority_label": priority_label,
        "action": action,
        "reasons": reasons,
        "estimated_cost": total_cost,
        "risk_score": risk_score,
        "risk_level": "CRITICAL" if risk_score >= 81 else ("HIGH" if risk_score >= 61 else ("MODERATE" if risk_score >= 31 else "LOW"))
    }


def generate_explainability(
    detections: List[Dict[str, Any]],
    risk_data: Dict[str, Any],
    recommendation: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Builds structured explainability for the AI Explainability Panel.
    """
    det_explanations = []
    for det in detections:
        cname = det.get("class_name", "defect")
        conf = det.get("confidence", 0.0)
        sev = det.get("severity", "LOW")
        act = det.get("recommended_action", "Inspect defect.")
        det_explanations.append({
            "class_name": cname,
            "confidence_percentage": f"{round(conf * 100, 1)}%",
            "severity": sev,
            "why": f"YOLOv8 detected {cname} with {round(conf * 100, 1)}% confidence. Required action: {act}"
        })

    return {
        "summary": f"Inspection evaluated with Risk Score {risk_data['risk_score']}/100 ({risk_data['risk_level']}). Recommended Priority: {recommendation['priority_code']} ({recommendation['priority_label']}).",
        "risk_reasons": risk_data.get("factors", []),
        "recommendation_reasons": recommendation.get("reasons", []),
        "detections_breakdown": det_explanations
    }
