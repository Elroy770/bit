from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field, field_validator
import re

class TransactionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=7, max_length=30)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    paid_amount: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)
    note: str | None = Field(default=None, max_length=2000)
    @field_validator("phone")
    @classmethod
    def valid_phone(cls, value):
        value = re.sub(r"[\s-]", "", value)
        if not re.fullmatch(r"\+?[0-9]{7,15}", value): raise ValueError("invalid phone number")
        return value
    @field_validator("paid_amount")
    @classmethod
    def non_overpaying(cls, value, info):
        amount = info.data.get("amount")
        if amount is not None and value > amount: raise ValueError("paid_amount cannot exceed amount")
        return value

class TransactionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    phone: str | None = Field(default=None, min_length=7, max_length=30)
    amount: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    paid_amount: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    note: str | None = Field(default=None, max_length=2000)
    @field_validator("phone")
    @classmethod
    def valid_phone(cls, value):
        if value is not None:
            value = re.sub(r"[\s-]", "", value)
            if not re.fullmatch(r"\+?[0-9]{7,15}", value): raise ValueError("invalid phone number")
        return value

class TransactionOut(BaseModel):
    id: int; name: str; phone: str; amount: Decimal; paid_amount: Decimal; balance: Decimal
    note: str | None; receipt_path: str | None; created_at: datetime; updated_at: datetime
    model_config = {"from_attributes": True}
