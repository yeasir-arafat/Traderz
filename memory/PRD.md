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

## What's Been Implemented (January 2025)

### Backend ✅
- Complete modular FastAPI structure
- PostgreSQL with SQLAlchemy async
- All database models (User, Game, Listing, Order, Wallet, Chat, etc.)
- Authentication (email/password + Firebase social)
- CRUD APIs for all entities
- Wallet ledger system
- Order state machine with escrow
- KYC workflow
- Games/Platforms/Fee rules management
- Seed data (super admin, admin, 8 games)

### Frontend ✅
- Neon green/cyan dark theme
- Homepage with hero, features, games, listings
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

### Auth System ✅
- Email/password registration with password policy
- JWT access tokens + refresh tokens
- Firebase Google/Facebook integration
- Terms acceptance enforcement
- Password reset flow
- Profile completion for social logins

## Prioritized Backlog

### P0 - Critical (Next)
- [ ] WebSocket for real-time chat
- [ ] Create/Edit listing page for sellers
- [ ] Admin dashboard (pending listings, KYC, disputes)
- [ ] Super Admin dashboard (stats, finance, config)
- [ ] Background jobs (auto-complete orders, release pending)

### P1 - High Priority
- [ ] Notifications page
- [ ] Seller public profile page
- [ ] Review system after order completion
- [ ] My Listings management page
- [ ] KYC submission page

### P2 - Medium Priority
- [ ] FAQ management (admin)
- [ ] Gift card creation (admin)
- [ ] User management (admin)
- [ ] Fee rules configuration
- [ ] Email notifications (SendGrid/similar)

### P3 - Nice to Have
- [ ] FCM push notifications
- [ ] S3 file storage
- [ ] Image optimization
- [ ] Advanced search filters
- [ ] Analytics dashboard

## Seeded Accounts
- **Super Admin**: super@admin.com / admin12
- **Admin**: admin@admin.com / admin12

## Next Tasks
1. Complete seller flow (create listing, my listings page)
2. Build admin panel for approvals
3. Add WebSocket for real-time messaging
4. Implement background jobs scheduler
