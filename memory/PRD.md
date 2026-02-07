# PlayTraderz - Game Account Marketplace

## Original Problem Statement
Build a comprehensive game account marketplace platform where sellers can list game accounts for sale and buyers can securely purchase them with escrow protection.

## Current Session Updates (Feb 7, 2026)

### Chat System Overhaul - COMPLETED ✅
Implemented a comprehensive chat system with:

1. **Three Chat Sections for Users:**
   - **Casual** - Direct messages between users
   - **Orders** - Order-specific conversations
   - **Support** - User-to-admin support requests

2. **Admin Features:**
   - **Request Chats** tab showing pending support requests
   - Admin can accept support requests
   - Multiple admins can join a support chat
   - Admin sees user's full name and username

3. **Support Chat Flow:**
   - User creates support request with subject and message
   - Request appears in all admin's "Pending Requests"
   - Admin accepts → Chat becomes active
   - Other admins can also join
   - User sees "Admin" as sender name (privacy)
   - File uploads allowed (any file type, no size limit)
   - Chat can be closed by either party

4. **Header Notifications:**
   - Chat icon with unread count badge
   - Blinking/pulsing effect for new messages
   - Sound notification capability

### Bug Fixes
- Fixed game loading on Create Listing page ✅
- Fixed SQLAlchemy lazy-loading issues in chat messages ✅
- Fixed message serialization for sender relationship ✅

## Database Schema Updates

### Conversations Table (Updated)
```sql
- support_status (enum: pending, active, closed)
- support_subject (varchar 255)
- requester_id (UUID, FK to users)
- accepted_by_id (UUID, FK to users)
- accepted_at (timestamp)
- closed_at (timestamp)
- closed_by_id (UUID, FK to users)
```

### Users Table (Updated)
```sql
- telegram_username (varchar 100)
- telegram_chat_id (varchar 50)
- telegram_notifications_enabled (boolean)
```

## API Endpoints

### Chat Endpoints
- `GET /api/chats?conversation_type={type}` - Get filtered conversations
- `GET /api/chats/unread-count` - Get total unread messages
- `POST /api/chats/support` - Create support request
- `GET /api/chats/support/requests` - Get pending requests (admin)
- `POST /api/chats/support/{id}/accept` - Accept support request
- `POST /api/chats/support/{id}/close` - Close support chat
- `GET /api/chats/{id}/messages` - Get messages
- `POST /api/chats/{id}/messages` - Send message
- `POST /api/upload/chat` - Upload file attachment

## Test Credentials
- **Superadmin:** super@admin.com / admin12
- **Test Seller:** testseller1@example.com / TestSeller123!

## Remaining/Backlog Tasks

### P0 - High Priority
- [ ] Create 2 listings for test_seller_2 account

### P1 - Medium Priority  
- [ ] Complete Telegram notification integration
- [ ] User settings page for Telegram username

### P2 - Low Priority
- [ ] Buyer-to-admin direct chat initiation
- [ ] Rename SendGrid env vars to Brevo

## Architecture
```
/app
├── backend/
│   ├── app/
│   │   ├── api/routes/ (FastAPI routers)
│   │   ├── core/ (Configuration)
│   │   ├── models/ (SQLAlchemy models)
│   │   ├── schemas/ (Pydantic schemas)
│   │   └── services/ (Business logic)
│   └── tests/ (Pytest tests)
└── frontend/
    └── src/
        ├── components/ (React components)
        ├── pages/ (Page components)
        ├── lib/ (API utilities)
        └── store/ (Zustand stores)
```

## Third-Party Integrations
- **Brevo (Sendinblue)** - Email notifications
- **Telegram Bot API** - Chat notifications (partially implemented)
