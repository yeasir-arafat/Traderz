"""
Super Admin service with comprehensive owner-grade controls.
Includes audit logging, step-up confirmation, and guardrails.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, text, desc
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List, Tuple
from uuid import UUID
import json

from app.models.user import User
from app.models.order import Order, OrderStatus
from app.models.listing import Listing, ListingStatus
from app.models.kyc import KycSubmission, KycStatus
from app.models.wallet_ledger import WalletLedger, LedgerEntryType
from app.models.platform_config import PlatformConfig, PlatformFeeRule
from app.models.game import Game, GamePlatform
from app.models.giftcard import GiftCard
from app.models.conversation import Message
from app.models.admin_action import (
    AdminAction, AdminActionType, TargetType, 
    ConfirmationMethod, LegalDocument
)
from app.models.user_session import UserSession
from app.core.security import verify_password, get_password_hash, validate_password
from app.core.errors import AppException
from app.core.responses import ErrorCodes


# Thresholds for step-up confirmation
LARGE_AMOUNT_THRESHOLD = 1000.0  # USD
CONFIRM_PHRASE_REQUIRED_AMOUNT = 5000.0  # USD


class AuditLogger:
    """Helper class for creating immutable audit logs"""
    
    def __init__(self, db: AsyncSession, actor: User, ip_address: str = None, user_agent: str = None):
        self.db = db
        self.actor = actor
        self.ip_address = ip_address
        self.user_agent = user_agent
    
    async def log(
        self,
        action_type: AdminActionType,
        target_type: TargetType = None,
        target_id: UUID = None,
        reason: str = None,
        before_snapshot: Dict = None,
        after_snapshot: Dict = None,
        details: Dict = None,
        confirmation_method: ConfirmationMethod = None,
        confirm_phrase: str = None,
        idempotency_key: str = None
    ) -> AdminAction:
        """Create an immutable audit log entry"""
        
        action = AdminAction(
            actor_id=self.actor.id,
            actor_role=self.actor.roles[0] if self.actor.roles else "unknown",
            action_type=action_type,
            target_type=target_type,
            target_id=target_id,
            reason=reason,
            before_snapshot=before_snapshot,
            after_snapshot=after_snapshot,
            details=details,
            confirmation_method=confirmation_method,
            confirmed_at=datetime.now(timezone.utc) if confirmation_method else None,
            confirm_phrase_used=confirm_phrase[:20] + "..." if confirm_phrase and len(confirm_phrase) > 20 else confirm_phrase,
            ip_address=self.ip_address,
            user_agent=self.user_agent,
            idempotency_key=idempotency_key
        )
        
        self.db.add(action)
        await self.db.flush()
        return action


class SuperAdminService:
    """Service for all super admin operations"""
    
    def __init__(self, db: AsyncSession, admin: User, ip_address: str = None, user_agent: str = None):
        self.db = db
        self.admin = admin
        self.audit = AuditLogger(db, admin, ip_address, user_agent)
    
    def _require_super_admin(self):
        """Verify the current user is super admin"""
        if "super_admin" not in self.admin.roles:
            raise AppException(ErrorCodes.AUTHORIZATION_ERROR, "Super admin access required", 403)
    
    def _verify_password(self, password: str):
        """Verify admin password for step-up confirmation"""
        if not verify_password(password, self.admin.password_hash):
            raise AppException(ErrorCodes.AUTHENTICATION_ERROR, "Invalid password", 401)
    
    def _require_confirm_phrase(self, phrase: str, expected: str = "CONFIRM"):
        """Verify typed confirmation phrase"""
        if not phrase or phrase.upper() != expected.upper():
            raise AppException(ErrorCodes.VALIDATION_ERROR, f"Please type '{expected}' to confirm", 400)
    
    # ==================== ADMIN MANAGEMENT ====================
    
    async def create_admin(
        self, 
        email: str,
        username: str,
        full_name: str,
        password: str,
        phone_number: str = None,
        address_line1: str = None,
        city: str = None,
        country: str = None,
        admin_password: str = None
    ) -> User:
        """Create a new admin account (super admin only)"""
        self._require_super_admin()
        self._verify_password(admin_password)
        
        # Validate password policy
        is_valid, msg = validate_password(password)
        if not is_valid:
            raise AppException(ErrorCodes.VALIDATION_ERROR, msg, 400)
        
        # Check if email/username exists
        existing = await self.db.execute(
            select(User).where(or_(User.email == email, User.username == username))
        )
        if existing.scalar_one_or_none():
            raise AppException(ErrorCodes.DUPLICATE_ENTRY, "Email or username already exists", 400)
        
        # Create admin user
        new_admin = User(
            email=email,
            username=username,
            full_name=full_name,
            password_hash=get_password_hash(password),
            phone_number=phone_number,
            address_line1=address_line1,
            city=city,
            country=country,
            roles=["admin"],
            is_active=True,
            status="active",
            terms_accepted=True,
            terms_accepted_at=datetime.now(timezone.utc),
            created_by_admin=self.admin.id
        )
        
        self.db.add(new_admin)
        await self.db.flush()
        
        # Audit log
        await self.audit.log(
            action_type=AdminActionType.CREATE_ADMIN,
            target_type=TargetType.USER,
            target_id=new_admin.id,
            reason=f"Created admin account for {email}",
            after_snapshot={"email": email, "username": username, "roles": ["admin"]},
            confirmation_method=ConfirmationMethod.PASSWORD
        )
        
        await self.db.commit()
        return new_admin
    
    async def list_admins(self, page: int = 1, page_size: int = 20) -> Tuple[List[User], int]:
        """List all admin accounts"""
        self._require_super_admin()
        
        query = select(User).where(
            or_(
                User.roles.contains(["admin"]),
                User.roles.contains(["super_admin"])
            )
        )
        
        count_result = await self.db.execute(
            select(func.count(User.id)).where(
                or_(
                    User.roles.contains(["admin"]),
                    User.roles.contains(["super_admin"])
                )
            )
        )
        total = count_result.scalar() or 0
        
        query = query.order_by(User.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        
        result = await self.db.execute(query)
        admins = result.scalars().all()
        
        return admins, total
    
    async def toggle_admin(
        self,
        admin_id: UUID,
        is_active: bool,
        reason: str = None,
        admin_password: str = None
    ) -> User:
        """Enable or disable an admin account"""
        self._require_super_admin()
        self._verify_password(admin_password)
        
        # Get target admin
        result = await self.db.execute(select(User).where(User.id == admin_id))
        target_admin = result.scalar_one_or_none()
        
        if not target_admin:
            raise AppException(ErrorCodes.NOT_FOUND, "Admin not found", 404)
        
        if "super_admin" in target_admin.roles:
            raise AppException(ErrorCodes.AUTHORIZATION_ERROR, "Cannot disable super admin", 403)
        
        # Snapshot before
        before = {"is_active": target_admin.is_active, "status": target_admin.status}
        
        target_admin.is_active = is_active
        target_admin.status = "active" if is_active else "suspended"
        target_admin.status_reason = reason
        target_admin.status_changed_at = datetime.now(timezone.utc)
        target_admin.status_changed_by = self.admin.id
        
        # Audit log
        await self.audit.log(
            action_type=AdminActionType.ENABLE_ADMIN if is_active else AdminActionType.DISABLE_ADMIN,
            target_type=TargetType.USER,
            target_id=admin_id,
            reason=reason,
            before_snapshot=before,
            after_snapshot={"is_active": is_active, "status": target_admin.status},
            confirmation_method=ConfirmationMethod.PASSWORD
        )
        
        await self.db.commit()
        return target_admin
    
    # ==================== USER MANAGEMENT ====================
    
    async def list_users(
        self,
        role: str = None,
        status: str = None,
        kyc_status: str = None,
        q: str = None,
        page: int = 1,
        page_size: int = 20
    ) -> Tuple[List[User], int]:
        """List users with filters"""
        self._require_super_admin()
        
        query = select(User)
        conditions = []
        
        if role:
            conditions.append(User.roles.contains([role]))
        if status:
            conditions.append(User.status == status)
        if kyc_status:
            conditions.append(User.kyc_status == kyc_status)
        if q:
            search = f"%{q}%"
            conditions.append(or_(
                User.username.ilike(search),
                User.email.ilike(search),
                User.full_name.ilike(search)
            ))
        
        if conditions:
            query = query.where(and_(*conditions))
        
        # Count
        count_query = select(func.count(User.id))
        if conditions:
            count_query = count_query.where(and_(*conditions))
        count_result = await self.db.execute(count_query)
        total = count_result.scalar() or 0
        
        # Paginate
        query = query.order_by(User.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        
        result = await self.db.execute(query)
        users = result.scalars().all()
        
        return users, total
    
    async def get_user_detail(self, user_id: UUID) -> Dict[str, Any]:
        """Get detailed user info with wallet, orders, listings counts"""
        self._require_super_admin()
        
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            raise AppException(ErrorCodes.NOT_FOUND, "User not found", 404)
        
        # Get wallet balance
        balance_result = await self.db.execute(
            select(
                WalletLedger.balance_available_after,
                WalletLedger.balance_pending_after,
                WalletLedger.balance_frozen_after
            ).where(WalletLedger.user_id == user_id)
            .order_by(WalletLedger.created_at.desc())
            .limit(1)
        )
        balance_row = balance_result.first()
        
        # Get order counts
        orders_result = await self.db.execute(
            select(func.count(Order.id)).where(
                or_(Order.buyer_id == user_id, Order.seller_id == user_id)
            )
        )
        total_orders = orders_result.scalar() or 0
        
        # Get listing counts
        listings_result = await self.db.execute(
            select(func.count(Listing.id)).where(Listing.seller_id == user_id)
        )
        total_listings = listings_result.scalar() or 0
        
        return {
            "user": user,
            "wallet_available": balance_row[0] if balance_row else 0,
            "wallet_pending": balance_row[1] if balance_row else 0,
            "wallet_frozen": balance_row[2] if balance_row else 0,
            "total_orders": total_orders,
            "total_listings": total_listings
        }
    
    async def update_user_status(
        self,
        user_id: UUID,
        status: str,
        reason: str,
        admin_password: str = None
    ) -> User:
        """Ban/unban user"""
        self._require_super_admin()
        
        if status == "banned" and admin_password:
            self._verify_password(admin_password)
        
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            raise AppException(ErrorCodes.NOT_FOUND, "User not found", 404)
        
        if "super_admin" in user.roles:
            raise AppException(ErrorCodes.AUTHORIZATION_ERROR, "Cannot modify super admin", 403)
        
        before = {"status": user.status, "is_active": user.is_active}
        
        user.status = status
        user.is_active = status == "active"
        user.status_reason = reason
        user.status_changed_at = datetime.now(timezone.utc)
        user.status_changed_by = self.admin.id
        
        action_type = AdminActionType.UNBAN_USER if status == "active" else AdminActionType.BAN_USER
        
        await self.audit.log(
            action_type=action_type,
            target_type=TargetType.USER,
            target_id=user_id,
            reason=reason,
            before_snapshot=before,
            after_snapshot={"status": status, "is_active": user.is_active},
            confirmation_method=ConfirmationMethod.PASSWORD if admin_password else None
        )
        
        await self.db.commit()
        return user
    
    async def update_user_roles(
        self,
        user_id: UUID,
        roles: List[str],
        reason: str,
        admin_password: str
    ) -> User:
        """Promote/demote user roles"""
        self._require_super_admin()
        self._verify_password(admin_password)
        
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            raise AppException(ErrorCodes.NOT_FOUND, "User not found", 404)
        
        # Cannot remove super_admin from self
        if user.id == self.admin.id and "super_admin" not in roles:
            raise AppException(ErrorCodes.AUTHORIZATION_ERROR, "Cannot remove super_admin role from yourself", 403)
        
        before = {"roles": user.roles}
        
        # Determine if promotion or demotion
        old_roles = set(user.roles)
        new_roles = set(roles)
        is_promotion = len(new_roles - old_roles) > 0
        
        user.roles = roles
        
        await self.audit.log(
            action_type=AdminActionType.PROMOTE_ROLE if is_promotion else AdminActionType.DEMOTE_ROLE,
            target_type=TargetType.USER,
            target_id=user_id,
            reason=reason,
            before_snapshot=before,
            after_snapshot={"roles": roles},
            confirmation_method=ConfirmationMethod.PASSWORD
        )
        
        await self.db.commit()
        return user
    
    async def force_logout_user(self, user_id: UUID, reason: str) -> bool:
        """Revoke all user sessions"""
        self._require_super_admin()
        
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            raise AppException(ErrorCodes.NOT_FOUND, "User not found", 404)
        
        # Revoke all sessions by setting revoked_at
        await self.db.execute(
            text("""
                UPDATE user_sessions 
                SET revoked_at = :now
                WHERE user_id = :user_id AND revoked_at IS NULL
            """),
            {"user_id": user_id, "now": datetime.now(timezone.utc)}
        )
        
        await self.audit.log(
            action_type=AdminActionType.FORCE_LOGOUT,
            target_type=TargetType.USER,
            target_id=user_id,
            reason=reason
        )
        
        await self.db.commit()
        return True
    
    async def unlock_profile(
        self,
        user_id: UUID,
        reason: str,
        admin_password: str
    ) -> User:
        """Unlock profile for editing even after KYC approval"""
        self._require_super_admin()
        self._verify_password(admin_password)
        
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            raise AppException(ErrorCodes.NOT_FOUND, "User not found", 404)
        
        before = {"profile_unlocked": user.profile_unlocked}
        
        user.profile_unlocked = True
        user.profile_unlock_reason = reason
        user.profile_unlocked_at = datetime.now(timezone.utc)
        user.profile_unlocked_by = self.admin.id
        
        await self.audit.log(
            action_type=AdminActionType.UNLOCK_PROFILE,
            target_type=TargetType.USER,
            target_id=user_id,
            reason=reason,
            before_snapshot=before,
            after_snapshot={"profile_unlocked": True},
            confirmation_method=ConfirmationMethod.PASSWORD
        )
        
        await self.db.commit()
        return user
    
    # ==================== WALLET / FINANCE ====================
    
    async def _get_user_balance(self, user_id: UUID) -> Tuple[float, float, float]:
        """Get user's current wallet balances"""
        result = await self.db.execute(
            select(
                WalletLedger.balance_available_after,
                WalletLedger.balance_pending_after,
                WalletLedger.balance_frozen_after
            ).where(WalletLedger.user_id == user_id)
            .order_by(WalletLedger.created_at.desc())
            .limit(1)
        )
        row = result.first()
        return (row[0], row[1], row[2]) if row else (0.0, 0.0, 0.0)
    
    async def credit_wallet(
        self,
        user_id: UUID,
        amount_usd: float,
        reason: str,
        idempotency_key: str = None
    ) -> Dict[str, Any]:
        """Credit user wallet (admin deposit)"""
        self._require_super_admin()
        
        # Check idempotency
        if idempotency_key:
            existing = await self.db.execute(
                select(AdminAction).where(AdminAction.idempotency_key == idempotency_key)
            )
            if existing.scalar_one_or_none():
                raise AppException(ErrorCodes.DUPLICATE_ENTRY, "Duplicate request", 400)
        
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            raise AppException(ErrorCodes.NOT_FOUND, "User not found", 404)
        
        available, pending, frozen = await self._get_user_balance(user_id)
        new_available = available + amount_usd
        
        # Create ledger entry
        ledger = WalletLedger(
            user_id=user_id,
            entry_type=LedgerEntryType.ADMIN_CREDIT,
            amount_usd=amount_usd,
            balance_available_after=new_available,
            balance_pending_after=pending,
            balance_frozen_after=frozen,
            admin_id=self.admin.id,
            reason=reason,
            description=f"Admin credit by {self.admin.username}"
        )
        self.db.add(ledger)
        
        audit = await self.audit.log(
            action_type=AdminActionType.WALLET_CREDIT,
            target_type=TargetType.USER,
            target_id=user_id,
            reason=reason,
            before_snapshot={"available": available, "pending": pending, "frozen": frozen},
            after_snapshot={"available": new_available, "pending": pending, "frozen": frozen},
            details={"amount_usd": amount_usd},
            idempotency_key=idempotency_key
        )
        
        await self.db.commit()
        
        return {
            "user_id": user_id,
            "action": "credit",
            "amount_usd": amount_usd,
            "balance_before": available,
            "balance_after": new_available,
            "frozen_before": frozen,
            "frozen_after": frozen,
            "audit_id": audit.id
        }
    
    async def debit_wallet(
        self,
        user_id: UUID,
        amount_usd: float,
        reason: str,
        admin_password: str,
        confirm_phrase: str = None,
        idempotency_key: str = None
    ) -> Dict[str, Any]:
        """Debit user wallet (requires password, large amounts need phrase)"""
        self._require_super_admin()
        self._verify_password(admin_password)
        
        # Large amount requires phrase confirmation
        if amount_usd >= LARGE_AMOUNT_THRESHOLD:
            if not confirm_phrase or confirm_phrase.upper() != "CONFIRM DEBIT":
                raise AppException(
                    ErrorCodes.VALIDATION_ERROR,
                    f"Amount >= ${LARGE_AMOUNT_THRESHOLD} requires typing 'CONFIRM DEBIT'",
                    400
                )
        
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            raise AppException(ErrorCodes.NOT_FOUND, "User not found", 404)
        
        available, pending, frozen = await self._get_user_balance(user_id)
        
        if available < amount_usd:
            raise AppException(ErrorCodes.INSUFFICIENT_BALANCE, "Insufficient available balance", 400)
        
        new_available = available - amount_usd
        
        ledger = WalletLedger(
            user_id=user_id,
            entry_type=LedgerEntryType.ADMIN_DEBIT,
            amount_usd=-amount_usd,
            balance_available_after=new_available,
            balance_pending_after=pending,
            balance_frozen_after=frozen,
            admin_id=self.admin.id,
            reason=reason,
            description=f"Admin debit by {self.admin.username}"
        )
        self.db.add(ledger)
        
        audit = await self.audit.log(
            action_type=AdminActionType.WALLET_DEBIT,
            target_type=TargetType.USER,
            target_id=user_id,
            reason=reason,
            before_snapshot={"available": available, "pending": pending, "frozen": frozen},
            after_snapshot={"available": new_available, "pending": pending, "frozen": frozen},
            details={"amount_usd": amount_usd},
            confirmation_method=ConfirmationMethod.PASSWORD,
            confirm_phrase=confirm_phrase,
            idempotency_key=idempotency_key
        )
        
        await self.db.commit()
        
        return {
            "user_id": user_id,
            "action": "debit",
            "amount_usd": amount_usd,
            "balance_before": available,
            "balance_after": new_available,
            "frozen_before": frozen,
            "frozen_after": frozen,
            "audit_id": audit.id
        }
    
    async def freeze_funds(
        self,
        user_id: UUID,
        amount_usd: float,
        reason: str,
        admin_password: str,
        confirm_phrase: str = None,
        idempotency_key: str = None
    ) -> Dict[str, Any]:
        """Freeze user funds"""
        self._require_super_admin()
        self._verify_password(admin_password)
        
        if amount_usd >= LARGE_AMOUNT_THRESHOLD:
            if not confirm_phrase or confirm_phrase.upper() != "CONFIRM FREEZE":
                raise AppException(
                    ErrorCodes.VALIDATION_ERROR,
                    f"Amount >= ${LARGE_AMOUNT_THRESHOLD} requires typing 'CONFIRM FREEZE'",
                    400
                )
        
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            raise AppException(ErrorCodes.NOT_FOUND, "User not found", 404)
        
        available, pending, frozen = await self._get_user_balance(user_id)
        
        if available < amount_usd:
            raise AppException(ErrorCodes.INSUFFICIENT_BALANCE, "Insufficient available balance to freeze", 400)
        
        new_available = available - amount_usd
        new_frozen = frozen + amount_usd
        
        ledger = WalletLedger(
            user_id=user_id,
            entry_type=LedgerEntryType.ADMIN_FREEZE_HOLD,
            amount_usd=-amount_usd,
            balance_available_after=new_available,
            balance_pending_after=pending,
            balance_frozen_after=new_frozen,
            admin_id=self.admin.id,
            reason=reason,
            description=f"Funds frozen by {self.admin.username}"
        )
        self.db.add(ledger)
        
        audit = await self.audit.log(
            action_type=AdminActionType.WALLET_FREEZE,
            target_type=TargetType.USER,
            target_id=user_id,
            reason=reason,
            before_snapshot={"available": available, "pending": pending, "frozen": frozen},
            after_snapshot={"available": new_available, "pending": pending, "frozen": new_frozen},
            details={"amount_usd": amount_usd},
            confirmation_method=ConfirmationMethod.PASSWORD,
            confirm_phrase=confirm_phrase,
            idempotency_key=idempotency_key
        )
        
        await self.db.commit()
        
        return {
            "user_id": user_id,
            "action": "freeze",
            "amount_usd": amount_usd,
            "balance_before": available,
            "balance_after": new_available,
            "frozen_before": frozen,
            "frozen_after": new_frozen,
            "audit_id": audit.id
        }
    
    async def unfreeze_funds(
        self,
        user_id: UUID,
        amount_usd: float,
        reason: str,
        idempotency_key: str = None
    ) -> Dict[str, Any]:
        """Unfreeze user funds"""
        self._require_super_admin()
        
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            raise AppException(ErrorCodes.NOT_FOUND, "User not found", 404)
        
        available, pending, frozen = await self._get_user_balance(user_id)
        
        if frozen < amount_usd:
            raise AppException(ErrorCodes.INSUFFICIENT_BALANCE, "Insufficient frozen balance", 400)
        
        new_available = available + amount_usd
        new_frozen = frozen - amount_usd
        
        ledger = WalletLedger(
            user_id=user_id,
            entry_type=LedgerEntryType.ADMIN_FREEZE_RELEASE,
            amount_usd=amount_usd,
            balance_available_after=new_available,
            balance_pending_after=pending,
            balance_frozen_after=new_frozen,
            admin_id=self.admin.id,
            reason=reason,
            description=f"Funds unfrozen by {self.admin.username}"
        )
        self.db.add(ledger)
        
        audit = await self.audit.log(
            action_type=AdminActionType.WALLET_UNFREEZE,
            target_type=TargetType.USER,
            target_id=user_id,
            reason=reason,
            before_snapshot={"available": available, "pending": pending, "frozen": frozen},
            after_snapshot={"available": new_available, "pending": pending, "frozen": new_frozen},
            details={"amount_usd": amount_usd},
            idempotency_key=idempotency_key
        )
        
        await self.db.commit()
        
        return {
            "user_id": user_id,
            "action": "unfreeze",
            "amount_usd": amount_usd,
            "balance_before": available,
            "balance_after": new_available,
            "frozen_before": frozen,
            "frozen_after": new_frozen,
            "audit_id": audit.id
        }
    
    async def get_user_ledger(
        self,
        user_id: UUID,
        page: int = 1,
        page_size: int = 50
    ) -> Tuple[List[WalletLedger], int]:
        """Get user's wallet ledger entries"""
        self._require_super_admin()
        
        count_result = await self.db.execute(
            select(func.count(WalletLedger.id)).where(WalletLedger.user_id == user_id)
        )
        total = count_result.scalar() or 0
        
        result = await self.db.execute(
            select(WalletLedger)
            .where(WalletLedger.user_id == user_id)
            .order_by(WalletLedger.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        entries = result.scalars().all()
        
        return entries, total
    
    # ==================== ORDER OVERRIDES ====================
    
    async def force_refund_order(
        self,
        order_id: UUID,
        reason: str,
        admin_password: str,
        confirm_phrase: str = None
    ) -> Order:
        """Force refund an order"""
        self._require_super_admin()
        self._verify_password(admin_password)
        
        result = await self.db.execute(
            select(Order).options(
                selectinload(Order.buyer),
                selectinload(Order.seller)
            ).where(Order.id == order_id)
        )
        order = result.scalar_one_or_none()
        
        if not order:
            raise AppException(ErrorCodes.NOT_FOUND, "Order not found", 404)
        
        if order.status in [OrderStatus.REFUNDED, OrderStatus.CANCELLED]:
            raise AppException(ErrorCodes.INVALID_STATE, "Order already refunded/cancelled", 400)
        
        if order.amount_usd >= LARGE_AMOUNT_THRESHOLD:
            if not confirm_phrase or confirm_phrase.upper() != "CONFIRM REFUND":
                raise AppException(
                    ErrorCodes.VALIDATION_ERROR,
                    "Large order refund requires typing 'CONFIRM REFUND'",
                    400
                )
        
        before = {"status": order.status.value, "amount_usd": order.amount_usd}
        
        # Refund buyer
        buyer_available, buyer_pending, buyer_frozen = await self._get_user_balance(order.buyer_id)
        new_buyer_available = buyer_available + order.amount_usd
        
        ledger = WalletLedger(
            user_id=order.buyer_id,
            entry_type=LedgerEntryType.REFUND,
            amount_usd=order.amount_usd,
            balance_available_after=new_buyer_available,
            balance_pending_after=buyer_pending,
            balance_frozen_after=buyer_frozen,
            order_id=order.id,
            admin_id=self.admin.id,
            reason=f"Force refund: {reason}",
            description=f"Force refund by admin for order {order.order_number}"
        )
        self.db.add(ledger)
        
        order.status = OrderStatus.REFUNDED
        order.refunded_at = datetime.now(timezone.utc)
        order.dispute_resolution = f"Force refunded by admin: {reason}"
        order.dispute_resolved_at = datetime.now(timezone.utc)
        
        await self.audit.log(
            action_type=AdminActionType.FORCE_REFUND,
            target_type=TargetType.ORDER,
            target_id=order_id,
            reason=reason,
            before_snapshot=before,
            after_snapshot={"status": "refunded", "refund_amount": order.amount_usd},
            confirmation_method=ConfirmationMethod.PASSWORD,
            confirm_phrase=confirm_phrase
        )
        
        await self.db.commit()
        return order
    
    async def force_complete_order(
        self,
        order_id: UUID,
        reason: str,
        admin_password: str,
        confirm_phrase: str = None
    ) -> Order:
        """Force complete an order (release to seller)"""
        self._require_super_admin()
        self._verify_password(admin_password)
        
        result = await self.db.execute(
            select(Order).options(
                selectinload(Order.buyer),
                selectinload(Order.seller)
            ).where(Order.id == order_id)
        )
        order = result.scalar_one_or_none()
        
        if not order:
            raise AppException(ErrorCodes.NOT_FOUND, "Order not found", 404)
        
        if order.status in [OrderStatus.COMPLETED, OrderStatus.REFUNDED, OrderStatus.CANCELLED]:
            raise AppException(ErrorCodes.INVALID_STATE, "Order cannot be completed", 400)
        
        if order.amount_usd >= LARGE_AMOUNT_THRESHOLD:
            if not confirm_phrase or confirm_phrase.upper() != "CONFIRM COMPLETE":
                raise AppException(
                    ErrorCodes.VALIDATION_ERROR,
                    "Large order completion requires typing 'CONFIRM COMPLETE'",
                    400
                )
        
        before = {"status": order.status.value}
        
        # Release to seller pending
        seller_available, seller_pending, seller_frozen = await self._get_user_balance(order.seller_id)
        new_seller_pending = seller_pending + order.seller_earnings_usd
        
        ledger = WalletLedger(
            user_id=order.seller_id,
            entry_type=LedgerEntryType.ESCROW_RELEASE_PENDING,
            amount_usd=order.seller_earnings_usd,
            balance_available_after=seller_available,
            balance_pending_after=new_seller_pending,
            balance_frozen_after=seller_frozen,
            order_id=order.id,
            admin_id=self.admin.id,
            reason=f"Force complete: {reason}",
            description=f"Force completed by admin for order {order.order_number}"
        )
        self.db.add(ledger)
        
        order.status = OrderStatus.COMPLETED
        order.completed_at = datetime.now(timezone.utc)
        order.completed_by = "admin"
        order.dispute_resolution = f"Force completed by admin: {reason}"
        order.dispute_resolved_at = datetime.now(timezone.utc)
        order.seller_pending_release_at = datetime.now(timezone.utc) + timedelta(days=10)
        
        await self.audit.log(
            action_type=AdminActionType.FORCE_COMPLETE,
            target_type=TargetType.ORDER,
            target_id=order_id,
            reason=reason,
            before_snapshot=before,
            after_snapshot={"status": "completed", "seller_earnings": order.seller_earnings_usd},
            confirmation_method=ConfirmationMethod.PASSWORD,
            confirm_phrase=confirm_phrase
        )
        
        await self.db.commit()
        return order
    
    async def extend_dispute_window(
        self,
        order_id: UUID,
        hours: int,
        reason: str
    ) -> Order:
        """Extend dispute window for an order"""
        self._require_super_admin()
        
        result = await self.db.execute(select(Order).where(Order.id == order_id))
        order = result.scalar_one_or_none()
        
        if not order:
            raise AppException(ErrorCodes.NOT_FOUND, "Order not found", 404)
        
        if order.status != OrderStatus.DELIVERED:
            raise AppException(ErrorCodes.INVALID_STATE, "Can only extend for delivered orders", 400)
        
        before = {"delivered_at": order.delivered_at.isoformat() if order.delivered_at else None}
        
        # Extend by adding hours to delivered_at
        order.delivered_at = order.delivered_at + timedelta(hours=hours)
        
        await self.audit.log(
            action_type=AdminActionType.EXTEND_DISPUTE_WINDOW,
            target_type=TargetType.ORDER,
            target_id=order_id,
            reason=reason,
            before_snapshot=before,
            after_snapshot={"delivered_at": order.delivered_at.isoformat(), "extended_hours": hours}
        )
        
        await self.db.commit()
        return order
    
    # ==================== CONTENT MODERATION ====================
    
    async def hide_listing(
        self,
        listing_id: UUID,
        reason: str
    ) -> Listing:
        """Hide a listing"""
        self._require_super_admin()
        
        result = await self.db.execute(select(Listing).where(Listing.id == listing_id))
        listing = result.scalar_one_or_none()
        
        if not listing:
            raise AppException(ErrorCodes.NOT_FOUND, "Listing not found", 404)
        
        before = {"status": listing.status.value}
        
        listing.status = ListingStatus.INACTIVE
        listing.rejection_reason = f"Hidden by admin: {reason}"
        
        await self.audit.log(
            action_type=AdminActionType.HIDE_LISTING,
            target_type=TargetType.LISTING,
            target_id=listing_id,
            reason=reason,
            before_snapshot=before,
            after_snapshot={"status": "inactive"}
        )
        
        await self.db.commit()
        return listing
    
    async def hide_message(
        self,
        message_id: UUID,
        reason: str
    ) -> Message:
        """Hide/delete a chat message"""
        self._require_super_admin()
        
        result = await self.db.execute(select(Message).where(Message.id == message_id))
        message = result.scalar_one_or_none()
        
        if not message:
            raise AppException(ErrorCodes.NOT_FOUND, "Message not found", 404)
        
        before = {"is_hidden": message.is_hidden, "content": message.content[:100]}
        
        message.is_hidden = True
        message.hidden_at = datetime.now(timezone.utc)
        message.hidden_by = self.admin.id
        message.hidden_reason = reason
        
        await self.audit.log(
            action_type=AdminActionType.HIDE_MESSAGE,
            target_type=TargetType.MESSAGE,
            target_id=message_id,
            reason=reason,
            before_snapshot=before,
            after_snapshot={"is_hidden": True}
        )
        
        await self.db.commit()
        return message
    
    # ==================== DASHBOARD STATS ====================
    
    async def get_dashboard_stats(self) -> Dict[str, Any]:
        """Get comprehensive dashboard statistics"""
        self._require_super_admin()
        
        now = datetime.now(timezone.utc)
        seven_days_ago = now - timedelta(days=7)
        thirty_days_ago = now - timedelta(days=30)
        
        # KPI counts
        total_users = (await self.db.execute(select(func.count(User.id)))).scalar() or 0
        total_sellers = (await self.db.execute(
            select(func.count(User.id)).where(User.roles.contains(["seller"]))
        )).scalar() or 0
        active_listings = (await self.db.execute(
            select(func.count(Listing.id)).where(Listing.status == ListingStatus.APPROVED)
        )).scalar() or 0
        pending_listings = (await self.db.execute(
            select(func.count(Listing.id)).where(Listing.status == ListingStatus.PENDING)
        )).scalar() or 0
        pending_kyc = (await self.db.execute(
            select(func.count(KycSubmission.id)).where(KycSubmission.status == KycStatus.PENDING)
        )).scalar() or 0
        disputed_orders = (await self.db.execute(
            select(func.count(Order.id)).where(Order.status == OrderStatus.DISPUTED)
        )).scalar() or 0
        orders_in_delivery = (await self.db.execute(
            select(func.count(Order.id)).where(Order.status == OrderStatus.DELIVERED)
        )).scalar() or 0
        
        # Platform earnings 7d
        earnings_7d_result = await self.db.execute(
            select(func.sum(Order.platform_fee_usd)).where(
                and_(
                    Order.status == OrderStatus.COMPLETED,
                    Order.completed_at >= seven_days_ago
                )
            )
        )
        earnings_7d = earnings_7d_result.scalar() or 0
        
        # Finance stats
        total_deposits = (await self.db.execute(
            select(func.sum(WalletLedger.amount_usd)).where(
                WalletLedger.entry_type == LedgerEntryType.DEPOSIT
            )
        )).scalar() or 0
        
        total_withdrawals = abs((await self.db.execute(
            select(func.sum(WalletLedger.amount_usd)).where(
                WalletLedger.entry_type == LedgerEntryType.WITHDRAWAL_PAID
            )
        )).scalar() or 0)
        
        total_escrow = (await self.db.execute(
            select(func.sum(Order.amount_usd)).where(
                Order.status.in_([OrderStatus.PAID, OrderStatus.DELIVERED])
            )
        )).scalar() or 0
        
        # Get latest frozen balance sum
        frozen_subquery = select(
            WalletLedger.user_id,
            WalletLedger.balance_frozen_after,
            func.row_number().over(
                partition_by=WalletLedger.user_id,
                order_by=WalletLedger.created_at.desc()
            ).label("rn")
        ).subquery()
        
        total_frozen = (await self.db.execute(
            select(func.sum(frozen_subquery.c.balance_frozen_after)).where(
                frozen_subquery.c.rn == 1
            )
        )).scalar() or 0
        
        # Pending seller earnings
        pending_subquery = select(
            WalletLedger.user_id,
            WalletLedger.balance_pending_after,
            func.row_number().over(
                partition_by=WalletLedger.user_id,
                order_by=WalletLedger.created_at.desc()
            ).label("rn")
        ).subquery()
        
        total_pending = (await self.db.execute(
            select(func.sum(pending_subquery.c.balance_pending_after)).where(
                pending_subquery.c.rn == 1
            )
        )).scalar() or 0
        
        # Platform fee all-time
        fee_all_time = (await self.db.execute(
            select(func.sum(Order.platform_fee_usd)).where(
                Order.status == OrderStatus.COMPLETED
            )
        )).scalar() or 0
        
        # Platform fee 30d
        fee_30d = (await self.db.execute(
            select(func.sum(Order.platform_fee_usd)).where(
                and_(
                    Order.status == OrderStatus.COMPLETED,
                    Order.completed_at >= thirty_days_ago
                )
            )
        )).scalar() or 0
        
        # Orders over time (last 14 days)
        orders_chart = []
        for i in range(14):
            day = now - timedelta(days=13-i)
            day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            count = (await self.db.execute(
                select(func.count(Order.id)).where(
                    and_(
                        Order.created_at >= day_start,
                        Order.created_at < day_end
                    )
                )
            )).scalar() or 0
            orders_chart.append({"date": day_start.strftime("%Y-%m-%d"), "value": count})
        
        # Revenue over time (last 14 days)
        revenue_chart = []
        for i in range(14):
            day = now - timedelta(days=13-i)
            day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            revenue = (await self.db.execute(
                select(func.sum(Order.platform_fee_usd)).where(
                    and_(
                        Order.status == OrderStatus.COMPLETED,
                        Order.completed_at >= day_start,
                        Order.completed_at < day_end
                    )
                )
            )).scalar() or 0
            revenue_chart.append({"date": day_start.strftime("%Y-%m-%d"), "value": float(revenue)})
        
        # Listing status distribution
        listing_dist = []
        for status in ListingStatus:
            count = (await self.db.execute(
                select(func.count(Listing.id)).where(Listing.status == status)
            )).scalar() or 0
            listing_dist.append({"name": status.value, "value": count})
        
        # KYC status distribution
        kyc_statuses = ["not_submitted", "pending", "approved", "rejected"]
        kyc_dist = []
        for status in kyc_statuses:
            count = (await self.db.execute(
                select(func.count(User.id)).where(User.kyc_status == status)
            )).scalar() or 0
            kyc_dist.append({"name": status, "value": count})
        
        # Pending listings queue (top 5)
        pending_listings_q = await self.db.execute(
            select(Listing).options(selectinload(Listing.seller))
            .where(Listing.status == ListingStatus.PENDING)
            .order_by(Listing.created_at.asc())
            .limit(5)
        )
        pending_listings_list = [
            {"id": str(l.id), "title": l.title, "seller": l.seller.username if l.seller else "Unknown", "created_at": l.created_at.isoformat()}
            for l in pending_listings_q.scalars().all()
        ]
        
        # Pending KYC queue (top 5)
        pending_kyc_q = await self.db.execute(
            select(KycSubmission).options(selectinload(KycSubmission.user))
            .where(KycSubmission.status == KycStatus.PENDING)
            .order_by(KycSubmission.created_at.asc())
            .limit(5)
        )
        pending_kyc_list = [
            {"id": str(k.id), "user": k.user.username if k.user else "Unknown", "doc_type": k.doc_type, "created_at": k.created_at.isoformat()}
            for k in pending_kyc_q.scalars().all()
        ]
        
        # Recent disputes (top 5)
        disputes_q = await self.db.execute(
            select(Order).options(selectinload(Order.buyer), selectinload(Order.seller))
            .where(Order.status == OrderStatus.DISPUTED)
            .order_by(Order.disputed_at.desc())
            .limit(5)
        )
        disputes_list = [
            {"id": str(o.id), "order_number": o.order_number, "amount": o.amount_usd, "buyer": o.buyer.username if o.buyer else "Unknown", "seller": o.seller.username if o.seller else "Unknown"}
            for o in disputes_q.scalars().all()
        ]
        
        # Recent admin actions (latest 10)
        actions_q = await self.db.execute(
            select(AdminAction)
            .order_by(AdminAction.created_at.desc())
            .limit(10)
        )
        actions_list = [
            {"id": str(a.id), "action_type": a.action_type.value, "actor_role": a.actor_role, "created_at": a.created_at.isoformat()}
            for a in actions_q.scalars().all()
        ]
        
        return {
            "total_users": total_users,
            "total_sellers": total_sellers,
            "active_listings": active_listings,
            "pending_listings": pending_listings,
            "pending_kyc": pending_kyc,
            "disputed_orders": disputed_orders,
            "orders_in_delivery": orders_in_delivery,
            "platform_earnings_7d": float(earnings_7d),
            "finance": {
                "total_deposits_usd": float(total_deposits),
                "total_withdrawals_usd": float(total_withdrawals),
                "total_escrow_held_usd": float(total_escrow),
                "total_seller_pending_usd": float(total_pending),
                "total_frozen_usd": float(total_frozen),
                "platform_fee_all_time_usd": float(fee_all_time),
                "platform_fee_30d_usd": float(fee_30d)
            },
            "orders_over_time": orders_chart,
            "revenue_over_time": revenue_chart,
            "listing_status_distribution": listing_dist,
            "kyc_status_distribution": kyc_dist,
            "pending_listings_queue": pending_listings_list,
            "pending_kyc_queue": pending_kyc_list,
            "recent_disputes": disputes_list,
            "recent_admin_actions": actions_list,
            "system_health": await self.get_system_health()
        }
    
    async def get_system_health(self) -> Dict[str, Any]:
        """Get system health status"""
        from app.jobs.scheduler import scheduler
        
        db_connected = True
        try:
            await self.db.execute(text("SELECT 1"))
        except:
            db_connected = False
        
        scheduler_running = scheduler.running if scheduler else False
        jobs = []
        if scheduler and scheduler.running:
            for job in scheduler.get_jobs():
                jobs.append({
                    "id": job.id,
                    "name": job.name,
                    "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None
                })
        
        return {
            "db_connected": db_connected,
            "scheduler_running": scheduler_running,
            "jobs": jobs
        }
    
    async def get_admin_actions(
        self,
        action_type: str = None,
        actor_id: UUID = None,
        target_type: str = None,
        from_date: datetime = None,
        to_date: datetime = None,
        page: int = 1,
        page_size: int = 20
    ) -> Tuple[List[AdminAction], int]:
        """Get admin action audit logs"""
        self._require_super_admin()
        
        query = select(AdminAction)
        conditions = []
        
        if action_type:
            conditions.append(AdminAction.action_type == AdminActionType(action_type))
        if actor_id:
            conditions.append(AdminAction.actor_id == actor_id)
        if target_type:
            conditions.append(AdminAction.target_type == TargetType(target_type))
        if from_date:
            conditions.append(AdminAction.created_at >= from_date)
        if to_date:
            conditions.append(AdminAction.created_at <= to_date)
        
        if conditions:
            query = query.where(and_(*conditions))
        
        count_query = select(func.count(AdminAction.id))
        if conditions:
            count_query = count_query.where(and_(*conditions))
        total = (await self.db.execute(count_query)).scalar() or 0
        
        query = query.order_by(AdminAction.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        
        result = await self.db.execute(query)
        actions = result.scalars().all()
        
        return actions, total
    
    # ==================== GAMES & FEES MANAGEMENT ====================
    
    async def update_game_buyer_note(
        self,
        game_id: UUID,
        buyer_note_html: str
    ) -> Game:
        """Update buyer note HTML for a game"""
        self._require_super_admin()
        
        result = await self.db.execute(select(Game).where(Game.id == game_id))
        game = result.scalar_one_or_none()
        
        if not game:
            raise AppException(ErrorCodes.NOT_FOUND, "Game not found", 404)
        
        before = {"buyer_note_html": game.buyer_note_html}
        game.buyer_note_html = buyer_note_html
        
        await self.audit.log(
            action_type=AdminActionType.UPDATE_CONFIG,
            target_type=TargetType.GAME,
            target_id=game_id,
            reason=f"Updated buyer note for game {game.name}",
            before_snapshot=before,
            after_snapshot={"buyer_note_html": buyer_note_html[:100] + "..." if len(buyer_note_html) > 100 else buyer_note_html}
        )
        
        await self.db.commit()
        return game
    
    # ==================== ORDER MANAGEMENT ====================
    
    async def get_all_orders(
        self,
        status: str = None,
        q: str = None,
        from_date: datetime = None,
        to_date: datetime = None,
        page: int = 1,
        page_size: int = 20
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Get all orders with filtering for super admin"""
        self._require_super_admin()
        
        query = select(Order).options(
            selectinload(Order.buyer),
            selectinload(Order.seller),
            selectinload(Order.listing)
        )
        conditions = []
        
        if status:
            # Compare against enum value string
            try:
                order_status = OrderStatus(status)
                conditions.append(Order.status == order_status)
            except ValueError:
                # Invalid status - ignore filter
                pass
        if q:
            search = f"%{q}%"
            conditions.append(or_(
                Order.order_number.ilike(search),
                Order.buyer.has(User.username.ilike(search)),
                Order.seller.has(User.username.ilike(search))
            ))
        if from_date:
            conditions.append(Order.created_at >= from_date)
        if to_date:
            conditions.append(Order.created_at <= to_date)
        
        if conditions:
            query = query.where(and_(*conditions))
        
        count_query = select(func.count(Order.id))
        if conditions:
            count_query = count_query.where(and_(*conditions))
        total = (await self.db.execute(count_query)).scalar() or 0
        
        query = query.order_by(Order.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        
        result = await self.db.execute(query)
        orders = result.scalars().all()
        
        orders_data = []
        for order in orders:
            orders_data.append({
                "id": str(order.id),
                "order_number": order.order_number,
                "status": order.status.value,
                "amount_usd": order.amount_usd,
                "platform_fee_usd": order.platform_fee_usd,
                "seller_earnings_usd": order.seller_earnings_usd,
                "buyer_username": order.buyer.username if order.buyer else None,
                "buyer_id": str(order.buyer_id),
                "seller_username": order.seller.username if order.seller else None,
                "seller_id": str(order.seller_id),
                "listing_title": order.listing.title if order.listing else None,
                "listing_id": str(order.listing_id),
                "created_at": order.created_at.isoformat(),
                "completed_at": order.completed_at.isoformat() if order.completed_at else None,
                "delivered_at": order.delivered_at.isoformat() if order.delivered_at else None,
                "disputed_at": order.disputed_at.isoformat() if order.disputed_at else None,
                "dispute_reason": order.dispute_reason,
                "dispute_resolution": order.dispute_resolution
            })
        
        return orders_data, total
    
    # ==================== WITHDRAWALS MANAGEMENT ====================
    
    async def get_withdrawal_requests(
        self,
        status: str = None,
        page: int = 1,
        page_size: int = 20
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Get withdrawal requests with optional status filter"""
        self._require_super_admin()
        
        from app.models.withdrawal import WithdrawalRequest, WithdrawalStatus
        
        query = select(WithdrawalRequest)
        conditions = []
        
        if status:
            conditions.append(WithdrawalRequest.status == WithdrawalStatus(status))
        
        if conditions:
            query = query.where(and_(*conditions))
        
        count_query = select(func.count(WithdrawalRequest.id))
        if conditions:
            count_query = count_query.where(and_(*conditions))
        total = (await self.db.execute(count_query)).scalar() or 0
        
        query = query.order_by(WithdrawalRequest.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        
        result = await self.db.execute(query)
        requests = result.scalars().all()
        
        # Get user info
        user_ids = [r.user_id for r in requests]
        users_result = await self.db.execute(
            select(User).where(User.id.in_(user_ids))
        )
        users_map = {u.id: u for u in users_result.scalars().all()}
        
        requests_data = []
        for req in requests:
            user = users_map.get(req.user_id)
            requests_data.append({
                "id": str(req.id),
                "user_id": str(req.user_id),
                "username": user.username if user else "Unknown",
                "email": user.email if user else "Unknown",
                "amount_usd": req.amount_usd,
                "payment_method": req.payment_method,
                "payment_details": req.payment_details,
                "status": req.status.value,
                "rejection_reason": req.rejection_reason,
                "admin_notes": req.admin_notes,
                "created_at": req.created_at.isoformat(),
                "processed_at": req.processed_at.isoformat() if req.processed_at else None
            })
        
        return requests_data, total
    
    async def process_withdrawal(
        self,
        withdrawal_id: UUID,
        action: str,  # "approve" or "reject"
        admin_password: str,
        rejection_reason: str = None,
        admin_notes: str = None
    ) -> Dict[str, Any]:
        """Approve or reject a withdrawal request"""
        self._require_super_admin()
        self._verify_password(admin_password)
        
        from app.models.withdrawal import WithdrawalRequest, WithdrawalStatus
        
        result = await self.db.execute(
            select(WithdrawalRequest).where(WithdrawalRequest.id == withdrawal_id)
        )
        request = result.scalar_one_or_none()
        
        if not request:
            raise AppException(ErrorCodes.NOT_FOUND, "Withdrawal request not found", 404)
        
        if request.status != WithdrawalStatus.PENDING:
            raise AppException(ErrorCodes.INVALID_STATE, "Request is not pending", 400)
        
        before = {"status": request.status.value}
        
        if action == "approve":
            # Get user balance
            available, pending, frozen = await self._get_user_balance(request.user_id)
            
            if available < request.amount_usd:
                raise AppException(ErrorCodes.INSUFFICIENT_BALANCE, "User has insufficient balance", 400)
            
            # Debit user wallet
            new_available = available - request.amount_usd
            
            ledger = WalletLedger(
                user_id=request.user_id,
                entry_type=LedgerEntryType.WITHDRAWAL_PAID,
                amount_usd=-request.amount_usd,
                balance_available_after=new_available,
                balance_pending_after=pending,
                balance_frozen_after=frozen,
                admin_id=self.admin.id,
                reason=f"Withdrawal approved: {request.payment_method}",
                description=f"Withdrawal #{str(request.id)[:8]} processed"
            )
            self.db.add(ledger)
            await self.db.flush()
            
            request.status = WithdrawalStatus.APPROVED
            request.ledger_entry_id = ledger.id
            
        elif action == "reject":
            if not rejection_reason:
                raise AppException(ErrorCodes.VALIDATION_ERROR, "Rejection reason required", 400)
            
            request.status = WithdrawalStatus.REJECTED
            request.rejection_reason = rejection_reason
        else:
            raise AppException(ErrorCodes.VALIDATION_ERROR, "Invalid action", 400)
        
        request.processed_by = self.admin.id
        request.processed_at = datetime.now(timezone.utc)
        request.admin_notes = admin_notes
        
        await self.audit.log(
            action_type=AdminActionType.WALLET_DEBIT if action == "approve" else AdminActionType.WALLET_FREEZE,
            target_type=TargetType.USER,
            target_id=request.user_id,
            reason=f"Withdrawal {action}d: {rejection_reason or 'Approved'}",
            before_snapshot=before,
            after_snapshot={"status": request.status.value, "amount_usd": request.amount_usd},
            confirmation_method=ConfirmationMethod.PASSWORD
        )
        
        await self.db.commit()
        
        return {
            "id": str(request.id),
            "status": request.status.value,
            "action": action,
            "amount_usd": request.amount_usd
        }
    
    # ==================== GIFT CARD MANAGEMENT ====================
    
    async def generate_gift_cards(
        self,
        count: int,
        value_usd: float
    ) -> List[Dict[str, Any]]:
        """Generate one or more gift cards with 16-digit numeric codes"""
        self._require_super_admin()
        
        import random
        
        if count < 1 or count > 100:
            raise AppException(ErrorCodes.VALIDATION_ERROR, "Count must be between 1 and 100", 400)
        
        if value_usd <= 0 or value_usd > 10000:
            raise AppException(ErrorCodes.VALIDATION_ERROR, "Value must be between 0.01 and 10000", 400)
        
        cards_created = []
        
        for _ in range(count):
            # Generate 16-digit numeric code
            code = ''.join([str(random.randint(0, 9)) for _ in range(16)])
            
            # Check uniqueness
            existing = await self.db.execute(
                select(GiftCard).where(GiftCard.code == code)
            )
            if existing.scalar_one_or_none():
                # Regenerate if collision
                code = ''.join([str(random.randint(0, 9)) for _ in range(16)])
            
            card = GiftCard(
                code=code,
                amount_usd=value_usd,
                status="active",
                is_active=True,
                is_redeemed=False,
                created_by=self.admin.id
            )
            self.db.add(card)
            await self.db.flush()
            
            cards_created.append({
                "id": str(card.id),
                "code": card.code,
                "amount_usd": card.amount_usd,
                "status": card.status,
                "created_at": card.created_at.isoformat()
            })
        
        await self.audit.log(
            action_type=AdminActionType.WALLET_CREDIT,
            target_type=TargetType.CONFIG,
            reason=f"Generated {count} gift card(s) worth ${value_usd} each",
            after_snapshot={"count": count, "value_usd": value_usd, "codes": [c["code"][:4] + "****" for c in cards_created]}
        )
        
        await self.db.commit()
        return cards_created
    
    async def get_gift_cards(
        self,
        status: str = None,
        code_search: str = None,
        page: int = 1,
        page_size: int = 50
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Get gift cards with filtering"""
        self._require_super_admin()
        
        query = select(GiftCard)
        conditions = []
        
        if status:
            conditions.append(GiftCard.status == status)
        if code_search:
            conditions.append(GiftCard.code.ilike(f"%{code_search}%"))
        
        if conditions:
            query = query.where(and_(*conditions))
        
        count_query = select(func.count(GiftCard.id))
        if conditions:
            count_query = count_query.where(and_(*conditions))
        total = (await self.db.execute(count_query)).scalar() or 0
        
        query = query.order_by(GiftCard.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        
        result = await self.db.execute(query)
        cards = result.scalars().all()
        
        # Get redeemed_by usernames
        redeemed_ids = [c.redeemed_by for c in cards if c.redeemed_by]
        users_map = {}
        if redeemed_ids:
            users_result = await self.db.execute(
                select(User).where(User.id.in_(redeemed_ids))
            )
            users_map = {u.id: u.username for u in users_result.scalars().all()}
        
        cards_data = []
        for card in cards:
            cards_data.append({
                "id": str(card.id),
                "code": card.code,
                "amount_usd": card.amount_usd,
                "status": card.status,
                "redeemed_by": str(card.redeemed_by) if card.redeemed_by else None,
                "redeemed_by_username": users_map.get(card.redeemed_by),
                "redeemed_at": card.redeemed_at.isoformat() if card.redeemed_at else None,
                "created_at": card.created_at.isoformat(),
                "expires_at": card.expires_at.isoformat() if card.expires_at else None
            })
        
        return cards_data, total
    
    async def deactivate_gift_card(
        self,
        card_id: UUID,
        reason: str
    ) -> Dict[str, Any]:
        """Deactivate a gift card"""
        self._require_super_admin()
        
        result = await self.db.execute(
            select(GiftCard).where(GiftCard.id == card_id)
        )
        card = result.scalar_one_or_none()
        
        if not card:
            raise AppException(ErrorCodes.NOT_FOUND, "Gift card not found", 404)
        
        if card.status == "redeemed":
            raise AppException(ErrorCodes.INVALID_STATE, "Cannot deactivate redeemed card", 400)
        
        before = {"status": card.status}
        card.status = "deactivated"
        card.is_active = False
        
        await self.audit.log(
            action_type=AdminActionType.WALLET_FREEZE,
            target_type=TargetType.CONFIG,
            target_id=card_id,
            reason=reason,
            before_snapshot=before,
            after_snapshot={"status": "deactivated", "code": card.code[:4] + "****"}
        )
        
        await self.db.commit()
        
        return {
            "id": str(card.id),
            "code": card.code,
            "status": "deactivated"
        }
    
    # ==================== ADMIN PERMISSION SCOPES ====================
    
    async def get_admin_scopes(
        self,
        admin_id: UUID
    ) -> Dict[str, Any]:
        """Get admin permission scopes"""
        self._require_super_admin()
        
        result = await self.db.execute(
            select(User).where(User.id == admin_id)
        )
        admin = result.scalar_one_or_none()
        
        if not admin:
            raise AppException(ErrorCodes.NOT_FOUND, "Admin not found", 404)
        
        if "admin" not in admin.roles and "super_admin" not in admin.roles:
            raise AppException(ErrorCodes.VALIDATION_ERROR, "User is not an admin", 400)
        
        return {
            "id": str(admin.id),
            "username": admin.username,
            "email": admin.email,
            "roles": admin.roles,
            "admin_permissions": admin.admin_permissions or []
        }
    
    async def update_admin_scopes(
        self,
        admin_id: UUID,
        scopes: List[str],
        admin_password: str
    ) -> Dict[str, Any]:
        """Update admin permission scopes"""
        self._require_super_admin()
        self._verify_password(admin_password)
        
        # Valid scopes
        valid_scopes = ["LISTINGS_REVIEW", "KYC_REVIEW", "DISPUTE_RESOLVE", "FAQ_EDIT", "FINANCE_VIEW", "FINANCE_ACTION"]
        
        for scope in scopes:
            if scope not in valid_scopes:
                raise AppException(ErrorCodes.VALIDATION_ERROR, f"Invalid scope: {scope}", 400)
        
        result = await self.db.execute(
            select(User).where(User.id == admin_id)
        )
        admin = result.scalar_one_or_none()
        
        if not admin:
            raise AppException(ErrorCodes.NOT_FOUND, "Admin not found", 404)
        
        if "admin" not in admin.roles:
            raise AppException(ErrorCodes.VALIDATION_ERROR, "User is not an admin", 400)
        
        if "super_admin" in admin.roles:
            raise AppException(ErrorCodes.AUTHORIZATION_ERROR, "Cannot modify super admin scopes", 403)
        
        before = {"admin_permissions": admin.admin_permissions or []}
        admin.admin_permissions = scopes
        
        await self.audit.log(
            action_type=AdminActionType.PROMOTE_ROLE,
            target_type=TargetType.USER,
            target_id=admin_id,
            reason=f"Updated admin scopes to: {', '.join(scopes) or 'none'}",
            before_snapshot=before,
            after_snapshot={"admin_permissions": scopes},
            confirmation_method=ConfirmationMethod.PASSWORD
        )
        
        await self.db.commit()
        
        return {
            "id": str(admin.id),
            "username": admin.username,
            "admin_permissions": scopes
        }
    
    async def apply_scope_preset(
        self,
        admin_id: UUID,
        preset: str,
        admin_password: str
    ) -> Dict[str, Any]:
        """Apply a preset scope configuration"""
        presets = {
            "moderator": ["LISTINGS_REVIEW", "DISPUTE_RESOLVE"],
            "kyc_reviewer": ["KYC_REVIEW"],
            "content_admin": ["FAQ_EDIT"],
            "ops_admin": ["LISTINGS_REVIEW", "KYC_REVIEW", "DISPUTE_RESOLVE", "FAQ_EDIT"]
        }
        
        if preset not in presets:
            raise AppException(ErrorCodes.VALIDATION_ERROR, f"Invalid preset: {preset}", 400)
        
        return await self.update_admin_scopes(admin_id, presets[preset], admin_password)
    
    # ==================== MODERATION (EXTENDED) ====================
    
    async def suspend_seller(
        self,
        user_id: UUID,
        reason: str,
        admin_password: str
    ) -> User:
        """Suspend a seller (hide all listings, block new listings)"""
        self._require_super_admin()
        self._verify_password(admin_password)
        
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            raise AppException(ErrorCodes.NOT_FOUND, "User not found", 404)
        
        if "seller" not in user.roles:
            raise AppException(ErrorCodes.VALIDATION_ERROR, "User is not a seller", 400)
        
        before = {"status": user.status, "is_active": user.is_active}
        
        # Suspend user
        user.status = "suspended"
        user.status_reason = reason
        user.status_changed_at = datetime.now(timezone.utc)
        user.status_changed_by = self.admin.id
        
        # Hide all their active listings
        await self.db.execute(
            text("""
                UPDATE listings 
                SET status = 'inactive', rejection_reason = :reason
                WHERE seller_id = :seller_id AND status = 'approved'
            """),
            {"seller_id": user_id, "reason": f"Seller suspended: {reason}"}
        )
        
        await self.audit.log(
            action_type=AdminActionType.BAN_USER,
            target_type=TargetType.USER,
            target_id=user_id,
            reason=reason,
            before_snapshot=before,
            after_snapshot={"status": "suspended", "listings_hidden": True},
            confirmation_method=ConfirmationMethod.PASSWORD
        )
        
        await self.db.commit()
        return user
