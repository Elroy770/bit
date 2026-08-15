import os
os.environ["DATABASE_URL"]="sqlite+pysqlite:///./test.sqlite3"
os.environ["AUTH_MODE"]="development"
from fastapi.testclient import TestClient
from app.main import app
from app.core.db import Base, engine
Base.metadata.drop_all(engine); Base.metadata.create_all(engine)
client=TestClient(app)

def test_validation():
    r=client.post("/api/transactions",data={"name":"A","phone":"bad","amount":"10"}); assert r.status_code==422
    r=client.post("/api/transactions",data={"name":"A","phone":"0501234567","amount":"10","paid_amount":"11"}); assert r.status_code==422

def test_create_partial_and_dashboard():
    r=client.post("/api/transactions",data={"name":"A","phone":"0501234567","amount":"200","paid_amount":"100"}); assert r.status_code==200; assert float(r.json()["balance"])==100
    r=client.post("/api/transactions",data={"name":"יוסי","phone":"0501234567","amount":"50","paid_amount":"50"}); assert r.status_code==200
    dash=client.get("/api/dashboard"); assert dash.status_code==200; assert float(dash.json()["total_debt"])==100; assert dash.json()["customers_in_debt"]==1
    customer=client.get("/api/customers/0501234567"); assert len(customer.json()["transactions"])==2

def test_edit_and_search():
    r=client.patch("/api/transactions/1",json={"phone":"0522222222","paid_amount":"200"}); assert r.status_code==200; assert float(r.json()["balance"])==0
    assert len(client.get("/api/customers",params={"search":"0522"}).json())==1
