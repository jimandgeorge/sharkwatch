# Install EIGG Investigate (self-hosted)

Run EIGG Investigate on your own infrastructure from the published images — no source
checkout, no build. Everything (database included) runs in Docker. Your transaction and
case data never leaves your servers.

## Requirements
- A Linux host with **Docker** + the Docker Compose plugin.
- ~2 GB RAM, a few GB disk.
- Access to pull the images from GitHub Container Registry (see "Access" below).

## 1. Get these files
Copy this `deploy/` folder to your host (`docker-compose.yml`, `nginx.conf`,
`.env.example`). Then:
```bash
cp .env.example .env
```

## 2. Configure `.env`
Set at minimum:
- `PUBLIC_URL` — where users reach it (e.g. `http://eigg.yourco.internal` or your https URL).
- `DB_PASSWORD`, `SECRET_KEY` + `NEXTAUTH_SECRET` (`openssl rand -base64 32`), `INTERNAL_API_SECRET` (`openssl rand -hex 32`).
- `ADMIN_EMAIL` + `ADMIN_PASSWORD` — your first login.
- `LLM_PROVIDER` — `mock` to start, `ollama` for fully on-prem AI, or `anthropic` with a key.

## 3. Access to the images
If the packages are private, log in once with a token your EIGG contact provides:
```bash
echo <TOKEN> | docker login ghcr.io -u <your-github-username> --password-stdin
```
(If they're public, skip this.)

## 4. Start
```bash
docker compose pull
docker compose up -d
docker compose ps        # all services running
```
On first boot the backend creates its database schema (pgvector + tables) and seeds your admin.

## 5. Sign in
Open `PUBLIC_URL`, go to `/login`, sign in with your **`ADMIN_EMAIL`** (the email, with the
`@`) and `ADMIN_PASSWORD`, then visit **`/admin`** to create workspaces and invite analysts.
Connect your fraud engine via the **Integrate** page to start ingesting transactions.

## On-prem AI (optional but recommended)
For fully self-contained AI (no data leaving your network), run **Ollama** and point
`OLLAMA_BASE_URL` at it (e.g. `http://ollama:11434`). Pull a chat model (`llama3.1`) and the
embedding model (`nomic-embed-text`) — embeddings power similar-case retrieval (RAG).
With `LLM_PROVIDER=mock` the app runs but AI analysis is stubbed.

## TLS
The bundled nginx serves HTTP on port 80. Either put EIGG behind your existing reverse
proxy (terminate TLS there), or uncomment the 443 block in `nginx.conf`, drop your cert in
`./certs/{fullchain,privkey}.pem`, and uncomment the `443` port + `./certs` mount in compose.

## Update
```bash
docker compose pull && docker compose up -d
```
Pin `IMAGE_TAG=v1.x.x` in `.env` for reproducible installs instead of `latest`.

## Backups
The database lives in the `pgdata` Docker volume — back it up.
