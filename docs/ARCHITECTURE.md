# Architecture

## Services

- `backend`: FastAPI REST API, SQLAlchemy persistence, receipt storage, auth boundary.
- `cashier-ui`: separate nginx-served UI for fast transaction entry.
- `admin-ui`: separate nginx-served UI for dashboard, customer projections, editing, payments and WhatsApp links.
- `postgres`: persistence.

## Routing

The ingress routes `/cashier` to cashier-ui, `/admin` to admin-ui and `/api` to backend. The hostname is intentionally a placeholder until the owner supplies the domain. UIs use relative `/api` calls so the eventual host is configured in one ingress, not in source code.

## Data model

`transactions` stores name, normalized phone, amount, paid amount, note, receipt path and timestamps. Customers are grouped projections, calculated from transactions. Debt is `amount - paid_amount`; paid transactions have zero balance.

## Authentication

The deployed authentication is local and intentionally limited to two users: `cashier` and `admin`. The backend uses Argon2id password hashes, a PostgreSQL `users` table, and hashed server-side session tokens in a PostgreSQL `sessions` table. Secure HttpOnly cookies carry only the raw session token. `cashier` can create transactions; `admin` can manage dashboard/customers/transactions. Role checks are enforced in API dependencies, while UI route guards provide a friendly experience. The cashier login supports a 30-day remembered session for the fixed checkout computer; normal sessions expire after 8 hours. Bootstrap passwords are supplied through the `bit-auth` Kubernetes Secret and are absent from Git.
