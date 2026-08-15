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

## Boundaries

- `services/transactions.py`: business rules and projections.
- `storage/`: receipt interface and local implementation; S3-compatible implementation can replace it later.
- `core/auth.py`: proxy-compatible authentication boundary.
- API schemas validate input before service calls.
