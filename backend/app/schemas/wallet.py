from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class DepositRequest(BaseModel):
    amount_usd: float = Field(..., gt=0)


class WithdrawRequest(BaseModel):
    amount_usd: float = Field(..., gt=0)
    withdrawal_method: str = "bank_transfer"
    withdrawal_details: Optional[str] = None


class GiftCardRedeemRequest(BaseModel):
    code: str = Field(..., min_length=4)


class AdminCreditDebitRequest(BaseModel):
    user_id: UUID
    amount_usd: float = Field(..., gt=0)
    reason: str = Field(..., min_length=5)


class AdminFreezeRequest(BaseModel):
    user_id: UUID
    amount_usd: float = Field(..., gt=0)
    reason: str = Field(..., min_length=5)


class WalletBalanceResponse(BaseModel):
    available_usd: float
    pending_usd: float
    frozen_usd: float
    total_usd: float


class WalletTransactionResponse(BaseModel):
    id: UUID
    entry_type: str
    amount_usd: float
    balance_available_after: float
    balance_pending_after: float
    balance_frozen_after: float
    order_id: Optional[UUID]
    description: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class WalletHistoryResponse(BaseModel):
    transactions: List[WalletTransactionResponse]
    total: int
    page: int
    page_size: int
