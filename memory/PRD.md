# PlayTraderz - Game Account Marketplace

## Product Overview
A full-stack game account marketplace with wallet/escrow system, real-time chat, seller levels, KYC, multi-currency support, gift cards, notifications, and comprehensive admin/super admin panels.

## Tech Stack
- **Frontend**: React (Vite), Tailwind CSS, Zustand, React Query, Recharts
- **Backend**: FastAPI, SQLAlchemy (async), PostgreSQL (Neon)
- **Auth**: JWT + Firebase Social Login (Google/Facebook)
- **File Storage**: Local filesystem (production: S3 recommended)

---

## Implemented Features

### Core Marketplace (Complete - Feb 4, 2026)
- User registration/login with email and social auth
- Browse listings with filters (game, platform, price)
- Listing detail pages with account info
- Wallet system with escrow (10-day security hold for seller earnings)
- Order flow: Create → Pay → Deliver → Complete/Dispute
- Real-time chat via WebSocket with live connection indicator
- Review submission after order completion
- Dispute functionality with 24-hour window after delivery
- **Notifications page with mark-read functionality**
- **Seller public profile page** (`/seller/{username}`) with listings, reviews, stats
- **Password recovery flow with real email delivery via Brevo/Sendinblue**
- **Email notifications for order status changes**:
  - Order created (buyer + seller)
  - Order delivered (buyer)
  - Order completed (buyer + seller)
  - Order disputed (seller)
  - Order refunded (buyer + seller)

### Seller Features (Complete)
- Create/edit listings with images
- Seller dashboard with sales stats
- Seller levels (Bronze/Silver/Gold/Platinum/Diamond)
- KYC submission for verification

### Admin Features (Complete)
- Listing review and approval
- KYC review
- Admin dashboard with pending items
- **Scope-based access control with UI indicators**

### Super Admin System V2 (Complete - Jan 28, 2026)
All modules implemented with audit logging and step-up confirmation:

1. **Games & Fees Management** ✅
   - Create/edit games with buyer_note_html
   - Toggle game active status
   - Platform fee rules
   - **buyer_note_html displayed on listing detail pages**

2. **Order Management** ✅
   - View all orders with search/filter
   - Status filter (pending, paid, delivered, etc.)
   - Escrow breakdown view

3. **Withdrawals Management** ✅
   - Review pending withdrawal requests
   - Approve/Reject with mandatory reason
   - Admin notes and audit trail

4. **Moderation** ✅
   - Hide listings with reason
   - Suspend sellers (hides all their listings)
   - Soft-hide chat messages

5. **Gift Card Management** ✅
   - Generate 16-digit numeric codes
   - Single/bulk generation (1-100)
   - Deactivate with reason
   - Status filter (active/redeemed/deactivated)
   - Export CSV

6. **System Health** ✅
   - Database connection status
   - Scheduler status
   - Scheduled jobs list

7. **Admin Permission Scopes** ✅
   - Granular scopes: LISTINGS_REVIEW, KYC_REVIEW, DISPUTE_RESOLVE, FAQ_EDIT, FINANCE_VIEW, FINANCE_ACTION
   - One-click presets: Moderator, KYC Reviewer, Content Admin, Ops Admin
   - Super admin bypasses all scopes
   - **Backend enforcement with INSUFFICIENT_SCOPE error**
   - **Frontend UI hides/locks buttons when scope missing**

### UI/UX Updates (Jan-Feb 2026)
- **Super Admin Dashboard redesigned** with modern mobile-first design
  - Admin Hub header with animated "System Stable" indicator
  - Key Metrics horizontal scroll carousel
  - Action Center 2x2 grid with pending badges
  - Financial Flow chart with SVG
  - Fixed bottom navigation bar
- **Admin Dashboard** shows user's active scopes as badges
- **Listing Detail Page** displays game-specific buyer notes
- **Homepage redesigned** with modern gaming marketplace aesthetic
  - Hero section with gradient overlays and "HOT DEAL" badge
  - Game-categorized listing carousels with horizontal scroll
  - Green (#13ec5b) accent color theme
  - Features section with colorful icons
  - Full footer with company info, links, social media, payment badges
  - Mobile bottom navigation (Home, Search, Sell, Chat, Profile)

---

## API Endpoints

### Super Admin Endpoints
- `GET /api/superadmin/dashboard` - Comprehensive stats
- `GET /api/superadmin/orders` - All orders with filtering
- `GET /api/superadmin/withdrawals` - Withdrawal requests
- `POST /api/superadmin/withdrawals/{id}/process` - Approve/reject
- `GET /api/superadmin/giftcards` - List gift cards
- `POST /api/superadmin/giftcards/generate` - Generate new cards
- `POST /api/superadmin/giftcards/{id}/deactivate` - Deactivate card
- `GET /api/superadmin/admins/{id}/scopes` - Get admin scopes
- `PUT /api/superadmin/admins/{id}/scopes` - Update scopes
- `POST /api/superadmin/admins/{id}/scopes/preset` - Apply preset
- `POST /api/superadmin/users/{id}/suspend-seller` - Suspend seller
- `GET /api/superadmin/system-health` - System health check

---

## Database Schema (Key Tables)

### Gift Cards
```sql
CREATE TABLE giftcards (
  id UUID PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,      -- 16-digit numeric
  amount_usd FLOAT NOT NULL,
  status VARCHAR(20) DEFAULT 'active',   -- active|redeemed|deactivated
  redeemed_by UUID REFERENCES users(id),
  redeemed_at TIMESTAMP,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP,
  expires_at TIMESTAMP                    -- Optional, null = no expiry
);
```

### Withdrawal Requests
```sql
CREATE TABLE withdrawal_requests (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  amount_usd FLOAT NOT NULL,
  payment_method VARCHAR(50),
  payment_details TEXT,
  status VARCHAR(20) DEFAULT 'pending',  -- pending|approved|rejected|cancelled
  processed_by UUID,
  processed_at TIMESTAMP,
  rejection_reason TEXT,
  admin_notes TEXT,
  ledger_entry_id UUID REFERENCES wallet_ledger(id)
);
```

---

## Test Credentials
- **Super Admin**: super@admin.com / admin12
- **Admin**: admin@admin.com / admin12

---

## Backlog / Future Tasks

### P1 (High Priority)
- [x] ~~Connect ChatPage.jsx to WebSocket backend~~ (Completed Feb 4, 2026)
- [x] ~~Fix listing creation, order flow, escrow, reviews, disputes~~ (Completed Feb 4, 2026)
- [x] ~~Build notifications page/UI~~ (Completed Feb 4, 2026)
- [x] ~~Build seller public profile page~~ (Completed Feb 4, 2026)
- [x] ~~Password recovery flow with email~~ (Completed Feb 4, 2026 - using Brevo)

### P2 (Medium Priority)
- [ ] Multi-language support
- [x] ~~Email notifications for order status changes~~ (Completed Feb 4, 2026)
- [ ] Implement content reporting/flagging system
- [x] ~~Admin scope enforcement on frontend (hide buttons when scope missing)~~ (Completed)
- [x] ~~Admin scope enforcement on backend (403 INSUFFICIENT_SCOPE)~~ (Completed)

### P3 (Nice to Have)
- [ ] Gift card expiration handling
- [ ] Multi-currency support expansion
- [ ] Advanced analytics dashboard
- [ ] Setup Alembic for database migrations

---

## Changelog

### February 4, 2026 (Latest)
- **Built Notifications Page/UI**
  - Full notifications list with mark-read functionality
  - Individual and mark-all-read buttons
  - Filter by unread
- **Built Seller Public Profile Page** (`/seller/{username}`)
  - Seller stats: level, rating, reviews, sales, member since
  - KYC verification badge
  - Active listings grid
  - Recent reviews section
  - Contact seller button
- **Implemented Password Recovery Flow**
  - Forgot password page (`/forgot-password`)
  - Reset password page (`/reset-password?token=xxx`)
  - Real email delivery via **Brevo/Sendinblue** (not mocked!)
  - HTML email templates with PlayTraderz branding
  - Password validation and secure token handling
- **Fixed Core Marketplace Functionality**
  - Fixed SQLAlchemy async relationship loading in services
  - Escrow system working: buyer funds held, released to seller pending
  - Chat WebSocket support with live/offline indicator

### January 28, 2026
- Super Admin System V2 modules completed
- Homepage and Super Admin Dashboard redesigned
- Admin scope enforcement on backend and frontend

---

## Known Limitations
- Wallet deposits/withdrawals not connected to real payment gateway (MOCKED)
- File storage uses local filesystem (not cloud S3)
- Database migrations applied via direct SQL (no Alembic)

## 3rd Party Integrations
- **PostgreSQL (Neon)**: Main application database
- **Firebase**: Google & Facebook social login
- **Brevo/Sendinblue**: Email delivery for password reset and notifications
- **Pillow**: Python imaging library for file uploads

---

## Architecture Notes
```
/app/
├── backend/
│   ├── app/
│   │   ├── api/routes/     # FastAPI route handlers
│   │   ├── core/           # Config, database, security
│   │   ├── models/         # SQLAlchemy models
│   │   ├── schemas/        # Pydantic schemas
│   │   └── services/       # Business logic
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── components/     # Reusable UI components
    │   ├── pages/          # Route pages
    │   ├── lib/api.js      # API client
    │   └── store/          # Zustand state
    └── package.json
```

Last Updated: February 4, 2026
