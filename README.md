# bit

Internal web system for recording Bit-related transactions and tracking outstanding balances. It is intentionally small: one backend API, PostgreSQL, and two independently deployable UIs.

## Current status

See [`docs/PROGRESS.md`](docs/PROGRESS.md) for the implementation ledger and verification evidence. The deployed domain is `https://bit.elroy.site`.

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Routes are `/cashier`, `/admin`, and `/api` under one future hostname.

## Local development

### Backend

```bash
cd backend
uv venv .venv
source .venv/bin/activate
uv pip install -r requirements.txt
export DATABASE_URL=sqlite+pysqlite:///./bit.sqlite3
uvicorn app.main:app --reload --port 8000
```

The API exposes `/api/health`, `/docs`, transactions, customer projections and dashboard endpoints.

### UIs

```bash
cd cashier-ui && python3 -m http.server 8081 --directory public
cd admin-ui && python3 -m http.server 8082 --directory public
```

For a complete local stack: `docker compose up --build`.

## Environment variables

Copy `.env.example` to `.env` and provide environment-specific values. Never commit `.env` or credentials.

- `DATABASE_URL`: PostgreSQL SQLAlchemy URL.
- `RECEIPTS_DIR`: local receipt directory.
- `CORS_ORIGINS`: comma-separated allowed origins.
- `AUTH_MODE`: `proxy` (default) or `development`.
- `MAX_RECEIPT_BYTES`: upload limit.

## Migrations

Alembic migrations live under `backend/migrations`. Run `alembic upgrade head` from `backend`; the container entrypoint runs this before starting the API.

## Tests

```bash
cd backend
uv pip install -r requirements-dev.txt
pytest -q
```

## Docker

`docker compose up --build` starts PostgreSQL, backend, cashier UI and admin UI.

## Kubernetes

Apply `k8s/namespace.yaml`, PostgreSQL resources, backend resources, UI resources and `k8s/ingress.yaml`. Create the production Secret out-of-band; no secret values are in Git. Replace the placeholder hostname in the Ingress only after the domain is selected.

## Authentication

The API uses a small proxy-compatible boundary. In production, put OAuth2 Proxy or another central identity layer in front and pass authenticated identity headers. The cashier can use a long-lived proxy session on the trusted checkout machine; external access remains subject to the proxy. The application itself does not implement password storage or custom cryptography.

## Scope intentionally excluded

No product catalog, inventory, CRM, OCR, WhatsApp API, complex user system, Redis, queues or microservices. WhatsApp support only creates user-opened `wa.me` links.
