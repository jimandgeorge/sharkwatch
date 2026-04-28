#!/usr/bin/env python3
"""
Seed fraud_cases, policy_docs, and transactions with realistic APP fraud data.

Run after the stack is up:
  python -m backend.db.seed              # insert records (no embeddings)
  python -m backend.db.seed --embed      # insert + generate embeddings via Ollama

Embeddings are required for RAG retrieval to work. Run with --embed once
Ollama is running and nomic-embed-text has been pulled.
"""
import asyncio
import json
import ssl
import sys
import uuid
from datetime import datetime, timedelta, timezone

import asyncpg


def _ago(days: int = 0, hours: int = 0) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days, hours=hours)

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


# ── Transactions + investigations ─────────────────────────────────────────────
#
# Each entry has a "txn" block and an "inv" block.
# Entity overlaps are deliberate so the copilot's entity-context queries
# return useful evidence when an analyst investigates a pending case.
#
# Scenario A — Mule account (shared device + shared beneficiary)
#   fp-mule-device-001  /  GB12BARC20714583910167  (T Williams)
#   Three different customers; copilot will surface all three.
#
# Scenario B — Investment scam velocity
#   cust-david-mason-004 makes escalating transfers to new beneficiaries.
#   Copilot surfaces the prior two transfers when investigating the third.
#
# Scenario C — Romance scam (standalone pending)
# Scenario D — Bank impersonation / ATO (standalone pending)

TRANSACTIONS: list[dict] = [
    # ── A1: Mule account, historical, decided ───────────────────────────────────
    {
        "txn": {
            "external_id": "FPS-SEED-A001",
            "source": "faster_payments",
            "amount_pence": 320000,
            "customer_id": "cust-alice-hart-001",
            "customer_email": "alice.hart@example.com",
            "beneficiary_account": "GB12BARC20714583910167",
            "beneficiary_name": "T Williams",
            "transfer_type": "FPS",
            "ip_address": "82.45.112.77",
            "device_fingerprint": "fp-mule-device-001",
            "geolocation": "Bristol, UK",
            "fraud_signals": ["new_beneficiary", "large_unusual_transfer"],
            "risk_score": 75,
            "risk_level": "medium",
            "occurred_at": _ago(days=28),
        },
        "inv": {
            "fraud_type": "Suspicious transfer",
            "confidence": "medium",
            "summary": (
                "Customer transferred £3,200 to a new beneficiary (T Williams). "
                "Transfer is above the customer's 30-day average but not dramatically so. "
                "Device fingerprint had not previously been flagged. Step-up verification "
                "was completed successfully. No prior links to confirmed fraud cases at the time."
            ),
            "recommended_action": "approve",
            "risk_factors": [
                {"label": "new_beneficiary", "score": 40, "evidence": "New beneficiary — no prior payments to this account"},
                {"label": "large_unusual_transfer", "score": 35, "evidence": "Transfer above customer's 30-day average"},
            ],
            "policy_rules_triggered": ["New beneficiary transfer > £2,500 — step-up verification required"],
            "status": "decided",
        },
    },
    # ── A2: Mule account, historical, decided ───────────────────────────────────
    {
        "txn": {
            "external_id": "FPS-SEED-A002",
            "source": "faster_payments",
            "amount_pence": 750000,
            "customer_id": "cust-bob-price-002",
            "customer_email": "b.price@webmail.co.uk",
            "beneficiary_account": "GB12BARC20714583910167",
            "beneficiary_name": "T Williams",
            "transfer_type": "FPS",
            "ip_address": "91.208.34.19",
            "device_fingerprint": "fp-mule-device-001",
            "geolocation": "Cardiff, UK",
            "fraud_signals": ["new_beneficiary", "large_unusual_transfer", "mule_device_match"],
            "risk_score": 135,
            "risk_level": "high",
            "occurred_at": _ago(days=18),
        },
        "inv": {
            "fraud_type": "Suspected mule account",
            "confidence": "high",
            "summary": (
                "Customer transferred £7,500 to T Williams (GB12BARC20714583910167). "
                "Device fingerprint fp-mule-device-001 had previously appeared on a medium-risk "
                "transaction to the same beneficiary 10 days earlier. Beneficiary account has now "
                "received two payments totalling £10,700 from different customers. Pattern is "
                "consistent with a mule account. Payment held; customer was uncontactable within "
                "the 2-hour window. Payment blocked and customer contacted the following morning."
            ),
            "recommended_action": "hold",
            "risk_factors": [
                {"label": "new_beneficiary", "score": 40, "evidence": "New beneficiary for this customer"},
                {"label": "large_unusual_transfer", "score": 35, "evidence": "Transfer significantly above customer average"},
                {"label": "mule_device_match", "score": 60, "evidence": "Device fp-mule-device-001 linked to prior suspicious transfer to same beneficiary"},
            ],
            "policy_rules_triggered": [
                "New beneficiary + transfer > £5,000 — mandatory hold",
                "Device fingerprint matches flagged account — escalation required",
            ],
            "status": "decided",
        },
    },
    # ── A3: Mule account, PENDING (current investigation) ──────────────────────
    {
        "txn": {
            "external_id": "FPS-SEED-A003",
            "source": "faster_payments",
            "amount_pence": 1450000,
            "customer_id": "cust-carol-dean-003",
            "customer_email": "carol.dean@personalmail.com",
            "beneficiary_account": "GB12BARC20714583910167",
            "beneficiary_name": "T Williams",
            "transfer_type": "FPS",
            "ip_address": "185.220.101.45",
            "device_fingerprint": "fp-mule-device-001",
            "geolocation": "Manchester, UK",
            "fraud_signals": ["new_beneficiary", "large_unusual_transfer", "mule_device_match", "high_velocity"],
            "risk_score": 170,
            "risk_level": "critical",
            "occurred_at": _ago(hours=1),
        },
        "inv": {
            "fraud_type": "APP fraud — mule account",
            "confidence": "high",
            "summary": (
                "Carol Dean is attempting to transfer £14,500 to T Williams (GB12BARC20714583910167). "
                "This is the third payment to this beneficiary account from different customers in 28 days, "
                "with prior amounts of £3,200 and £7,500 — totalling £25,200 across three customers. "
                "Device fingerprint fp-mule-device-001 is shared across all three transactions, strongly "
                "indicating a coordinated mule account operation. The sending IP (185.220.101.45) resolves "
                "to a Tor exit node. Payment must be held immediately, customer contacted for welfare check, "
                "and a SAR filed. The beneficiary account should be reported to Barclays."
            ),
            "recommended_action": "hold",
            "risk_factors": [
                {"label": "new_beneficiary", "score": 40, "evidence": "New beneficiary for this customer"},
                {"label": "large_unusual_transfer", "score": 35, "evidence": "Transfer significantly above customer average"},
                {"label": "mule_device_match", "score": 60, "evidence": "Device fp-mule-device-001 linked to 2 prior transfers to same beneficiary across different customers"},
                {"label": "high_velocity", "score": 35, "evidence": "Third transfer to this beneficiary account in 28 days"},
            ],
            "policy_rules_triggered": [
                "New beneficiary + transfer > £5,000 — mandatory hold",
                "Device fingerprint matches known mule account — escalation required",
                "Mule account pattern confirmed — SAR filing mandatory",
            ],
            "status": "pending",
        },
    },
    # ── B1: Investment scam velocity, historical, decided ───────────────────────
    {
        "txn": {
            "external_id": "FPS-SEED-B001",
            "source": "faster_payments",
            "amount_pence": 420000,
            "customer_id": "cust-david-mason-004",
            "customer_email": "d.mason@outlook.com",
            "beneficiary_account": "GB87HSBC20481710342519",
            "beneficiary_name": "James Richardson",
            "transfer_type": "FPS",
            "ip_address": "86.11.203.44",
            "device_fingerprint": "fp-david-001",
            "geolocation": "Leeds, UK",
            "fraud_signals": ["new_beneficiary", "large_unusual_transfer"],
            "risk_score": 75,
            "risk_level": "medium",
            "occurred_at": _ago(days=12),
        },
        "inv": {
            "fraud_type": "Possible investment scam",
            "confidence": "low",
            "summary": (
                "David Mason transferred £4,200 to a new beneficiary James Richardson. "
                "Customer stated payment was for a personal loan repayment. Step-up verification "
                "completed successfully. No prior fraud signals on this account. "
                "Transfer approved with enhanced monitoring applied."
            ),
            "recommended_action": "approve",
            "risk_factors": [
                {"label": "new_beneficiary", "score": 40, "evidence": "New beneficiary for this customer"},
                {"label": "large_unusual_transfer", "score": 35, "evidence": "Transfer above customer's 30-day average"},
            ],
            "policy_rules_triggered": ["New beneficiary transfer > £2,500 — step-up verification required"],
            "status": "decided",
        },
    },
    # ── B2: Investment scam velocity, historical, decided ───────────────────────
    {
        "txn": {
            "external_id": "FPS-SEED-B002",
            "source": "faster_payments",
            "amount_pence": 610000,
            "customer_id": "cust-david-mason-004",
            "customer_email": "d.mason@outlook.com",
            "beneficiary_account": "GB29NWBK60161331926819",
            "beneficiary_name": "Michael Roberts",
            "transfer_type": "FPS",
            "ip_address": "86.11.203.44",
            "device_fingerprint": "fp-david-001",
            "geolocation": "Leeds, UK",
            "fraud_signals": ["new_beneficiary", "large_unusual_transfer", "high_velocity"],
            "risk_score": 110,
            "risk_level": "high",
            "occurred_at": _ago(days=6),
        },
        "inv": {
            "fraud_type": "Possible investment scam",
            "confidence": "medium",
            "summary": (
                "Second large transfer from David Mason in 12 days, this time to a different new "
                "beneficiary (Michael Roberts). Customer claims another personal loan repayment but "
                "cannot provide documentation. Two large transfers to different new beneficiaries "
                "within 12 days is consistent with 'drip-feed' investment scam typology. Transfer "
                "held pending customer contact. Customer was spoken to and insisted the transfers were "
                "legitimate — released under customer direction after an explicit fraud warning was given "
                "and documented."
            ),
            "recommended_action": "hold",
            "risk_factors": [
                {"label": "new_beneficiary", "score": 40, "evidence": "Second new beneficiary in 12 days"},
                {"label": "large_unusual_transfer", "score": 35, "evidence": "Transfer above customer average; amounts escalating"},
                {"label": "high_velocity", "score": 35, "evidence": "Second large transfer to a different new beneficiary in 12 days"},
            ],
            "policy_rules_triggered": [
                "New beneficiary + transfer > £5,000 — mandatory hold",
                "High velocity pattern — enhanced monitoring applied",
            ],
            "status": "decided",
        },
    },
    # ── B3: Investment scam velocity, PENDING ───────────────────────────────────
    {
        "txn": {
            "external_id": "FPS-SEED-B003",
            "source": "faster_payments",
            "amount_pence": 980000,
            "customer_id": "cust-david-mason-004",
            "customer_email": "d.mason@outlook.com",
            "beneficiary_account": "GB91LOYD20264837829140",
            "beneficiary_name": "Steven Clarke",
            "transfer_type": "FPS",
            "ip_address": "86.11.203.44",
            "device_fingerprint": "fp-david-001",
            "geolocation": "Leeds, UK",
            "fraud_signals": ["new_beneficiary", "large_unusual_transfer", "high_velocity"],
            "risk_score": 110,
            "risk_level": "high",
            "occurred_at": _ago(hours=2),
        },
        "inv": {
            "fraud_type": "Investment scam",
            "confidence": "high",
            "summary": (
                "David Mason is attempting a third large transfer to a new beneficiary in 12 days, "
                "totalling £20,100 across three payments (£4,200 + £6,100 + £9,800). Each beneficiary "
                "is a different new payee and the amounts are escalating — classic 'drip-feed' scam "
                "behaviour where victims are told each payment will unlock their returns. The prior "
                "transfer (6 days ago) was released under customer direction after a documented fraud "
                "warning. Immediate hold required. Customer must be contacted with a stronger intervention "
                "— a video call is recommended given the cumulative exposure of £20,100. Consider a "
                "temporary cooling-off restriction on new payee transfers."
            ),
            "recommended_action": "hold",
            "risk_factors": [
                {"label": "new_beneficiary", "score": 40, "evidence": "Third new beneficiary in 12 days — escalating pattern"},
                {"label": "large_unusual_transfer", "score": 35, "evidence": "Amounts escalating: £4,200 → £6,100 → £9,800"},
                {"label": "high_velocity", "score": 35, "evidence": "Three large transfers to different new beneficiaries in 12 days"},
            ],
            "policy_rules_triggered": [
                "New beneficiary + transfer > £5,000 — mandatory hold",
                "High velocity pattern — senior analyst review required",
                "Prior fraud warning given — mandatory customer contact before any release",
            ],
            "status": "pending",
        },
    },
    # ── C: Romance scam, PENDING ────────────────────────────────────────────────
    {
        "txn": {
            "external_id": "FPS-SEED-C001",
            "source": "faster_payments",
            "amount_pence": 1850000,
            "customer_id": "cust-emma-watts-005",
            "customer_email": "emmajwatts1957@gmail.com",
            "beneficiary_account": "GB55SRLG20394810293847",
            "beneficiary_name": "Dr Nikos Papadopoulos",
            "transfer_type": "FPS",
            "ip_address": "91.108.56.130",
            "device_fingerprint": "fp-emma-001",
            "geolocation": "Norwich, UK",
            "fraud_signals": ["new_beneficiary", "large_unusual_transfer", "high_upstream_score"],
            "risk_score": 105,
            "risk_level": "high",
            "occurred_at": _ago(hours=3),
        },
        "inv": {
            "fraud_type": "Romance scam",
            "confidence": "high",
            "summary": (
                "Emma Watts (account holder since 2019) is attempting to transfer £18,500 — her "
                "largest ever outbound transfer — to a new beneficiary named 'Dr Nikos Papadopoulos'. "
                "The customer has no prior history of transfers to international-sounding payees. "
                "The upstream fraud engine scored this 820/1000. The beneficiary name and transfer "
                "size relative to account history (median outbound: £340, making this 54x above average) "
                "are strongly consistent with romance scam typology, where victims are groomed online "
                "before being asked to transfer funds urgently. Recommend an immediate hold and a "
                "welfare check call — approach with empathy, not accusation."
            ),
            "recommended_action": "hold",
            "risk_factors": [
                {"label": "new_beneficiary", "score": 40, "evidence": "No prior payments to this account"},
                {"label": "large_unusual_transfer", "score": 35, "evidence": "£18,500 vs median outbound of £340 — 54x above average"},
                {"label": "high_upstream_score", "score": 30, "evidence": "Upstream fraud engine scored 820/1000"},
            ],
            "policy_rules_triggered": [
                "New beneficiary + transfer > £5,000 — mandatory hold",
                "Transfer > £10,000 — video verification required before release",
            ],
            "status": "pending",
        },
    },
    # ── D: Bank impersonation / ATO, PENDING ────────────────────────────────────
    {
        "txn": {
            "external_id": "FPS-SEED-D001",
            "source": "faster_payments",
            "amount_pence": 340000,
            "customer_id": "cust-frank-osei-006",
            "customer_email": "frank.osei@hotmail.com",
            "beneficiary_account": "GB22MONZ20014821936391",
            "beneficiary_name": "Secure Holding Account",
            "transfer_type": "FPS",
            "ip_address": "104.16.88.21",
            "device_fingerprint": "fp-frank-new-device-001",
            "geolocation": "Birmingham, UK",
            "fraud_signals": ["new_device", "password_reset_before_txn", "new_beneficiary"],
            "risk_score": 110,
            "risk_level": "high",
            "occurred_at": _ago(hours=1),
        },
        "inv": {
            "fraud_type": "Impersonation — bank staff",
            "confidence": "high",
            "summary": (
                "Frank Osei's account shows a password reset 18 minutes before this transfer, "
                "followed by login from a previously unseen device. The beneficiary name "
                "'Secure Holding Account' is a strong indicator of bank impersonation fraud, "
                "where victims are instructed by fraudsters posing as bank staff to move funds "
                "to a 'safe account'. Password reset → new device → safe-account beneficiary name "
                "is a textbook account takeover via social engineering. The sending IP resolves to "
                "a Cloudflare data centre (not a residential address), consistent with a fraudster "
                "using a VPN. Recommend an immediate account freeze and customer welfare call — "
                "do not mention the SAR or use the word 'suspicious'."
            ),
            "recommended_action": "escalate",
            "risk_factors": [
                {"label": "new_device", "score": 30, "evidence": "First login ever from this device fingerprint"},
                {"label": "password_reset_before_txn", "score": 40, "evidence": "Password reset 18 minutes before transfer initiated"},
                {"label": "new_beneficiary", "score": 40, "evidence": "'Secure Holding Account' — classic bank impersonation beneficiary pattern"},
            ],
            "policy_rules_triggered": [
                "Password reset within 60 minutes of transfer — mandatory hold",
                "New device + new beneficiary — step-up verification required",
                "Beneficiary name matches safe-account impersonation typology — escalate",
            ],
            "status": "pending",
        },
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
    pg_url = database_url.replace("postgresql+asyncpg://", "postgresql://").split("?")[0]

    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE

    conn = await asyncpg.connect(pg_url, ssl=ssl_ctx, statement_cache_size=0)
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

        print(f"\nSeeding {len(TRANSACTIONS)} transactions + investigations...")
        for entry in TRANSACTIONS:
            t = entry["txn"]
            inv = entry["inv"]
            txn_id = str(uuid.uuid4())

            row = await conn.fetchrow(
                """
                INSERT INTO transactions (
                    id, external_id, source, amount_pence, currency,
                    customer_id, customer_email,
                    beneficiary_account, beneficiary_name, transfer_type,
                    ip_address, device_fingerprint, geolocation,
                    fraud_signals, triggered_rules,
                    risk_score, risk_level, raw_payload, occurred_at
                ) VALUES (
                    $1, $2, $3, $4, 'GBP',
                    $5, $6,
                    $7, $8, $9,
                    $10, $11, $12,
                    $13::jsonb, '[]'::jsonb,
                    $14, $15, '{}'::jsonb, $16
                )
                ON CONFLICT (source, external_id) DO NOTHING
                RETURNING id
                """,
                txn_id,
                t["external_id"], t["source"], t["amount_pence"],
                t["customer_id"], t.get("customer_email"),
                t.get("beneficiary_account"), t.get("beneficiary_name"), t.get("transfer_type"),
                t.get("ip_address"), t.get("device_fingerprint"), t.get("geolocation"),
                json.dumps(t.get("fraud_signals", [])),
                t["risk_score"], t["risk_level"],
                t["occurred_at"],
            )

            actual_txn_id = str(row["id"]) if row else None
            if not actual_txn_id:
                print(f"  {t['external_id']} — already exists, skipping")
                continue

            await conn.execute(
                """
                INSERT INTO investigations (
                    transaction_id, risk_score, risk_level, fraud_type, confidence,
                    summary, recommended_action,
                    risk_factors, retrieved_case_ids, policy_rules_triggered,
                    llm_provider, llm_model, status
                )
                SELECT $1, $2, $3, $4, $5, $6, $7, $8::jsonb, '[]'::jsonb, $9::jsonb, $10, $11, $12
                WHERE NOT EXISTS (
                    SELECT 1 FROM investigations WHERE transaction_id = $1
                )
                """,
                actual_txn_id,
                t["risk_score"], t["risk_level"],
                inv["fraud_type"], inv["confidence"],
                inv["summary"], inv["recommended_action"],
                json.dumps(inv["risk_factors"]),
                json.dumps(inv["policy_rules_triggered"]),
                "anthropic", "claude-opus-4-7",
                inv["status"],
            )
            print(f"  {t['external_id']} — {inv['fraud_type']} ({inv['status']})")

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
    from pathlib import Path

    # Load .env from project root (two levels up from backend/db/)
    env_file = Path(__file__).parent.parent.parent / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip())

    db_url = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://fraud:changeme@localhost:5432/fraudcopilot",
    )
    ollama = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    do_embed = "--embed" in sys.argv

    asyncio.run(seed(db_url, do_embed, ollama))
