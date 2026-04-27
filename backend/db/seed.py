#!/usr/bin/env python3
"""
Seed fraud_cases and policy_docs with realistic APP fraud data.

Run after the stack is up:
  python -m backend.db.seed              # insert records (no embeddings)
  python -m backend.db.seed --embed      # insert + generate embeddings via Ollama

Embeddings are required for RAG retrieval to work. Run with --embed once
Ollama is running and nomic-embed-text has been pulled.
"""
import asyncio
import json
import sys
import uuid
from datetime import datetime

import asyncpg

# ── Fraud cases ────────────────────────────────────────────────────────────────

FRAUD_CASES = [
    {
        "case_ref": "APP-2024-001",
        "fraud_type": "Romance scam",
        "summary": (
            "Victim (age 67) met individual on dating site over 4 months. "
            "Instructed to transfer £12,450 to an 'investment account' held by a new beneficiary. "
            "New beneficiary added 6 minutes before transfer. Device fingerprint matched "
            "two prior mule accounts. Victim unaware of fraud until contacted by the credit union."
        ),
        "outcome": "hold — payment blocked, customer contacted, full reimbursement approved under PSR",
        "signals": ["new_beneficiary", "large_unusual_transfer", "mule_device_match"],
    },
    {
        "case_ref": "APP-2024-002",
        "fraud_type": "Invoice fraud",
        "summary": (
            "SME customer received email purportedly from regular supplier requesting a bank "
            "detail change. £45,200 transferred to mule account. Receiving account opened "
            "11 days prior. High-velocity pattern: 3 transfers totalling £67,000 in 24 hours."
        ),
        "outcome": "escalate — partial recovery via Faster Payments recall, PSR claim initiated",
        "signals": ["new_beneficiary", "large_unusual_transfer", "high_velocity", "new_account"],
    },
    {
        "case_ref": "APP-2024-003",
        "fraud_type": "Account takeover",
        "summary": (
            "Login from previously unseen device in a different city. Impossible travel detected: "
            "customer logged in from Manchester 40 minutes prior. Password reset followed by "
            "immediate £8,900 Faster Payments transfer. SIM swap confirmed with MNO — "
            "customer did not initiate the transfer."
        ),
        "outcome": "freeze_account — account frozen, transfer blocked, SIM swap reported to MNO",
        "signals": ["new_device", "impossible_travel", "password_reset_before_txn", "new_beneficiary"],
    },
    {
        "case_ref": "APP-2024-004",
        "fraud_type": "Impersonation — bank staff",
        "summary": (
            "Customer received call from a number spoofing the credit union. Caller claimed "
            "the account was compromised and instructed the customer to move funds to a 'safe account'. "
            "£23,750 transferred in two tranches within 90 minutes. KYC incomplete on receiving "
            "account. Sanctioned beneficiary match flagged post-transfer."
        ),
        "outcome": "escalate — reported to Action Fraud, full PSR reimbursement approved",
        "signals": ["new_beneficiary", "high_velocity", "kyc_incomplete", "sanctioned_beneficiary"],
    },
    {
        "case_ref": "APP-2024-005",
        "fraud_type": "Mule account",
        "summary": (
            "Account received multiple small inbound transfers from different customers "
            "within a 6-hour window, immediately forwarded via Faster Payments. "
            "Device fingerprint shared with four other flagged accounts opened within the same week. "
            "Pattern consistent with a structured money mule operation."
        ),
        "outcome": "freeze_account — account frozen, SAR filed, referred to NCA",
        "signals": ["mule_device_match", "high_velocity", "new_account", "prior_chargeback_link"],
    },
    {
        "case_ref": "APP-2024-006",
        "fraud_type": "Investment scam",
        "summary": (
            "Customer (age 43) directed to a cloned investment platform via social media ad. "
            "Three transfers totalling £31,000 over 8 days, each to different new beneficiaries. "
            "Upstream fraud engine scored 810. Customer believed returns of 40% were guaranteed. "
            "Account age 2 years, no prior fraud flags — first-time victim profile."
        ),
        "outcome": "hold — payments blocked on third attempt, customer counselled, partial reimbursement",
        "signals": ["new_beneficiary", "high_velocity", "large_unusual_transfer", "high_upstream_score"],
    },
]

# ── Policy documents ───────────────────────────────────────────────────────────

POLICY_DOCS = [
    {
        "title": "PSR Mandatory Reimbursement — APP Fraud (effective October 2024)",
        "content": """
From 7 October 2024, the Payment Systems Regulator (PSR) mandates that sending Payment
Service Providers must reimburse victims of Authorised Push Payment (APP) fraud for
transactions made via Faster Payments.

Key requirements:
- Maximum reimbursement per claim: £85,000
- Liability split: 50% sending PSP, 50% receiving PSP
- Assessment deadline: 5 business days from claim
- Standard of caution exception applies if customer showed gross negligence

Exemptions from mandatory reimbursement:
- Micro-enterprises and charities (covered under separate rules)
- First-party fraud (customer initiated with intent to defraud)
- Gross negligence (customer ignored explicit, clear fraud warnings)
- Transactions not via Faster Payments (CHAPS and SWIFT are not covered)

Audit implications:
- Every hold or block decision must have documented investigation rationale
- Any analyst override of the AI recommendation must include written justification
- Reimbursement decisions are subject to PSR and FCA audit
- Retain all evidence for minimum 6 years
""".strip(),
    },
    {
        "title": "APP Fraud Risk Thresholds and Escalation Policy",
        "content": """
Internal risk thresholds for APP fraud investigation decisions:

Risk score bands:
- 0–49   LOW      Approve with standard monitoring
- 50–99  MEDIUM   Step-up verification required before release
- 100–149 HIGH    Hold payment; analyst review within 2 hours
- 150+   CRITICAL Immediate hold; senior analyst review; mandatory customer contact

Mandatory hold triggers (regardless of score):
- New beneficiary + transfer amount > £5,000
- Password reset within 60 minutes of transfer
- Device fingerprint matches known mule account
- Impossible travel detected in session data
- Sanctioned or PEP-linked beneficiary

Escalation to Financial Crime team required when:
- Risk score exceeds 200
- Mule device match confirmed by analyst
- Suspicious Activity Report (SAR) filing is required
- Case links to prior confirmed fraud outcome

Time limits:
- Faster Payments: 2 hours maximum hold before auto-release
- CHAPS: 4 hours maximum hold before auto-release
- CRITICAL cases: first analyst contact within 30 minutes
""".strip(),
    },
    {
        "title": "Step-up Verification Protocol",
        "content": """
Step-up verification must be applied when any of the following conditions are met:
1. Risk score between 50 and 149 with no confirmed mule fingerprint match
2. New beneficiary added and transfer amount exceeds customer's 30-day rolling average
3. First transfer greater than £2,500 to a new payee
4. Login from a new device within 24 hours preceding a large transfer

Acceptable verification methods (in order of preference):
1. Biometric re-authentication via registered mobile app
2. One-time passcode to registered mobile number (not acceptable if SIM swap suspected)
3. Video call with live identity document verification (required for transfers > £20,000)
4. In-branch visit with photographic ID (required for transfers > £50,000)

SIM swap guidance:
- OTP via SMS is not sufficient if SIM swap is suspected
- Escalate to biometric or video verification immediately
- Contact MNO to confirm SIM status before releasing funds

Outcome recording requirements:
- Verification passed: record method, timestamp, and analyst ID
- Verification failed: escalate immediately and freeze account pending review
- Customer unreachable: hold payment for up to 4 hours then escalate to senior analyst
""".strip(),
    },
    {
        "title": "Account Freeze and SAR Filing Policy",
        "content": """
An account freeze is appropriate when one or more of the following apply:
- Device fingerprint confirmed match to known mule network
- Sanctioned beneficiary payment attempted or completed
- Account identified as receiving end of confirmed APP fraud
- Customer confirmed victim of account takeover
- Three or more high-risk transactions within a 24-hour window

SAR (Suspicious Activity Report) filing is mandatory when:
- Confirmed or strongly suspected money laundering activity
- Mule account pattern identified
- Sanctions list match on beneficiary or customer
- Transaction linked to prior criminal investigation

SAR filing must occur within 24 hours of decision. Consent must be obtained from
the National Crime Agency (NCA) before unfreezing an account where a SAR has been filed.

Tipping off prohibition:
- Do NOT inform the customer that a SAR has been filed
- Do NOT use the word 'suspicious' when communicating hold reasons to the customer
- Use neutral language: 'additional verification required', 'payment under review'

Freeze duration:
- Initial freeze: up to 7 days without customer consent
- Extended freeze: requires court order or NCA consent beyond 7 days
""".strip(),
    },
]


# ── Embedding ──────────────────────────────────────────────────────────────────

async def _embed(text: str, ollama_url: str) -> list[float] | None:
    try:
        import httpx
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.post(
                f"{ollama_url}/api/embed",
                json={"model": "nomic-embed-text", "input": text},
            )
            res.raise_for_status()
            return res.json()["embeddings"][0]
    except Exception as e:
        print(f"  [warn] embedding failed: {e}")
        return None


def _vec_literal(v: list[float]) -> str:
    return "[" + ",".join(f"{x:.8f}" for x in v) + "]"


# ── Main ───────────────────────────────────────────────────────────────────────

async def seed(database_url: str, generate_embeddings: bool, ollama_url: str) -> None:
    # asyncpg uses a plain postgres:// URL, not the SQLAlchemy asyncpg+postgresql one
    pg_url = database_url.replace("postgresql+asyncpg://", "postgresql://")

    conn = await asyncpg.connect(pg_url)
    try:
        print(f"Seeding {len(FRAUD_CASES)} fraud cases...")
        for case in FRAUD_CASES:
            embedding = None
            if generate_embeddings:
                print(f"  Embedding {case['case_ref']}...")
                embedding = await _embed(case["summary"], ollama_url)

            await conn.execute(
                """
                INSERT INTO fraud_cases (id, case_ref, fraud_type, summary, outcome, signals, embedding, created_at)
                VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::vector, $8)
                ON CONFLICT (case_ref) DO UPDATE
                  SET summary = EXCLUDED.summary,
                      outcome = EXCLUDED.outcome,
                      signals = EXCLUDED.signals,
                      embedding = COALESCE(EXCLUDED.embedding, fraud_cases.embedding)
                """,
                str(uuid.uuid4()),
                case["case_ref"],
                case["fraud_type"],
                case["summary"],
                case["outcome"],
                json.dumps(case["signals"]),
                _vec_literal(embedding) if embedding else None,
                datetime.utcnow(),
            )
            status = "with embedding" if embedding else "no embedding"
            print(f"  {case['case_ref']} ({case['fraud_type']}) — {status}")

        print(f"\nSeeding {len(POLICY_DOCS)} policy documents...")
        for doc in POLICY_DOCS:
            embedding = None
            if generate_embeddings:
                print(f"  Embedding '{doc['title']}'...")
                embedding = await _embed(doc["content"], ollama_url)

            await conn.execute(
                """
                INSERT INTO policy_docs (id, title, content, embedding, updated_at)
                VALUES ($1, $2, $3, $4::vector, $5)
                ON CONFLICT DO NOTHING
                """,
                str(uuid.uuid4()),
                doc["title"],
                doc["content"],
                _vec_literal(embedding) if embedding else None,
                datetime.utcnow(),
            )
            status = "with embedding" if embedding else "no embedding"
            print(f"  '{doc['title']}' — {status}")

        print("\nDone.")
        if not generate_embeddings:
            print(
                "RAG retrieval won't work until embeddings are generated.\n"
                "Re-run with --embed once Ollama is up and nomic-embed-text is pulled."
            )

    finally:
        await conn.close()


if __name__ == "__main__":
    import os

    db_url = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://fraud:changeme@localhost:5432/fraudcopilot",
    )
    ollama = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    do_embed = "--embed" in sys.argv

    asyncio.run(seed(db_url, do_embed, ollama))
