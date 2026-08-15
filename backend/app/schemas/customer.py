from decimal import Decimal
from pydantic import BaseModel
class CustomerOut(BaseModel):
    name: str; phone: str; total_amount: Decimal; total_paid: Decimal; balance: Decimal; transaction_count: int
