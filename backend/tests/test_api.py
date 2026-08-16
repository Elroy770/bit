import os

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///./test.sqlite3"
os.environ["CASHIER_PASSWORD"] = "cashier-test-password"
os.environ["ADMIN_PASSWORD"] = "admin-test-password"
os.environ["AUTH_MODE"] = "proxy"

import pytest
from fastapi.testclient import TestClient

from app.core.db import Base, engine
from app.main import app


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app, base_url="https://testserver") as test_client:
        yield test_client


def login(client, username, password, remember=False):
    response = client.post("/api/auth/login", json={"username": username, "password": password, "remember": remember})
    assert response.status_code == 200
    return response


def test_validation_and_roles(client):
    login(client, "cashier", "cashier-test-password", remember=True)
    response = client.post("/api/transactions", data={"name": "A", "phone": "bad", "amount": "10"})
    assert response.status_code == 422
    response = client.get("/api/dashboard")
    assert response.status_code == 403


def test_create_partial_and_admin_dashboard(client):
    login(client, "cashier", "cashier-test-password")
    response = client.post("/api/transactions", data={"name": "A", "phone": "0501234567", "amount": "200", "paid_amount": "100"})
    assert response.status_code == 200
    assert float(response.json()["balance"]) == 100
    response = client.post("/api/transactions", data={"name": "A", "phone": "0501234567", "amount": "50", "paid_amount": "50"})
    assert response.status_code == 200

    client.cookies.clear()
    login(client, "admin", "admin-test-password")
    dashboard = client.get("/api/dashboard")
    assert dashboard.status_code == 200
    assert float(dashboard.json()["total_debt"]) == 100
    assert dashboard.json()["customers_in_debt"] == 1
    customer = client.get("/api/customers/0501234567")
    assert len(customer.json()["transactions"]) == 2


def test_edit_and_forbidden_transaction_creation(client):
    login(client, "cashier", "cashier-test-password")
    created = client.post("/api/transactions", data={"name": "A", "phone": "0501234567", "amount": "200"}).json()
    client.cookies.clear()
    login(client, "admin", "admin-test-password")
    response = client.patch(f"/api/transactions/{created['id']}", json={"phone": "0522222222", "paid_amount": "200"})
    assert response.status_code == 200
    assert float(response.json()["balance"]) == 0
    assert client.post("/api/transactions", data={"name": "A", "phone": "0501234567", "amount": "10"}).status_code == 403


def test_invalid_login_and_logout(client):
    assert client.post("/api/auth/login", json={"username": "cashier", "password": "wrong"}).status_code == 401
    login(client, "cashier", "cashier-test-password")
    assert client.get("/api/auth/me").json()["role"] == "cashier"
    assert client.post("/api/auth/logout").status_code == 200
    assert client.get("/api/auth/me").status_code == 401
