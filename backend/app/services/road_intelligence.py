from typing import Any, Dict, List, Tuple

# Centralized defect intelligence rules for road damage classes
DEFECT_RULES: Dict[str, Dict[str, Any]] = {
    "pothole": {
        "severity": "HIGH",
        "priority": "HIGH",
        "estimated_cost": 2500,
        "recommended_action": "Repair pothole and restore the road surface."
    },
    "alligator crack": {
        "severity": "HIGH",
        "priority": "HIGH",
        "estimated_cost": 5000,
        "recommended_action": "Inspect underlying pavement failure and perform structural repair."
    },
    "longitudinal crack": {
        "severity": "MEDIUM",
        "priority": "MEDIUM",
        "estimated_cost": 1800,
        "recommended_action": "Seal the longitudinal crack and monitor for further propagation."
    },
    "transverse crack": {
        "severity": "MEDIUM",
        "priority": "MEDIUM",
        "estimated_cost": 1800,
        "recommended_action": "Seal the transverse crack and inspect surrounding pavement."
    },
    "patchy road section": {
        "severity": "MEDIUM",
        "priority": "MEDIUM",
        "estimated_cost": 3000,
        "recommended_action": "Resurface the damaged road section."
    },
    "lane line blur": {
        "severity": "LOW",
        "priority": "LOW",
        "estimated_cost": 1000,
        "recommended_action": "Repaint and restore lane markings."
    },
    "manhole cover": {
        "severity": "HIGH",
        "priority": "HIGH",
        "estimated_cost": 3500,
        "recommended_action": "Inspect and secure the manhole cover to ensure road-user safety."
    }
}

DEFAULT_DEFECT_RULE: Dict[str, Any] = {
    "severity": "LOW",
    "priority": "LOW",
    "estimated_cost": 1000,
    "recommended_action": "Inspect and address roadway defect."
}

SEVERITY_ORDER = ["HIGH", "MEDIUM", "LOW"]
PRIORITY_ORDER = ["HIGH", "MEDIUM", "LOW"]


def get_defect_rule(class_name: str) -> Dict[str, Any]:
    """Returns the intelligence rule for a given defect class name."""
    normalized_name = class_name.strip().lower()
    return DEFECT_RULES.get(normalized_name, DEFAULT_DEFECT_RULE)


def calculate_overall_severity(severities: List[str]) -> str:
    """
    Computes overall severity based on priority:
    HIGH > MEDIUM > LOW > NONE.
    """
    for level in SEVERITY_ORDER:
        if level in severities:
            return level
    return "NONE"


def calculate_overall_priority(priorities: List[str]) -> str:
    """
    Computes overall priority based on order:
    HIGH > MEDIUM > LOW > NONE.
    """
    for level in PRIORITY_ORDER:
        if level in priorities:
            return level
    return "NONE"


def apply_road_intelligence(detections: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Enriches YOLO detections with severity, priority, estimated cost, and recommended action.
    Also calculates overall summary metrics for the inspection.
    """
    enriched_detections: List[Dict[str, Any]] = []
    severities: List[str] = []
    priorities: List[str] = []
    total_cost: float = 0.0

    for det in detections:
        class_name = det.get("class_name", "")
        rule = get_defect_rule(class_name)

        severity = rule["severity"]
        priority = rule["priority"]
        estimated_cost = float(rule["estimated_cost"])
        recommended_action = rule["recommended_action"]

        enriched_det = dict(det)
        enriched_det.update({
            "severity": severity,
            "priority": priority,
            "estimated_cost": estimated_cost,
            "recommended_action": recommended_action
        })

        enriched_detections.append(enriched_det)
        severities.append(severity)
        priorities.append(priority)
        total_cost += estimated_cost

    overall_severity = calculate_overall_severity(severities)
    overall_priority = calculate_overall_priority(priorities)

    # Calculate Risk Score & Recommendations
    from app.services.risk_engine import calculate_risk_score, generate_maintenance_recommendation, generate_explainability
    
    risk_info = calculate_risk_score(
        detections=enriched_detections,
        overall_severity=overall_severity,
        overall_priority=overall_priority
    )

    recommendation = generate_maintenance_recommendation(
        risk_score=risk_info["risk_score"],
        overall_severity=overall_severity,
        detection_count=len(enriched_detections),
        total_cost=total_cost,
        has_gps=False
    )

    explainability = generate_explainability(
        detections=enriched_detections,
        risk_data=risk_info,
        recommendation=recommendation
    )

    summary = {
        "total_estimated_cost": round(total_cost, 2),
        "overall_severity": overall_severity,
        "overall_priority": overall_priority,
        "risk_score": risk_info["risk_score"],
        "risk_level": risk_info["risk_level"],
        "risk_factors": risk_info["factors"],
        "maintenance_recommendation": recommendation,
        "explainability": explainability
    }

    return enriched_detections, summary

