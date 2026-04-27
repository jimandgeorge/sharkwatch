# Fraud Copilot

AI Transaction Investigation Copilot for credit unions and PSPs.
On-prem / VPC deployment — no customer data leaves their infrastructure.

## Product

Decision intelligence layer on top of existing fraud engines.
Turns flagged transactions into fast, confident fraud decisions with full audit trails.

Target customers: UK credit unions, PSPs.
Primary use case: APP fraud (account-to-account transfer fraud).

## Stack

**Backend:** Python, FastAPI, PostgreSQL + pgvector, Redis, Kafka/SQS
**LLM:** Ollama (self-hosted Llama 3.1 70B) — swappable for Azure OpenAI or AWS Bedrock via adapter
**Frontend:** Next.js, React, Tailwind
**Deployment:** Docker Compose (single-server) + Helm chart (Kubernetes)

## Architecture

```
Fraud Signals
    ↓
Ingestion API (FastAPI)
    ↓
Context Aggregator   ←── pgvector RAG (prior cases, policy rules)
    ↓
Risk Scorer (rule-based, weighted)
    ↓
LLM Investigation Engine (Ollama / Azure OpenAI / Bedrock)
    ↓
Decision Workflow (hold / approve / escalate — human approval always)
    ↓
Analyst Queue (Next.js dashboard)
    ↓
Audit Trail (Postgres)
```

## Key Principles

- Human approval always — never autonomous payment actions
- LLM never guesses — RAG retrieves facts from prior cases and policy docs
- Data never leaves customer infrastructure
- Full audit trail: decision, who approved, evidence used, timestamps
- RBAC, encryption at rest, GDPR-aware

## Project Structure

```
backend/
  api/          HTTP endpoints (ingest, investigate, decisions)
  core/         Config, DB, Redis connections
  models/       Pydantic + SQLAlchemy models
  services/     Business logic (context aggregator, risk scorer, LLM engine, RAG)
  db/           Schema + migrations

frontend/
  app/queue/            Analyst investigation queue
  app/investigation/    Per-transaction investigation view

infra/
  helm/         Kubernetes Helm chart
  nginx/        Reverse proxy config
```

## LLM Adapter

`backend/services/llm_engine.py` is the single integration point.
Switch provider by setting `LLM_PROVIDER` env var: `ollama` | `azure` | `bedrock`.
