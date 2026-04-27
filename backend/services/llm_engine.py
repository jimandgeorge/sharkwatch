"""
LLM Investigation Engine.

Switch provider via LLM_PROVIDER env var: ollama | azure | bedrock.
All providers return the same InvestigationResult shape.
"""
import json
from datetime import datetime
from ..core.config import settings
from ..models.investigation import InvestigationResult, RiskFactor, RetrievedCase

SYSTEM_PROMPT = """You are a fraud investigation analyst for a financial institution.
You will be given a transaction, risk signals, and retrieved prior cases.
Your job is to produce a concise, evidence-based fraud assessment.

Rules:
- Never speculate beyond the evidence provided.
- Always cite which signals and prior cases support your conclusion.
- Recommended actions: approve | hold | escalate | freeze_account | step_up_verification
- Confidence: high (strong evidence) | medium (partial evidence) | low (weak signals only)
- Output valid JSON only — no prose outside the JSON block.

Output schema:
{
  "fraud_type": "string or null",
  "confidence": "high|medium|low",
  "summary": "one paragraph explanation",
  "recommended_action": "approve|hold|escalate|freeze_account|step_up_verification",
  "policy_rules_triggered": ["list of rule names"]
}"""


def _build_prompt(context: dict) -> str:
    return f"""Transaction under investigation:
{json.dumps(context['transaction'], indent=2)}

Risk factors detected (score: {context['risk_score']}):
{json.dumps(context['risk_factors'], indent=2)}

Retrieved similar prior cases:
{json.dumps(context['prior_cases'], indent=2)}

Produce your fraud assessment as JSON."""


async def investigate(
    context: dict,
    risk_factors: list[dict],
    prior_cases: list[dict],
) -> InvestigationResult:
    full_context = {
        "transaction": context,
        "risk_score": context.get("risk_score", 0),
        "risk_factors": risk_factors,
        "prior_cases": prior_cases,
    }

    provider = settings.llm_provider
    if provider == "ollama":
        raw = await _call_ollama(full_context)
    elif provider == "azure":
        raw = await _call_azure(full_context)
    elif provider == "bedrock":
        raw = await _call_bedrock(full_context)
    elif provider == "mock":
        raw = _call_mock(full_context)
    else:
        raise ValueError(f"Unknown LLM provider: {provider}")

    parsed = json.loads(raw)

    return InvestigationResult(
        transaction_id=context["id"],
        risk_score=context.get("risk_score", 0),
        risk_level=context.get("risk_level", "medium"),
        fraud_type=parsed.get("fraud_type"),
        confidence=parsed.get("confidence", "low"),
        summary=parsed.get("summary", ""),
        recommended_action=parsed.get("recommended_action", "hold"),
        risk_factors=[RiskFactor(**f) for f in risk_factors],
        retrieved_cases=[RetrievedCase(**c) for c in prior_cases],
        policy_rules_triggered=parsed.get("policy_rules_triggered", []),
        generated_at=datetime.utcnow(),
        llm_provider=provider,
        llm_model=_model_name(),
    )


async def _call_ollama(context: dict) -> str:
    import httpx
    prompt = _build_prompt(context)
    async with httpx.AsyncClient(timeout=120) as client:
        res = await client.post(
            f"{settings.ollama_base_url}/api/chat",
            json={
                "model": settings.ollama_model,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                "stream": False,
                "format": "json",
            },
        )
        res.raise_for_status()
        return res.json()["message"]["content"]


async def _call_azure(context: dict) -> str:
    from openai import AsyncAzureOpenAI
    client = AsyncAzureOpenAI(
        azure_endpoint=settings.azure_openai_endpoint,
        api_key=settings.azure_openai_key,
        api_version="2024-08-01-preview",
    )
    prompt = _build_prompt(context)
    response = await client.chat.completions.create(
        model=settings.azure_openai_deployment,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
    )
    return response.choices[0].message.content


async def _call_bedrock(context: dict) -> str:
    import boto3, asyncio
    prompt = _build_prompt(context)
    client = boto3.client("bedrock-runtime", region_name=settings.aws_bedrock_region)
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 1024,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": prompt}],
    })
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: client.invoke_model(modelId=settings.aws_bedrock_model_id, body=body),
    )
    result = json.loads(response["body"].read())
    return result["content"][0]["text"]


def _call_mock(context: dict) -> str:
    score = context.get("risk_score", 0)
    signals = [f["label"] for f in context.get("risk_factors", [])]
    signal_text = ", ".join(signals) if signals else "none"

    if score >= 150:
        action, confidence, fraud_type = "hold", "high", "APP fraud — multiple high-risk signals"
    elif score >= 100:
        action, confidence, fraud_type = "step_up_verification", "medium", "Suspicious transfer pattern"
    elif score >= 50:
        action, confidence, fraud_type = "step_up_verification", "low", None
    else:
        action, confidence, fraud_type = "approve", "high", None

    return json.dumps({
        "fraud_type": fraud_type,
        "confidence": confidence,
        "summary": (
            f"[MOCK ANALYSIS] Risk score {score}. "
            f"Signals detected: {signal_text}. "
            "This is a development stub — set LLM_PROVIDER=ollama to get real AI analysis."
        ),
        "recommended_action": action,
        "policy_rules_triggered": [],
    })


def _model_name() -> str:
    if settings.llm_provider == "ollama":
        return settings.ollama_model
    if settings.llm_provider == "azure":
        return settings.azure_openai_deployment
    if settings.llm_provider == "mock":
        return "mock"
    return settings.aws_bedrock_model_id
