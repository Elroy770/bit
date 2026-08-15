from decimal import Decimal
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from ..models import Transaction

def balance(t): return Decimal(t.amount) - Decimal(t.paid_amount)

def as_dict(t):
    return {"id":t.id,"name":t.name,"phone":t.phone,"amount":t.amount,"paid_amount":t.paid_amount,"balance":balance(t),"note":t.note,"receipt_path":t.receipt_path,"created_at":t.created_at,"updated_at":t.updated_at}

def customers(db: Session, search: str|None=None, debt_only=False):
    rows = db.scalars(select(Transaction).order_by(Transaction.created_at.desc())).all()
    groups = {}
    for t in rows:
        if search and search.lower() not in t.name.lower() and search not in t.phone: continue
        g=groups.setdefault(t.phone,{"name":t.name,"phone":t.phone,"total_amount":Decimal(0),"total_paid":Decimal(0),"balance":Decimal(0),"transaction_count":0})
        g["total_amount"] += Decimal(t.amount); g["total_paid"] += Decimal(t.paid_amount); g["balance"] += balance(t); g["transaction_count"] += 1
    result=list(groups.values())
    if debt_only: result=[x for x in result if x["balance"]>0]
    return sorted(result,key=lambda x:x["balance"],reverse=True)
