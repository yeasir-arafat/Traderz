# Super Admin Guide - PlayTraderz

## Overview

The Super Admin account is the platform owner with complete control over all system functions. This guide explains how to use the Super Admin features safely.

## Access

- **URL**: Navigate to `/superadmin` after logging in
- **Credentials**: super@admin.com / admin12
- **Menu**: Click your username in the header → "Super Admin"

## Security Guardrails

### Step-Up Confirmation
Dangerous operations require additional confirmation:

1. **Password Confirmation**: Required for:
   - Wallet debit
   - Wallet freeze
   - User ban
   - Role changes
   - Profile unlock

2. **Typed Phrase Confirmation**: Required for large amounts (≥$1,000):
   - Type "CONFIRM DEBIT" for wallet debit
   - Type "CONFIRM FREEZE" for wallet freeze
   - Type "CONFIRM REFUND" for force refund
   - Type "CONFIRM COMPLETE" for force complete

### Audit Logging
All admin actions are recorded immutably with:
- Actor ID and role
- Action type
- Target type and ID
- Before/after snapshots
- IP address and user agent
- Timestamp

## Features

### 1. Dashboard (`/superadmin`)

**KPI Cards** (top row):
- Total Users
- Total Sellers
- Active Listings
- Pending Listings (click to review)
- Pending KYC (click to review)
- Disputes (click to resolve)
- Orders in Delivery
- Platform Earnings (7 days)

**Finance Overview**:
- Total Deposits
- Withdrawals Paid
- Escrow Held (in active orders)
- Seller Pending (10-day protection)
- Frozen Funds
- Platform Fees (all-time & 30 days)

**Charts**:
- Orders over time (14 days)
- Revenue over time (14 days)
- Listing status distribution (pie)
- KYC status distribution (pie)

**Action Queues**:
- Pending Listings (top 5) - quick approve/reject
- Pending KYC (top 5) - quick review
- Recent Disputes (top 5) - quick resolve

**System Health**:
- Database connection status
- Scheduler status with next run times

### 2. Users Management (`/superadmin/users`)

**Search & Filter**:
- Search by username, email, or name
- Filter by role (buyer, seller, admin)
- Filter by status (active, suspended, banned)
- Filter by KYC status

**User Actions** (click "View" on a user):
- **View Details**: See wallet balances, order counts, listing counts
- **Ban User**: Requires reason and password confirmation
- **Unban User**: Restore user access
- **Edit Roles**: Add/remove buyer, seller, admin roles
- **Force Logout**: Revoke all active sessions
- **Unlock Profile**: Allow editing even after KYC approval

### 3. Finance Console (`/superadmin/finance`)

**Find User**: Search by username/email/name

**Wallet View** (after selecting user):
- Available balance
- Pending balance (seller earnings in protection)
- Frozen balance

**Wallet Actions**:
- **Credit**: Add funds (admin deposit)
- **Debit**: Remove funds (requires password + phrase for large amounts)
- **Freeze**: Lock funds (requires password + phrase for large amounts)
- **Unfreeze**: Release frozen funds

**Ledger History**: View all wallet transactions

### 4. Platform Config (`/superadmin/config`)

Manage core platform, currency, and listing settings:

- **Currency**
  - USD→BDT exchange rate
  - Default platform fee percentage
- **Protection Windows**
  - Dispute window (hours) for buyers to open disputes after delivery
  - Seller protection days (earnings held before release)
- **Listing Rules**
  - KYC required to become a seller (toggle)
  - Listing approval required (toggle for admin review before going live)
  - Max upload size (MB) for listing images
  - Max images per listing
- **Maintenance Mode**
  - Toggle to put the platform into maintenance mode (front-end can show banners or restrict actions based on this flag)

All config changes are recorded as `UPDATE_CONFIG` entries in the audit logs.

### 5. Audit Logs (`/superadmin/audit-logs`)

**View all admin actions** with:
- Action type (approve, reject, ban, credit, etc.)
- Target type (user, listing, order, etc.)
- Actor role
- Timestamp
- IP address

**Filter by**:
- Action type
- Target type

**Click to view details**: See full reason, before/after snapshots

## API Endpoints

### Dashboard
```
GET /api/superadmin/dashboard
GET /api/superadmin/system-health
```

### Admin Management
```
GET /api/superadmin/admins
POST /api/superadmin/admins
PATCH /api/superadmin/admins/:id
```

### User Management
```
GET /api/superadmin/users
GET /api/superadmin/users/:id
PATCH /api/superadmin/users/:id/status
PATCH /api/superadmin/users/:id/roles
POST /api/superadmin/users/:id/force-logout
POST /api/superadmin/users/:id/unlock-profile
```

### Wallet Operations
```
POST /api/superadmin/wallet/credit
POST /api/superadmin/wallet/debit
POST /api/superadmin/wallet/freeze
POST /api/superadmin/wallet/unfreeze
GET /api/superadmin/wallet/ledger?user_id=
```

### Order Overrides
```
POST /api/superadmin/orders/:id/force-refund
POST /api/superadmin/orders/:id/force-complete
PATCH /api/superadmin/orders/:id/dispute-window
```

### Audit Logs
```
GET /api/superadmin/admin-actions
```
### Platform Config
```
GET /api/superadmin/config
PUT /api/superadmin/config
```

## Idempotency

For wallet operations, include an `Idempotency-Key` header to prevent duplicate requests:

```
POST /api/superadmin/wallet/credit
Headers:
  Authorization: Bearer <token>
  Idempotency-Key: unique-request-id-123
Body:
  {
    "user_id": "...",
    "amount_usd": 100,
    "reason": "Manual deposit adjustment"
  }
```

## Best Practices

1. **Always provide a reason** for admin actions - it helps with auditing
2. **Use idempotency keys** for wallet operations to prevent duplicates
3. **Check the audit log** before performing sensitive actions
4. **Verify user details** before making wallet adjustments
5. **Use filters** to find specific users or actions quickly

## Troubleshooting

**"Super admin access required"**: You're logged in as admin, not super_admin. Log out and use super@admin.com.

**"Invalid password"**: The step-up confirmation requires YOUR password (super admin password), not the target user's.

**"Please type 'CONFIRM DEBIT'"**: Large amounts require typing the exact confirmation phrase.

**Action not appearing in audit logs**: Refresh the page - logs are immutable once created.
