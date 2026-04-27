from ..models.transaction import IngestPayload, RiskLevel


RULES: list[tuple[str, int, str]] = [
    ("new_beneficiary",          40, "New beneficiary added recently"),
    ("new_device",               30, "Login from unrecognised device"),
    ("prior_chargeback_link",    50, "Linked to prior chargeback"),
    ("impossible_travel",        45, "Impossible travel detected"),
    ("large_unusual_transfer",   35, "Transfer significantly above customer average"),
    ("password_reset_before_txn",40, "Password reset within 30 minutes of transfer"),
    ("mule_device_match",        60, "Device fingerprint matches known mule account"),
    ("high_velocity",            35, "Multiple transfers in short window"),
    ("kyc_incomplete",           25, "KYC not completed"),
    ("new_account",              20, "Account opened within 30 days"),
    ("sanctioned_beneficiary",   80, "Beneficiary on sanctions list"),
    ("high_upstream_score",      30, "Upstream fraud engine scored high"),
]

RULE_INDEX = {r[0]: (r[1], r[2]) for r in RULES}


def score(payload: IngestPayload) -> tuple[int, list[dict]]:
    """
    Returns (total_score, triggered_factors).
    Score range: 0–1000 (capped).
    Triggered factors: list of {label, score, evidence}.
    """
    triggered = []
    total = 0

    signals = set(payload.fraud_signals or [])
    rules = set(payload.triggered_rules or [])
    all_signals = signals | rules

    for signal in all_signals:
        if signal in RULE_INDEX:
            pts, evidence = RULE_INDEX[signal]
            triggered.append({"label": signal, "score": pts, "evidence": evidence})
            total += pts

    if payload.fraud_score and payload.fraud_score > 700:
        pts = 30
        triggered.append({"label": "high_upstream_score", "score": pts, "evidence": f"Upstream score: {payload.fraud_score}"})
        total += pts

    total = min(total, 1000)
    return total, triggered


def risk_level(score: int) -> RiskLevel:
    if score >= 150:
        return RiskLevel.critical
    if score >= 100:
        return RiskLevel.high
    if score >= 50:
        return RiskLevel.medium
    return RiskLevel.low
