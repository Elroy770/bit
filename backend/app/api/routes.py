from datetime import datetime, timedelta, timezone
from decimal import Decimal

from pathlib import Path
from fastapi import APIRouter, Cookie, Depends, File, Form, HTTPException, Response, UploadFile
from fastapi.responses import FileResponse
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..core.auth import (
    clear_user_sessions,
    current_user,
    hash_password,
    new_session_token,
    require_role,
    token_digest,
    verify_password,
)
from ..core.config import settings
from ..core.db import get_db
from ..models import Session as LoginSession
from ..models import Transaction, User
from ..schemas.transaction import TransactionCreate, TransactionOut, TransactionUpdate
from ..services.transactions import as_dict, customers
from ..storage.receipts import save_receipt

router = APIRouter(prefix="/api")
admin_user = require_role("admin")
cashier_user = require_role("cashier")


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256)
    remember: bool = False


@router.get("/health")
def health():
    return {"status": "ok"}


@router.post("/auth/login")
def login(data: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == data.username, User.is_active.is_(True)))
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    raw_token = new_session_token()
    lifetime = timedelta(days=settings.remembered_session_days) if data.remember else timedelta(hours=settings.session_hours)
    db.add(LoginSession(
        token_hash=token_digest(raw_token),
        user_id=user.id,
        expires_at=datetime.now(timezone.utc) + lifetime,
    ))
    db.commit()
    response.set_cookie(
        key=settings.session_cookie_name,
        value=raw_token,
        max_age=int(lifetime.total_seconds()),
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )
    return {"username": user.username, "role": user.role}


@router.post("/auth/logout")
def logout(
    response: Response,
    db: Session = Depends(get_db),
    session_token: str | None = Cookie(default=None, alias=settings.session_cookie_name),
):
    if session_token:
        db.execute(delete(LoginSession).where(LoginSession.token_hash == token_digest(session_token)))
        db.commit()
    response.delete_cookie(settings.session_cookie_name, path="/")
    return {"logged_out": True}


@router.get("/auth/me")
def me(user: User = Depends(current_user)):
    return {"username": user.username, "role": user.role}


@router.post("/transactions", response_model=TransactionOut)
async def create_transaction(
    name: str = Form(...),
    phone: str = Form(...),
    amount: Decimal = Form(...),
    paid_amount: Decimal = Form(0),
    note: str | None = Form(None),
    receipt: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    _: User = Depends(cashier_user),
):
    try:
        data = TransactionCreate(name=name, phone=phone, amount=amount, paid_amount=paid_amount, note=note)
    except ValidationError as exc:
        raise HTTPException(422, detail=jsonable_encoder(exc.errors()))
    transaction = Transaction(**data.model_dump(), receipt_path=await save_receipt(receipt))
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return as_dict(transaction)


@router.get("/transactions", response_model=list[TransactionOut])
def list_transactions(phone: str | None = None, db: Session = Depends(get_db), _: User = Depends(admin_user)):
    query = select(Transaction).order_by(Transaction.created_at.desc())
    if phone:
        query = query.where(Transaction.phone == phone)
    return [as_dict(transaction) for transaction in db.scalars(query).all()]


@router.get("/transactions/{transaction_id}", response_model=TransactionOut)
def get_transaction(transaction_id: int, db: Session = Depends(get_db), _: User = Depends(admin_user)):
    transaction = db.get(Transaction, transaction_id)
    if not transaction:
        raise HTTPException(404, "transaction not found")
    return as_dict(transaction)


@router.patch("/transactions/{transaction_id}", response_model=TransactionOut)
def update_transaction(transaction_id: int, data: TransactionUpdate, db: Session = Depends(get_db), _: User = Depends(admin_user)):
    transaction = db.get(Transaction, transaction_id)
    if not transaction:
        raise HTTPException(404, "transaction not found")
    updates = data.model_dump(exclude_unset=True)
    amount = updates.get("amount", transaction.amount)
    paid = updates.get("paid_amount", transaction.paid_amount)
    if paid > amount:
        raise HTTPException(422, "paid_amount cannot exceed amount")
    for key, value in updates.items():
        setattr(transaction, key, value)
    db.commit()
    db.refresh(transaction)
    return as_dict(transaction)


@router.delete("/transactions/{transaction_id}")
def delete_transaction(transaction_id: int, db: Session = Depends(get_db), _: User = Depends(admin_user)):
    transaction = db.get(Transaction, transaction_id)
    if not transaction:
        raise HTTPException(404, "transaction not found")
    db.delete(transaction)
    db.commit()
    return {"deleted": True}


@router.get("/customers")
def list_customers(search: str | None = None, debt_only: bool = False, db: Session = Depends(get_db), _: User = Depends(admin_user)):
    return customers(db, search, debt_only)


@router.get("/customers/lookup")
def lookup_customer(phone: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if user.role not in {"cashier", "admin"}:
        raise HTTPException(403, "Insufficient permissions")
    normalized = phone.replace(" ", "").replace("-", "")
    result = customers(db, normalized)
    if not result:
        raise HTTPException(404, "customer not found")
    customer_data = result[0]
    return {"name": customer_data["name"], "phone": customer_data["phone"]}


@router.get("/customers/{phone}")
def customer(phone: str, db: Session = Depends(get_db), _: User = Depends(admin_user)):
    result = customers(db, phone)
    if not result:
        raise HTTPException(404, "customer not found")
    transactions = db.scalars(select(Transaction).where(Transaction.phone == phone).order_by(Transaction.created_at.desc())).all()
    return {**result[0], "transactions": [as_dict(transaction) for transaction in transactions]}


@router.get("/receipts/{receipt_name}")
def get_receipt(receipt_name: str, _: User = Depends(admin_user)):
    safe_name = Path(receipt_name).name
    if safe_name != receipt_name:
        raise HTTPException(404, "receipt not found")
    path = Path(settings.receipts_dir) / safe_name
    if not path.is_file():
        raise HTTPException(404, "receipt not found")
    return FileResponse(path)


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), _: User = Depends(admin_user)):
    debtor_customers = customers(db, debt_only=True)
    return {
        "total_debt": sum((customer["balance"] for customer in debtor_customers), Decimal(0)),
        "customers_in_debt": len(debtor_customers),
        "customers": debtor_customers,
    }
