from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.core.database import get_db
from app.core.responses import success_response
from app.api.deps import get_current_user, require_admin, require_super_admin
from app.models.user import User
from app.services import wallet_service
from app.schemas.wallet import (
    DepositRequest, WithdrawRequest, GiftCardRedeemRequest,
    AdminCreditDebitRequest, AdminFreezeRequest,
    WalletBalanceResponse, WalletTransactionResponse
)


router = APIRouter(prefix="/wallet", tags=["Wallet"])


@router.get("/balance")
async def get_balance(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get wallet balance"""
    balance = await wallet_service.get_user_balance(db, user.id)
    return success_response(balance)


@router.get("/history")
async def get_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get wallet transaction history"""
    result = await wallet_service.get_wallet_history(db, user.id, page, page_size)
    return success_response(result.model_dump())


@router.post("/deposit")
async def deposit(
    data: DepositRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mock deposit"""
    entry = await wallet_service.deposit(db, user.id, data.amount_usd)
    return success_response(WalletTransactionResponse.model_validate(entry).model_dump())


@router.post("/withdraw")
async def withdraw(
    data: WithdrawRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Request withdrawal"""
    entry = await wallet_service.request_withdrawal(db, user.id, data.amount_usd, f"Withdrawal: {data.withdrawal_method}")
    return success_response(WalletTransactionResponse.model_validate(entry).model_dump())


@router.post("/redeem-giftcard")
async def redeem_giftcard(
    data: GiftCardRedeemRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Redeem gift card"""
    entry = await wallet_service.redeem_giftcard(db, user.id, data.code)
    return success_response(WalletTransactionResponse.model_validate(entry).model_dump())


# Admin endpoints
@router.post("/admin/credit")
async def admin_credit(
    data: AdminCreditDebitRequest,
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Admin credit user balance"""
    entry = await wallet_service.admin_credit(db, data.user_id, data.amount_usd, user.id, data.reason)
    return success_response(WalletTransactionResponse.model_validate(entry).model_dump())


@router.post("/admin/debit")
async def admin_debit(
    data: AdminCreditDebitRequest,
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Admin debit user balance"""
    entry = await wallet_service.admin_debit(db, data.user_id, data.amount_usd, user.id, data.reason)
    return success_response(WalletTransactionResponse.model_validate(entry).model_dump())


@router.post("/admin/freeze")
async def admin_freeze(
    data: AdminFreezeRequest,
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Admin freeze user balance"""
    entry = await wallet_service.admin_freeze(db, data.user_id, data.amount_usd, user.id, data.reason)
    return success_response(WalletTransactionResponse.model_validate(entry).model_dump())


@router.post("/admin/unfreeze")
async def admin_unfreeze(
    data: AdminFreezeRequest,
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Admin unfreeze user balance"""
    entry = await wallet_service.admin_unfreeze(db, data.user_id, data.amount_usd, user.id, data.reason)
    return success_response(WalletTransactionResponse.model_validate(entry).model_dump())
