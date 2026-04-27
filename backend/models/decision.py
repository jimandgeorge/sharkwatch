from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum


class DecisionAction(str, Enum):
    approve = "approve"
    hold = "hold"
    freeze_account = "freeze_account"
    step_up_verification = "step_up_verification"
    escalate = "escalate"
    create_case = "create_case"


class DecisionPayload(BaseModel):
    transaction_id: str
    action: DecisionAction
    analyst_notes: Optional[str] = None
    override_reason: Optional[str] = None  # if overriding AI recommendation


class DecisionRecord(BaseModel):
    id: str
    transaction_id: str
    action: DecisionAction
    analyst_id: str
    analyst_notes: Optional[str]
    ai_recommended_action: str
    override_reason: Optional[str]
    risk_score: int
    decided_at: datetime
