"""
Super Admin API routes with comprehensive owner-grade controls.
All routes require super_admin role and use audit logging.
"""
from fastapi import APIRouter, Depends, Query, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from uuid import UUID
from datetime import datetime

from app.core.database import get_db
from app.core.responses import success_response
from app.api.deps import require_super_admin
from app.models.user import User
from app.services.superadmin_service import SuperAdminService
from app.schemas.superadmin import (
    CreateAdminRequest, AdminToggleRequest, AdminResponse,
    UserStatusUpdateRequest, UserRoleUpdateRequest, UserDetailResponse,
    UnlockProfileRequest,
    WalletCreditRequest, WalletDebitRequest, WalletFreezeRequest, WalletUnfreezeRequest,
    ForceOrderActionRequest, ExtendDisputeWindowRequest,
    PlatformConfigUpdate, PlatformConfigResponse,
    HideListingRequest, HideMessageRequest,
    AdminActionResponse, AdminActionFilter,
    GameCreateRequest, GameUpdateRequest, FeeRuleRequest,
    GiftCardCreateRequest, GiftCardResponse,
    LegalDocumentUpdate
)
from app.schemas.auth import UserResponse


router = APIRouter(prefix="/superadmin", tags=["Super Admin"])


def get_request_info(request: Request):
    """Extract IP and user agent from request"""
    ip = request.client.host if request.client else None
    # Check for forwarded headers
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        ip = forwarded.split(",")[0].strip()
    user_agent = request.headers.get("User-Agent")
    return ip, user_agent


# ==================== DASHBOARD ====================

@router.get("/dashboard")
async def get_dashboard(
    request: Request,
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get comprehensive dashboard statistics"""
    ip, ua = get_request_info(request)
    service = SuperAdminService(db, user, ip, ua)
    stats = await service.get_dashboard_stats()
    return success_response(stats)


@router.get("/system-health")
async def get_system_health(
    request: Request,
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get system health status"""
    ip, ua = get_request_info(request)
    service = SuperAdminService(db, user, ip, ua)
    health = await service.get_system_health()
    return success_response(health)


@router.get("/admin-actions")
async def get_admin_actions(
    request: Request,
    action_type: Optional[str] = None,
    actor_id: Optional[UUID] = None,
    target_type: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get admin action audit logs"""
    ip, ua = get_request_info(request)
    service = SuperAdminService(db, user, ip, ua)
    actions, total = await service.get_admin_actions(
        action_type=action_type,
        actor_id=actor_id,
        target_type=target_type,
        from_date=from_date,
        to_date=to_date,
        page=page,
        page_size=page_size
    )
    
    return success_response({
        "actions": [AdminActionResponse.model_validate(a).model_dump() for a in actions],
        "total": total,
        "page": page,
        "page_size": page_size
    })


# ==================== ADMIN MANAGEMENT ====================

@router.post("/admins")
async def create_admin(
    request: Request,
    data: CreateAdminRequest,
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Create a new admin account (super admin only)"""
    ip, ua = get_request_info(request)
    service = SuperAdminService(db, user, ip, ua)
    admin = await service.create_admin(
        email=data.email,
        username=data.username,
        full_name=data.full_name,
        password=data.password,
        phone_number=data.phone_number,
        address_line1=data.address_line1,
        city=data.city,
        country=data.country,
        admin_password=data.admin_password
    )
    return success_response(AdminResponse.model_validate(admin).model_dump())


@router.get("/admins")
async def list_admins(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """List all admin accounts"""
    ip, ua = get_request_info(request)
    service = SuperAdminService(db, user, ip, ua)
    admins, total = await service.list_admins(page, page_size)
    
    return success_response({
        "admins": [AdminResponse.model_validate(a).model_dump() for a in admins],
        "total": total,
        "page": page,
        "page_size": page_size
    })


@router.patch("/admins/{admin_id}")
async def toggle_admin(
    request: Request,
    admin_id: UUID,
    data: AdminToggleRequest,
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Enable or disable an admin account"""
    ip, ua = get_request_info(request)
    service = SuperAdminService(db, user, ip, ua)
    admin = await service.toggle_admin(
        admin_id=admin_id,
        is_active=data.is_active,
        reason=data.reason,
        admin_password=data.admin_password
    )
    return success_response(AdminResponse.model_validate(admin).model_dump())


# ==================== USER MANAGEMENT ====================

@router.get("/users")
async def list_users(
    request: Request,
    role: Optional[str] = None,
    status: Optional[str] = None,
    kyc_status: Optional[str] = None,
    q: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """List users with filters"""
    ip, ua = get_request_info(request)
    service = SuperAdminService(db, user, ip, ua)
    users, total = await service.list_users(
        role=role,
        status=status,
        kyc_status=kyc_status,
        q=q,
        page=page,
        page_size=page_size
    )
    
    return success_response({
        "users": [UserResponse.model_validate(u).model_dump() for u in users],
        "total": total,
        "page": page,
        "page_size": page_size
    })


@router.get("/users/{user_id}")
async def get_user_detail(
    request: Request,
    user_id: UUID,
    admin: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get detailed user info with wallet and stats"""
    ip, ua = get_request_info(request)
    service = SuperAdminService(db, admin, ip, ua)
    detail = await service.get_user_detail(user_id)
    
    user_data = UserResponse.model_validate(detail["user"]).model_dump()
    user_data["wallet_available"] = detail["wallet_available"]
    user_data["wallet_pending"] = detail["wallet_pending"]
    user_data["wallet_frozen"] = detail["wallet_frozen"]
    user_data["total_orders"] = detail["total_orders"]
    user_data["total_listings"] = detail["total_listings"]
    
    return success_response(user_data)


@router.patch("/users/{user_id}/status")
async def update_user_status(
    request: Request,
    user_id: UUID,
    data: UserStatusUpdateRequest,
    admin: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Ban/unban user"""
    ip, ua = get_request_info(request)
    service = SuperAdminService(db, admin, ip, ua)
    user = await service.update_user_status(
        user_id=user_id,
        status=data.status,
        reason=data.reason,
        admin_password=data.admin_password
    )
    return success_response(UserResponse.model_validate(user).model_dump())


@router.patch("/users/{user_id}/roles")
async def update_user_roles(
    request: Request,
    user_id: UUID,
    data: UserRoleUpdateRequest,
    admin: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Promote/demote user roles"""
    ip, ua = get_request_info(request)
    service = SuperAdminService(db, admin, ip, ua)
    user = await service.update_user_roles(
        user_id=user_id,
        roles=data.roles,
        reason=data.reason,
        admin_password=data.admin_password
    )
    return success_response(UserResponse.model_validate(user).model_dump())


@router.post("/users/{user_id}/force-logout")
async def force_logout_user(
    request: Request,
    user_id: UUID,
    reason: str = Query(..., min_length=5),
    admin: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Force logout user (revoke all sessions)"""
    ip, ua = get_request_info(request)
    service = SuperAdminService(db, admin, ip, ua)
    await service.force_logout_user(user_id, reason)
    return success_response({"message": "User sessions revoked"})


@router.post("/users/{user_id}/unlock-profile")
async def unlock_profile(
    request: Request,
    user_id: UUID,
    data: UnlockProfileRequest,
    admin: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Unlock profile for editing after KYC approval"""
    ip, ua = get_request_info(request)
    service = SuperAdminService(db, admin, ip, ua)
    user = await service.unlock_profile(
        user_id=user_id,
        reason=data.reason,
        admin_password=data.admin_password
    )
    return success_response(UserResponse.model_validate(user).model_dump())


# ==================== WALLET / FINANCE ====================

@router.post("/wallet/credit")
async def credit_wallet(
    request: Request,
    data: WalletCreditRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    admin: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Credit user wallet"""
    ip, ua = get_request_info(request)
    service = SuperAdminService(db, admin, ip, ua)
    result = await service.credit_wallet(
        user_id=data.user_id,
        amount_usd=data.amount_usd,
        reason=data.reason,
        idempotency_key=idempotency_key
    )
    return success_response(result)


@router.post("/wallet/debit")
async def debit_wallet(
    request: Request,
    data: WalletDebitRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    admin: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Debit user wallet (requires password confirmation)"""
    ip, ua = get_request_info(request)
    service = SuperAdminService(db, admin, ip, ua)
    result = await service.debit_wallet(
        user_id=data.user_id,
        amount_usd=data.amount_usd,
        reason=data.reason,
        admin_password=data.admin_password,
        confirm_phrase=data.confirm_phrase,
        idempotency_key=idempotency_key
    )
    return success_response(result)


@router.post("/wallet/freeze")
async def freeze_funds(
    request: Request,
    data: WalletFreezeRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    admin: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Freeze user funds (requires password confirmation)"""
    ip, ua = get_request_info(request)
    service = SuperAdminService(db, admin, ip, ua)
    result = await service.freeze_funds(
        user_id=data.user_id,
        amount_usd=data.amount_usd,
        reason=data.reason,
        admin_password=data.admin_password,
        confirm_phrase=data.confirm_phrase,
        idempotency_key=idempotency_key
    )
    return success_response(result)


@router.post("/wallet/unfreeze")
async def unfreeze_funds(
    request: Request,
    data: WalletUnfreezeRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    admin: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Unfreeze user funds"""
    ip, ua = get_request_info(request)
    service = SuperAdminService(db, admin, ip, ua)
    result = await service.unfreeze_funds(
        user_id=data.user_id,
        amount_usd=data.amount_usd,
        reason=data.reason,
        idempotency_key=idempotency_key
    )
    return success_response(result)


@router.get("/wallet/ledger")
async def get_user_ledger(
    request: Request,
    user_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    admin: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get user's wallet ledger"""
    ip, ua = get_request_info(request)
    service = SuperAdminService(db, admin, ip, ua)
    entries, total = await service.get_user_ledger(user_id, page, page_size)
    
    return success_response({
        "entries": [
            {
                "id": str(e.id),
                "entry_type": e.entry_type.value,
                "amount_usd": e.amount_usd,
                "balance_available_after": e.balance_available_after,
                "balance_pending_after": e.balance_pending_after,
                "balance_frozen_after": e.balance_frozen_after,
                "reason": e.reason,
                "description": e.description,
                "created_at": e.created_at.isoformat()
            }
            for e in entries
        ],
        "total": total,
        "page": page,
        "page_size": page_size
    })


# ==================== ORDER OVERRIDES ====================

@router.post("/orders/{order_id}/force-refund")
async def force_refund_order(
    request: Request,
    order_id: UUID,
    data: ForceOrderActionRequest,
    admin: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Force refund an order"""
    ip, ua = get_request_info(request)
    service = SuperAdminService(db, admin, ip, ua)
    order = await service.force_refund_order(
        order_id=order_id,
        reason=data.reason,
        admin_password=data.admin_password,
        confirm_phrase=data.confirm_phrase
    )
    return success_response({
        "id": str(order.id),
        "order_number": order.order_number,
        "status": order.status.value,
        "message": "Order refunded successfully"
    })


@router.post("/orders/{order_id}/force-complete")
async def force_complete_order(
    request: Request,
    order_id: UUID,
    data: ForceOrderActionRequest,
    admin: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Force complete an order (release to seller)"""
    ip, ua = get_request_info(request)
    service = SuperAdminService(db, admin, ip, ua)
    order = await service.force_complete_order(
        order_id=order_id,
        reason=data.reason,
        admin_password=data.admin_password,
        confirm_phrase=data.confirm_phrase
    )
    return success_response({
        "id": str(order.id),
        "order_number": order.order_number,
        "status": order.status.value,
        "message": "Order completed successfully"
    })


@router.patch("/orders/{order_id}/dispute-window")
async def extend_dispute_window(
    request: Request,
    order_id: UUID,
    data: ExtendDisputeWindowRequest,
    admin: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Extend dispute window for an order"""
    ip, ua = get_request_info(request)
    service = SuperAdminService(db, admin, ip, ua)
    order = await service.extend_dispute_window(
        order_id=order_id,
        hours=data.hours,
        reason=data.reason
    )
    return success_response({
        "id": str(order.id),
        "order_number": order.order_number,
        "delivered_at": order.delivered_at.isoformat() if order.delivered_at else None,
        "message": f"Dispute window extended by {data.hours} hours"
    })


# ==================== CONTENT MODERATION ====================

@router.patch("/listings/{listing_id}/status")
async def hide_listing(
    request: Request,
    listing_id: UUID,
    data: HideListingRequest,
    admin: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Hide a listing"""
    ip, ua = get_request_info(request)
    service = SuperAdminService(db, admin, ip, ua)
    listing = await service.hide_listing(listing_id, data.reason)
    return success_response({
        "id": str(listing.id),
        "title": listing.title,
        "status": listing.status.value,
        "message": "Listing hidden"
    })


@router.patch("/messages/{message_id}/hide")
async def hide_message(
    request: Request,
    message_id: UUID,
    data: HideMessageRequest,
    admin: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Hide/delete a chat message"""
    ip, ua = get_request_info(request)
    service = SuperAdminService(db, admin, ip, ua)
    message = await service.hide_message(message_id, data.reason)
    return success_response({
        "id": str(message.id),
        "is_hidden": message.is_hidden,
        "message": "Message hidden"
    })


# ==================== PLATFORM CONFIG ====================

@router.get("/config")
async def get_config(
    admin: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get platform configuration"""
    from sqlalchemy import select
    from app.models.platform_config import PlatformConfig
    
    result = await db.execute(select(PlatformConfig))
    configs = result.scalars().all()
    
    config_dict = {c.key: c.value for c in configs}
    
    return success_response({
        "usd_to_bdt_rate": float(config_dict.get("usd_to_bdt_rate", "120")),
        "dispute_window_hours": int(config_dict.get("dispute_window_hours", "24")),
        "seller_protection_days": int(config_dict.get("seller_protection_days", "10")),
        "kyc_required_for_seller": config_dict.get("kyc_required_for_seller", "true").lower() == "true",
        "listing_approval_required": config_dict.get("listing_approval_required", "true").lower() == "true",
        "max_image_size_mb": int(config_dict.get("max_image_size_mb", "5")),
        "max_images_per_listing": int(config_dict.get("max_images_per_listing", "5")),
        "default_fee_percent": float(config_dict.get("default_fee_percent", "5")),
        "maintenance_mode": config_dict.get("maintenance_mode", "false").lower() == "true",
        
    })


@router.put("/config")
async def update_config(
    request: Request,
    data: PlatformConfigUpdate,
    admin: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update platform configuration"""
    from sqlalchemy import select
    from app.models.platform_config import PlatformConfig
    from app.models.admin_action import AdminAction, AdminActionType, TargetType
    from datetime import datetime, timezone
    
    ip, ua = get_request_info(request)
    
    # Get current config
    result = await db.execute(select(PlatformConfig))
    configs = {c.key: c for c in result.scalars().all()}
    
    before_snapshot = {c.key: c.value for c in configs.values()}
    updates = data.model_dump(exclude_none=True)
    
    for key, value in updates.items():
        if key in configs:
            configs[key].value = str(value)
            configs[key].updated_by = admin.id
        else:
            new_config = PlatformConfig(
                key=key,
                value=str(value),
                updated_by=admin.id
            )
            db.add(new_config)
    
    # Audit log
    audit = AdminAction(
        actor_id=admin.id,
        actor_role=admin.roles[0] if admin.roles else "unknown",
        action_type=AdminActionType.UPDATE_CONFIG,
        target_type=TargetType.CONFIG,
        reason="Platform configuration update",
        before_snapshot=before_snapshot,
        after_snapshot={k: str(v) for k, v in updates.items()},
        ip_address=ip,
        user_agent=ua
    )
    db.add(audit)
    
    await db.commit()
    
    return success_response({"message": "Configuration updated", "updates": updates})


# ==================== LEGAL DOCUMENTS ====================

@router.put("/legal")
async def update_legal(
    request: Request,
    data: LegalDocumentUpdate,
    admin: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update terms and privacy documents"""
    from app.models.admin_action import AdminAction, AdminActionType, TargetType, LegalDocument
    from datetime import datetime, timezone
    
    ip, ua = get_request_info(request)
    updates = {}
    
    if data.terms_html and data.terms_version:
        doc = LegalDocument(
            doc_type="terms",
            version=data.terms_version,
            content_html=data.terms_html,
            is_active=True,
            created_by=admin.id
        )
        db.add(doc)
        updates["terms_version"] = data.terms_version
    
    if data.privacy_html and data.privacy_version:
        doc = LegalDocument(
            doc_type="privacy",
            version=data.privacy_version,
            content_html=data.privacy_html,
            is_active=True,
            created_by=admin.id
        )
        db.add(doc)
        updates["privacy_version"] = data.privacy_version
    
    if updates:
        audit = AdminAction(
            actor_id=admin.id,
            actor_role=admin.roles[0] if admin.roles else "unknown",
            action_type=AdminActionType.UPDATE_LEGAL,
            target_type=TargetType.LEGAL,
            reason="Legal documents update",
            after_snapshot=updates,
            ip_address=ip,
            user_agent=ua
        )
        db.add(audit)
        
        await db.commit()
    
    return success_response({"message": "Legal documents updated", "updates": updates})


# Keep legacy stats endpoint for backwards compatibility
@router.get("/stats")
async def get_stats(
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get platform statistics (legacy)"""
    from sqlalchemy import select, func
    from app.models.order import Order, OrderStatus
    from app.models.wallet_ledger import WalletLedger, LedgerEntryType
    from app.models.listing import Listing, ListingStatus
    
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    total_orders = (await db.execute(select(func.count(Order.id)))).scalar() or 0
    completed_orders = (await db.execute(
        select(func.count(Order.id)).where(Order.status == OrderStatus.COMPLETED)
    )).scalar() or 0
    total_volume = (await db.execute(
        select(func.sum(Order.amount_usd)).where(Order.status == OrderStatus.COMPLETED)
    )).scalar() or 0
    platform_earnings = abs((await db.execute(
        select(func.sum(WalletLedger.amount_usd)).where(
            WalletLedger.entry_type == LedgerEntryType.PLATFORM_FEE
        )
    )).scalar() or 0)
    pending_count = (await db.execute(
        select(func.count(Listing.id)).where(Listing.status == ListingStatus.PENDING)
    )).scalar() or 0
    
    return success_response({
        "total_users": total_users,
        "total_orders": total_orders,
        "completed_orders": completed_orders,
        "total_volume_usd": float(total_volume),
        "platform_earnings_usd": float(platform_earnings),
        "pending_listings": pending_count,
        "total_sellers": (await db.execute(
            select(func.count(User.id)).where(User.roles.contains(["seller"]))
        )).scalar() or 0,
        "total_listings": (await db.execute(
            select(func.count(Listing.id)).where(Listing.status == ListingStatus.APPROVED)
        )).scalar() or 0
    })
