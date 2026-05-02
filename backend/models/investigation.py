from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class RiskFactor(BaseModel):
    label: str
    score: int
    evidence: str


class RetrievedCase(BaseModel):
    case_id: str
    similarity: float
    summary: str
    outcome: str


class InvestigationResult(BaseModel):
    transaction_id: str
    risk_score: int
    risk_level: str

    fraud_type: Optional[str]               # e.g. "APP fraud", "ATO", "mule account"
    confidence: str                         # "high" | "medium" | "low"
    summary: str                            # one-paragraph human-readable explanation
    recommended_action: str                 # hold | approve | escalate | freeze | step_up

    risk_factors: list[RiskFactor]
    retrieved_cases: list[RetrievedCase]
    policy_rules_triggered: list[str]

    vulnerability_flag: bool = False
    vulnerability_indicators: list[str] = []

    generated_at: datetime
    llm_provider: str
    llm_model: str
