from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
from enum import Enum


class RiskLevel(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class TransactionStatus(str, Enum):
    queued = "queued"
    investigating = "investigating"
    decided = "decided"


class IngestPayload(BaseModel):
    """Incoming transaction payload from fraud engine / webhook."""
    external_id: str = Field(..., description="ID from upstream system")
    source: str = Field(..., description="e.g. stripe, faster_payments, internal")

    amount_pence: int
    currency: str = "GBP"
    merchant_name: Optional[str] = None
    beneficiary_account: Optional[str] = None
    beneficiary_name: Optional[str] = None
    transfer_type: Optional[str] = None  # ACH, FPS, SEPA, SWIFT

    customer_id: str
    customer_email: Optional[str] = None
    account_age_days: Optional[int] = None
    kyc_status: Optional[str] = None

    ip_address: Optional[str] = None
    device_fingerprint: Optional[str] = None
    geolocation: Optional[str] = None

    fraud_score: Optional[int] = None       # 0–1000 from upstream engine
    fraud_signals: Optional[list[str]] = None
    triggered_rules: Optional[list[str]] = None

    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    raw_payload: Optional[dict] = None


class TransactionSummary(BaseModel):
    id: str
    external_id: str
    source: str
    amount_pence: int
    currency: str
    customer_id: str
    risk_score: int
    risk_level: RiskLevel
    status: TransactionStatus
    created_at: datetime
