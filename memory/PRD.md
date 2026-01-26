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
- **Frontend**: React + Tailwind CSS + shadcn/ui + Zustand + React Query + Firebase SDK
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

## User Personas
1. **Buyer** - Purchases game accounts, manages wallet, chats with sellers
2. **Seller** - Lists accounts, delivers orders, earns from sales
3. **Admin** - Approves listings, KYC, resolves disputes
4. **Super Admin** - Full platform control, config, finance

## Core Requirements (Static)
- Secure escrow payment protection
- 24h dispute window after delivery
- 10-day seller protection hold
- Password policy enforcement
- Terms acceptance required
- KYC required for sellers
- Profile lock after KYC approval

## What's Been Implemented

### January 25, 2026

#### P0 Security Fixes ✅
- Firebase credentials loaded from environment variables
- Strict CORS policy (configurable origins, not *)
- Pillow-based image validation on uploads
- WebSocket with JWT authentication
- APScheduler for background jobs

#### P1 Admin Panel ✅
- **Admin Dashboard** (`/admin`): Shows pending listings, pending KYC, disputed orders, active orders
- **Pending Listings** (`/admin/listings`): Review and approve/reject seller listings
- **KYC Review** (`/admin/kyc`): Verify seller identity documents
- **Dispute Resolution** (`/admin/disputes`): Handle order disputes, refund buyer or complete for seller
- Super Admin sees additional Platform Overview stats

#### P1 Seller Pages ✅
- **My Listings** (`/my-listings`): View, edit, delete listings with status filter
- **Create Listing** (`/sell/new`): Form with game selection, platforms, regions, images
- **Edit Listing** (`/sell/:id/edit`): Modify existing listings

#### KYC System ✅
- **KYC Page** (`/kyc`): Submit identity documents for verification
- Document types: National ID, Passport, Driving License
- Upload front, back, selfie
- Status tracking (not_submitted, pending, approved, rejected)

#### Backend Services ✅
- Listing service: Full CRUD, filters, approval workflow
- Order service: State machine, escrow, disputes
- Wallet service: Immutable ledger, all transaction types
- Chat service: Conversations, messages, admin invite
- KYC service: Submit, review, status tracking
- User service: Profile, seller levels, rating
- Scheduler: Auto-complete orders (24h), release pending earnings (10 days)

#### Frontend Features ✅
- Neon green/cyan dark theme
- Homepage with hero, features, games
- Browse page with filters
- Listing details page
- Login/Register with social login
- Profile page with stats
- Wallet page with deposit/withdraw/gift card
- Orders page (purchases/sales tabs)
- Order details with actions
- Chat system
- FAQ page
- Mobile-responsive layout
- Role-based navigation

### Testing ✅
- Backend: 100% pass rate (14/14 tests)
- Frontend: 100% pass rate
- Test file: `/app/backend/tests/test_admin_seller.py`

## Prioritized Backlog

### P0 - Critical ✅ DONE
- [x] Security fixes (Firebase, CORS, file validation)
- [x] Background jobs scheduler
- [x] Admin panel (dashboard, listings, KYC, disputes)
- [x] Seller create/edit listing pages

### P1 - High Priority
- [ ] Notifications page (frontend)
- [ ] Seller public profile page
- [ ] Review system after order completion
- [ ] Real-time chat WebSocket integration in frontend
- [ ] Email notifications (SendGrid/similar)

### P2 - Medium Priority
- [ ] FAQ management (admin)
- [ ] Gift card creation (admin)
- [ ] User management (admin)
- [ ] Fee rules configuration (admin)
- [ ] Password change/reset pages

### P3 - Nice to Have
- [ ] FCM push notifications
- [ ] S3 file storage migration
- [ ] Image optimization
- [ ] Advanced search filters
- [ ] Analytics dashboard

## API Endpoints

### Auth
- POST `/api/auth/register` - User registration
- POST `/api/auth/login` - User login
- POST `/api/auth/firebase` - Social login
- GET `/api/auth/me` - Get current user

### Listings
- GET `/api/listings` - Browse listings
- GET `/api/listings/my` - Seller's listings
- POST `/api/listings` - Create listing (seller)
- PUT `/api/listings/:id` - Update listing (seller)
- DELETE `/api/listings/:id` - Delete listing (seller)
- GET `/api/listings/admin/pending` - Pending listings (admin)
- POST `/api/listings/admin/:id/review` - Approve/reject (admin)

### Orders
- POST `/api/orders` - Create order
- GET `/api/orders/my/purchases` - Buyer's orders
- GET `/api/orders/my/sales` - Seller's orders
- POST `/api/orders/:id/deliver` - Deliver order (seller)
- POST `/api/orders/:id/complete` - Complete order (buyer)
- POST `/api/orders/:id/dispute` - Dispute order (buyer)
- POST `/api/orders/admin/:id/resolve` - Resolve dispute (admin)

### Wallet
- GET `/api/wallet/balance` - Get balance
- GET `/api/wallet/history` - Transaction history
- POST `/api/wallet/deposit` - Mock deposit
- POST `/api/wallet/redeem-giftcard` - Redeem gift card

### KYC
- GET `/api/kyc/my` - Get KYC status
- POST `/api/kyc` - Submit KYC
- GET `/api/kyc/admin/pending` - Pending KYC (admin)
- POST `/api/kyc/admin/:id/review` - Review KYC (admin)

### Admin
- GET `/api/admin/dashboard` - Dashboard stats
- GET `/api/admin/disputes` - Disputed orders

### WebSocket
- `/ws?token=<jwt>` - Real-time chat

## Seeded Accounts
- **Super Admin**: super@admin.com / admin12
- **Admin**: admin@admin.com / admin12

## Known Mocked Features
- **Wallet deposits**: No real payment gateway (mock deposit)
- **Wallet withdrawals**: No real payout processing
- **File storage**: Local filesystem (not cloud S3)

## Database Schema (Key Tables)
- User, Game, GamePlatform, Listing, Order, OrderCounter
- WalletLedger (immutable), GiftCard
- Conversation, Message
- KycSubmission, Review
- PlatformConfig, PlatformFeeRule, AdminAction, Notification
