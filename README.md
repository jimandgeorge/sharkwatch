# EIGG Investigate

**AI transaction investigation copilot** for lean financial-crime teams — fintechs, PSPs,
e-money institutions, lenders and credit unions. Turns flagged transactions into fast,
confident, **defensible** fraud decisions, built around UK **APP fraud** and the PSR
mandatory-reimbursement regime.

- **AI investigation copilot** — streaming, evidence-based analysis with entity-network lookups
- **PSR compliance ready** — full append-only audit trail + one-click claim-pack generation
- **On-premises** — runs on the customer's infrastructure; data never leaves

> Sibling product to **EIGG Prevent** (the organisation-facing "failure to prevent fraud"
> compliance platform). Same idea — AI + a defensible audit trail — pointed at the
> transaction-facing investigation angle.

## Stack

- **Backend:** Python · FastAPI · PostgreSQL + pgvector
- **LLM:** swappable adapter — `mock` · `anthropic` · `azure` · `bedrock` · `ollama` (fully on-prem)
- **Frontend:** Next.js · React · Tailwind
- **API:** namespaced under `/api/v1`; auth via NextAuth (OIDC / shared password / accounts)

## Self-hosting (production)

Run EIGG Investigate on your own infrastructure from the published images — no source
checkout, no build. Everything (a pgvector Postgres included) runs in Docker; your
transaction and case data never leaves your servers.

```bash
cd deploy
cp .env.example .env      # set PUBLIC_URL, secrets, admin credentials
docker compose pull
docker compose up -d
```

Images are published to GitHub Container Registry
(`ghcr.io/jimandgeorge/eigg-investigate-{backend,frontend}`). Full steps — access tokens,
TLS, on-prem AI with Ollama, updates and backups — in
**[`deploy/INSTALL.md`](deploy/INSTALL.md)**.

## Repo layout

```
backend/    FastAPI — ingest, investigate, decisions, chat, entities, audit, admin
frontend/   Next.js — analyst queue, investigation view, admin panel, invite flow
infra/      nginx / helm
deploy/      customer self-host package (image-based compose + install guide)
```

## Admin & onboarding

Platform admins sign in with their email at `/login` and manage workspaces, users and
invites at `/admin`. Invited users set a password via `/invite/<token>` and land on the
dashboard. The first admin is seeded from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
