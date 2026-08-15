# Bit — progress log

This file is the implementation ledger. Each entry records completed work and verification evidence.

## 15/08/2026 — Initial implementation

- Read `/home/opc/bit.md` and translated the MVP requirements into a small monorepo.
- Environment checked: Python 3.11.15, Node 22.22.0, Docker 29.5.3, kubectl client v1.29.15, Git 2.47.3.
- GitHub CLI is not installed and no Git identity was configured at the start. GitHub creation will be attempted only through an available token/API path; no credentials will be written to the project.
- Domain intentionally left as a placeholder (`bit.example.com`) per request.
- Chosen stack: FastAPI + SQLAlchemy + PostgreSQL backend; two independent static HTML/CSS/JS UIs served by nginx; Docker Compose and Kubernetes manifests. This avoids unnecessary frontend build complexity while keeping the UIs separately deployable.
- Created initial architecture and project skeleton.
- Implemented backend CRUD, customer projections, dashboard totals, partial/full payment rules, proxy-compatible auth boundary, receipt validation/storage, Alembic migration, and API tests.
- Implemented separate cashier/admin UIs with sub-path-safe nginx configs and WhatsApp link generation.
- Added Docker Compose and Kubernetes resources with out-of-band Secret placeholders; no final domain was selected or configured.
- Verified `pytest -q`: 3 passed. Verified Docker Compose config and Kubernetes client-side manifests: OK.

## Verification checklist

- [ ] Backend tests pass
- [ ] Docker Compose build/start verified
- [ ] Cashier transaction creation and receipt upload verified
- [ ] Admin grouping, dashboard, edit, partial payment and WhatsApp links verified
- [ ] Kubernetes manifests validated
- [ ] GitHub repository created and initial commit pushed

## Notes / decisions

- Authentication is deliberately an abstraction compatible with OAuth2 Proxy / trusted proxy headers. The API does not invent cryptography or store passwords.
- Customer records are a projection grouped by normalized phone; there is no Customer table.
- Receipt storage is behind a storage interface and validates MIME type, extension, size, and generated filenames.
