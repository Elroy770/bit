from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..core.auth import require_user
from ..core.db import get_db
from ..models import Transaction
from ..schemas.transaction import TransactionCreate, TransactionOut, TransactionUpdate
from ..services.transactions import as_dict, customers
from ..storage.receipts import save_receipt
from decimal import Decimal
from fastapi.encoders import jsonable_encoder
from pydantic import ValidationError

router=APIRouter(prefix="/api")
@router.get("/health")
def health(): return {"status":"ok"}
@router.post("/transactions", response_model=TransactionOut)
async def create_transaction(name:str=Form(...), phone:str=Form(...), amount:Decimal=Form(...), paid_amount:Decimal=Form(0), note:str|None=Form(None), receipt:UploadFile|None=File(None), db:Session=Depends(get_db), _:str=Depends(require_user)):
    try:
        data=TransactionCreate(name=name,phone=phone,amount=amount,paid_amount=paid_amount,note=note)
    except ValidationError as exc:
        raise HTTPException(422, detail=jsonable_encoder(exc.errors()))
    t=Transaction(**data.model_dump(),receipt_path=await save_receipt(receipt)); db.add(t); db.commit(); db.refresh(t); return as_dict(t)
@router.get("/transactions", response_model=list[TransactionOut])
def list_transactions(phone:str|None=None, db:Session=Depends(get_db), _:str=Depends(require_user)):
    q=select(Transaction).order_by(Transaction.created_at.desc())
    if phone: q=q.where(Transaction.phone==phone)
    return [as_dict(t) for t in db.scalars(q).all()]
@router.get("/transactions/{transaction_id}", response_model=TransactionOut)
def get_transaction(transaction_id:int,db:Session=Depends(get_db),_:str=Depends(require_user)):
    t=db.get(Transaction,transaction_id)
    if not t: raise HTTPException(404,"transaction not found")
    return as_dict(t)
@router.patch("/transactions/{transaction_id}", response_model=TransactionOut)
def update_transaction(transaction_id:int, data:TransactionUpdate, db:Session=Depends(get_db), _:str=Depends(require_user)):
    t=db.get(Transaction,transaction_id)
    if not t: raise HTTPException(404,"transaction not found")
    updates=data.model_dump(exclude_unset=True)
    amount=updates.get("amount",t.amount); paid=updates.get("paid_amount",t.paid_amount)
    if paid>amount: raise HTTPException(422,"paid_amount cannot exceed amount")
    for k,v in updates.items(): setattr(t,k,v)
    db.commit(); db.refresh(t); return as_dict(t)
@router.delete("/transactions/{transaction_id}")
def delete_transaction(transaction_id:int,db:Session=Depends(get_db),_:str=Depends(require_user)):
    t=db.get(Transaction,transaction_id)
    if not t: raise HTTPException(404,"transaction not found")
    db.delete(t); db.commit(); return {"deleted":True}
@router.get("/customers")
def list_customers(search:str|None=None,debt_only:bool=False,db:Session=Depends(get_db),_:str=Depends(require_user)): return customers(db,search,debt_only)
@router.get("/customers/{phone}")
def customer(phone:str,db:Session=Depends(get_db),_:str=Depends(require_user)):
    result=customers(db,phone)
    if not result: raise HTTPException(404,"customer not found")
    return {**result[0],"transactions":[as_dict(t) for t in db.scalars(select(Transaction).where(Transaction.phone==phone).order_by(Transaction.created_at.desc())).all()]}
@router.get("/dashboard")
def dashboard(db:Session=Depends(get_db),_:str=Depends(require_user)):
    cs=customers(db,debt_only=True); return {"total_debt":sum((x["balance"] for x in cs),Decimal(0)),"customers_in_debt":len(cs),"customers":cs}
