"""
RAG retrieval via pgvector.

Embeds a query using the configured LLM provider's embedding model,
then runs cosine similarity search against fraud_cases and policy_docs.
Returns empty lists gracefully when tables have no embeddings yet.
"""
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from ..core.config import settings


# ── Embedding ──────────────────────────────────────────────────────────────────

async def embed(query: str) -> list[float]:
    if settings.llm_provider == "azure":
        return await _embed_azure(query)
    return await _embed_ollama(query)


async def _embed_ollama(query: str) -> list[float]:
    import httpx
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            f"{settings.ollama_base_url}/api/embed",
            json={"model": settings.ollama_embed_model, "input": query},
        )
        res.raise_for_status()
        return res.json()["embeddings"][0]


async def _embed_azure(query: str) -> list[float]:
    from openai import AsyncAzureOpenAI
    client = AsyncAzureOpenAI(
        azure_endpoint=settings.azure_openai_endpoint,
        api_key=settings.azure_openai_key,
        api_version="2024-08-01-preview",
    )
    response = await client.embeddings.create(
        model=settings.azure_embed_deployment,
        input=query,
        dimensions=768,
    )
    return response.data[0].embedding


# ── Retrieval ──────────────────────────────────────────────────────────────────

def _vec_literal(v: list[float]) -> str:
    """Format a float list as a pgvector literal string."""
    return "[" + ",".join(f"{x:.8f}" for x in v) + "]"


async def retrieve_cases(
    db: AsyncSession,
    embedding: list[float],
    limit: int = 5,
    min_similarity: float = 0.65,
) -> list[dict]:
    vec = _vec_literal(embedding)
    rows = await db.execute(
        text("""
            SELECT
                id::text AS case_id,
                case_ref,
                fraud_type,
                summary,
                outcome,
                signals,
                1 - (embedding <=> :vec::vector) AS similarity
            FROM fraud_cases
            WHERE embedding IS NOT NULL
              AND 1 - (embedding <=> :vec::vector) >= :min_sim
            ORDER BY embedding <=> :vec::vector
            LIMIT :limit
        """),
        {"vec": vec, "limit": limit, "min_sim": min_similarity},
    )
    return [
        {
            "case_id": r["case_id"],
            "case_ref": r["case_ref"],
            "fraud_type": r["fraud_type"],
            "summary": r["summary"],
            "outcome": r["outcome"],
            "signals": r["signals"] if isinstance(r["signals"], list) else [],
            "similarity": round(float(r["similarity"]), 4),
        }
        for r in rows.mappings()
    ]


async def retrieve_policy(
    db: AsyncSession,
    embedding: list[float],
    limit: int = 3,
    min_similarity: float = 0.60,
) -> list[dict]:
    vec = _vec_literal(embedding)
    rows = await db.execute(
        text("""
            SELECT
                id::text AS doc_id,
                title,
                LEFT(content, 600) AS excerpt,
                1 - (embedding <=> :vec::vector) AS similarity
            FROM policy_docs
            WHERE embedding IS NOT NULL
              AND 1 - (embedding <=> :vec::vector) >= :min_sim
            ORDER BY embedding <=> :vec::vector
            LIMIT :limit
        """),
        {"vec": vec, "limit": limit, "min_sim": min_similarity},
    )
    return [
        {
            "doc_id": r["doc_id"],
            "title": r["title"],
            "excerpt": r["excerpt"],
            "similarity": round(float(r["similarity"]), 4),
        }
        for r in rows.mappings()
    ]


# ── Main entry point ───────────────────────────────────────────────────────────

async def retrieve_for_transaction(
    db: AsyncSession,
    transaction: dict,
    risk_factors: list[dict],
) -> tuple[list[dict], list[dict]]:
    """
    Returns (similar_cases, policy_excerpts).
    Builds the query string from transaction signals, then embeds and retrieves.
    Falls back to empty lists if the embed service is unavailable.
    """
    signal_labels = " ".join(f["label"] for f in risk_factors)
    query = (
        f"{transaction.get('transfer_type', 'transfer')} transaction "
        f"beneficiary {transaction.get('beneficiary_name', 'unknown')} "
        f"amount {transaction.get('amount_pence', 0)} GBP pence "
        f"signals: {signal_labels}"
    ).strip()

    try:
        embedding = await embed(query)
    except Exception:
        return [], []

    cases = await retrieve_cases(db, embedding)
    policy = await retrieve_policy(db, embedding)
    return cases, policy
