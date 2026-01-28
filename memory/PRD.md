# PlayTraderz - Game Account Marketplace PRD

## Original Problem Statement
Create a full game account marketplace with:
- Wallet/escrow system
- Real-time chat
- Seller levels
- Super admin controls
- KYC verification
- Multi-currency support (USD/BDT)
- Gift cards
- Notifications
- FAQ system

## Architecture

### Tech Stack
- **Frontend**: React + Tailwind CSS + shadcn/ui + Zustand + React Query + Recharts
- **Backend**: FastAPI + SQLAlchemy 2.x (async) + PostgreSQL (Neon)
- **Auth**: JWT + Firebase (Google/Facebook social login)
- **File Storage**: Local /uploads directory
- **Background Jobs**: APScheduler (auto-complete orders, release seller earnings)
- **Real-time**: WebSocket for chat

### Key Components
- Modular backend structure with separation of concerns
- Ledger-based wallet (immutable entries)
- State machine for order management
- Role-based access control (buyer, seller, admin, super_admin)
- Immutable audit logs for all admin actions

## What's Been Implemented

### January 28, 2026

#### Owner-Grade Super Admin System ✅
Complete "owner-grade" Super Admin system with:

**Security Guardrails:**
- Step-up confirmation for dangerous actions (password re-entry)
- Typed confirm phrase required for large amounts (≥$1,000)
- Immutable audit logs with IP address and user agent tracking
- Idempotency key support for wallet operations

**Super Admin Dashboard (`/superadmin`):**
- KPI cards: Total Users, Sellers, Active Listings, Pending Listings, Pending KYC, Disputes, Orders in Delivery, Platform Earnings (7d)
- Finance Overview: Deposits, Withdrawals, Escrow Held, Seller Pending, Frozen Funds, Platform Fees (all-time & 30d)
- Charts: Orders over time (14 days), Revenue over time (14 days), Listing Status distribution, KYC Status distribution
- Action Queues: Pending Listings, Pending KYC, Recent Disputes
- System Health: Database connection status, Scheduler status with job schedules

**Users Management (`/superadmin/users`):**
- Search and filter users by role, status, KYC status
- View user details with wallet balances and order/listing counts
- Ban/Unban users with reason
- Edit user roles (promote/demote) with password confirmation
- Force logout (revoke all sessions)
- Unlock profile for editing after KYC approval

**Finance Console (`/superadmin/finance`):**
- Search and select users
- View user wallet balances (Available, Pending, Frozen)
- Credit wallet (admin deposit)
- Debit wallet (requires password, large amounts need "CONFIRM DEBIT")
- Freeze funds (requires password, large amounts need "CONFIRM FREEZE")
- Unfreeze funds
- View user's ledger history

**Audit Logs (`/superadmin/audit-logs`):**
- View all admin actions
- Filter by action type and target type
- See actor role, IP address, timestamp
- View action details (reason, before/after snapshots)

**API Endpoints:**
- GET `/api/superadmin/dashboard` - Dashboard stats
- GET `/api/superadmin/system-health` - System health
- GET `/api/superadmin/admin-actions` - Audit logs
- GET/POST `/api/superadmin/admins` - Admin management
- GET `/api/superadmin/users` - User list
- GET `/api/superadmin/users/:id` - User detail
- PATCH `/api/superadmin/users/:id/status` - Ban/unban
- PATCH `/api/superadmin/users/:id/roles` - Role management
- POST `/api/superadmin/users/:id/force-logout` - Force logout
- POST `/api/superadmin/users/:id/unlock-profile` - Unlock profile
- POST `/api/superadmin/wallet/credit|debit|freeze|unfreeze` - Wallet ops
- GET `/api/superadmin/wallet/ledger` - User ledger

### January 25, 2026

#### P0 Security Fixes ✅
- Firebase credentials loaded from environment variables
- Strict CORS policy (configurable origins)
- Pillow-based image validation on uploads
- WebSocket with JWT authentication
- APScheduler for background jobs

#### P1 Admin Panel ✅
- Admin Dashboard, Pending Listings, KYC Review, Disputes

#### P1 Seller Pages ✅
- My Listings, Create/Edit Listing

#### KYC System ✅
- KYC submission page with document upload

#### Backend Services ✅
- All core services fully implemented

## Prioritized Backlog

### P0 - Critical ✅ DONE
- [x] Security fixes
- [x] Background jobs scheduler
- [x] Admin panel
- [x] Seller pages
- [x] **Super Admin System** (Owner-grade controls)

### P1 - High Priority
- [ ] Real-time chat WebSocket integration in frontend
- [ ] Notifications page (frontend)
- [ ] Seller public profile page
- [ ] Review system after order completion
- [ ] Email notifications (SendGrid)

### P2 - Medium Priority
- [ ] FAQ management (admin)
- [ ] Gift card creation (admin)
- [ ] Admin user management via UI
- [ ] Fee rules configuration via UI
- [ ] Password change/reset pages

### P3 - Nice to Have
- [ ] FCM push notifications
- [ ] S3 file storage migration
- [ ] Image optimization
- [ ] Advanced search filters
- [ ] Analytics dashboard

## Seeded Accounts
- **Super Admin**: super@admin.com / admin12 (full platform control)
- **Admin**: admin@admin.com / admin12 (moderation only)

## Known Mocked Features
- **Wallet deposits**: No real payment gateway (mock deposit)
- **Wallet withdrawals**: No real payout processing
- **File storage**: Local filesystem (not cloud S3)
