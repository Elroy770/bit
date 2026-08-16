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
- Deployed to the existing single-node Kubernetes cluster after restarting containerd with approval because the node had a TTRPC shim failure. PostgreSQL and receipt PVCs became Bound; all Bit Deployments became Ready.
- Configured the existing nginx Ingress/LoadBalancer with host `bit.elroy.site`, routes `/cashier`, `/admin`, `/api`, and cert-manager TLS secret `bit-tls`.
- Verified publicly: HTTP redirects to HTTPS; HTTPS Cashier HTTP 200; HTTPS Admin HTTP 200; HTTPS API health returns `{"status":"ok"}`; certificate is Ready and issued by `letsencrypt-prod`.
- Added a root fallback: `https://bit.elroy.site/` now redirects to `/cashier/` instead of returning 404, and verified the redirect publicly.
- Investigated slow transaction saves and Admin `NaN`/`undefined`: Kubernetes resources were healthy and API requests returned quickly, but protected endpoints returned `401 Authentication required` because the cluster is in `AUTH_MODE=proxy` without an OAuth2 Proxy in front. Updated both UIs to handle API errors safely; Admin now renders numeric zero values instead of `NaN`/`undefined`, and Cashier shows a clear authentication message. Rebuilt and rolled out both UI deployments; public UI routes returned HTTP 200.
- Implemented and deployed local authentication for exactly two users/roles. Added Argon2id password hashes, `users` and `sessions` migrations, server-side hashed sessions, HttpOnly/Secure cookies, login/logout/me endpoints, role guards, and separate UI login screens. Generated random bootstrap credentials on the server and stored them only in Kubernetes Secret `bit-auth` and local mode-600 file `.initial-credentials` (ignored by Git). Verified cashier login/me, remembered-session login, cashier denial from admin API (`403`), admin login/me, admin dashboard (`200`), and admin denial from cashier transaction API (`403`).

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
