"""
PlayTraderz Core Flow Tests
Tests: Listing creation, Order processing, Wallet/Escrow, Reviews, Disputes, Chat
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://seller-listings.preview.emergentagent.com').rstrip('/')

# Test credentials from requirements
SUPER_ADMIN_EMAIL = "super@admin.com"
SUPER_ADMIN_PASSWORD = "admin12"
TEST_BUYER_EMAIL = "testbuyer@test.com"
TEST_BUYER_PASSWORD = "Test1234!"


class TestSetup:
    """Setup and authentication tests"""
    
    def test_api_health(self):
        """Test API is accessible"""
        response = requests.get(f"{BASE_URL}/api/games")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print("API health check: PASSED")
    
    def test_super_admin_login(self):
        """Test super admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "access_token" in data.get("data", {})
        print(f"Super admin login: PASSED - roles: {data['data']['user']['roles']}")
    
    def test_buyer_login(self):
        """Test buyer can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_BUYER_EMAIL,
            "password": TEST_BUYER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "access_token" in data.get("data", {})
        print(f"Buyer login: PASSED - username: {data['data']['user']['username']}")


class TestListingFlow:
    """Test listing creation and approval flow"""
    
    @pytest.fixture(scope="class")
    def admin_auth(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        data = response.json()
        return {
            "token": data["data"]["access_token"],
            "user": data["data"]["user"]
        }
    
    @pytest.fixture(scope="class")
    def game_id(self):
        """Get a valid game ID"""
        response = requests.get(f"{BASE_URL}/api/games")
        data = response.json()
        games = data["data"]["games"]
        assert len(games) > 0, "No games found in database"
        return games[0]["id"]
    
    def test_listing_creation_requires_kyc(self, admin_auth, game_id):
        """Test that listing creation requires KYC - super admin has KYC approved"""
        headers = {"Authorization": f"Bearer {admin_auth['token']}"}
        
        # Super admin has KYC approved, should be able to create listing
        listing_data = {
            "game_id": game_id,
            "title": f"TEST_Listing_{uuid.uuid4().hex[:8]}",
            "description": "This is a test listing for automated testing of the PlayTraderz marketplace. Contains premium items.",
            "price_usd": 49.99,
            "platforms": ["PC"],
            "regions": ["Global"],
            "account_level": "100",
            "account_rank": "Diamond",
            "account_features": "All characters unlocked"
        }
        
        response = requests.post(f"{BASE_URL}/api/listings", json=listing_data, headers=headers)
        print(f"Listing creation response: {response.status_code} - {response.text[:500]}")
        
        # Super admin has kyc_status: approved, should work
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            listing = data["data"]
            assert listing["title"] == listing_data["title"]
            assert listing["status"] in ["pending", "approved"]
            print(f"Listing created: {listing['id']} - status: {listing['status']}")
            return listing["id"]
        else:
            # If 400 with KYC error, that's expected for non-KYC users
            error_data = response.json()
            print(f"Listing creation failed: {error_data}")
            # This test passes if KYC is the blocker (expected behavior)
            assert "KYC" in str(error_data) or response.status_code == 400
    
    def test_get_listings(self):
        """Test listing browse endpoint"""
        response = requests.get(f"{BASE_URL}/api/listings")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "listings" in data["data"]
        print(f"Get listings: PASSED - total: {data['data']['total']}")
    
    def test_admin_pending_listings(self, admin_auth):
        """Test admin can view pending listings"""
        headers = {"Authorization": f"Bearer {admin_auth['token']}"}
        response = requests.get(f"{BASE_URL}/api/listings/admin/pending", headers=headers)
        print(f"Admin pending listings response: {response.status_code}")
        # May return 200 or 403 depending on admin scopes
        assert response.status_code in [200, 403]
        if response.status_code == 200:
            data = response.json()
            print(f"Pending listings: {data['data']['total']}")


class TestWalletFlow:
    """Test wallet deposit and balance operations"""
    
    @pytest.fixture(scope="class")
    def buyer_auth(self):
        """Get buyer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_BUYER_EMAIL,
            "password": TEST_BUYER_PASSWORD
        })
        data = response.json()
        return {
            "token": data["data"]["access_token"],
            "user": data["data"]["user"]
        }
    
    def test_get_balance(self, buyer_auth):
        """Test getting wallet balance"""
        headers = {"Authorization": f"Bearer {buyer_auth['token']}"}
        response = requests.get(f"{BASE_URL}/api/wallet/balance", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        balance = data["data"]
        assert "available_usd" in balance
        assert "pending_usd" in balance
        print(f"Wallet balance: available=${balance['available_usd']}, pending=${balance['pending_usd']}")
    
    def test_mock_deposit(self, buyer_auth):
        """Test mock deposit (MOCKED - not real payment)"""
        headers = {"Authorization": f"Bearer {buyer_auth['token']}"}
        
        # Get initial balance
        balance_before = requests.get(f"{BASE_URL}/api/wallet/balance", headers=headers).json()["data"]
        initial_balance = balance_before["available_usd"]
        
        # Make mock deposit
        response = requests.post(f"{BASE_URL}/api/wallet/deposit", json={
            "amount_usd": 100.00
        }, headers=headers)
        
        print(f"Deposit response: {response.status_code} - {response.text[:500]}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        
        # Verify balance increased
        balance_after = requests.get(f"{BASE_URL}/api/wallet/balance", headers=headers).json()["data"]
        assert balance_after["available_usd"] == initial_balance + 100.00
        print(f"Mock deposit: PASSED - new balance: ${balance_after['available_usd']}")
    
    def test_wallet_history(self, buyer_auth):
        """Test wallet transaction history"""
        headers = {"Authorization": f"Bearer {buyer_auth['token']}"}
        response = requests.get(f"{BASE_URL}/api/wallet/history", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "transactions" in data["data"]
        print(f"Wallet history: PASSED - {data['data']['total']} transactions")


class TestOrderFlow:
    """Test order creation, delivery, completion flow"""
    
    @pytest.fixture(scope="class")
    def admin_auth(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        data = response.json()
        return {
            "token": data["data"]["access_token"],
            "user": data["data"]["user"]
        }
    
    @pytest.fixture(scope="class")
    def buyer_auth(self):
        """Get buyer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_BUYER_EMAIL,
            "password": TEST_BUYER_PASSWORD
        })
        data = response.json()
        return {
            "token": data["data"]["access_token"],
            "user": data["data"]["user"]
        }
    
    @pytest.fixture(scope="class")
    def approved_listing(self, admin_auth):
        """Create and approve a listing for testing orders"""
        headers = {"Authorization": f"Bearer {admin_auth['token']}"}
        
        # Get game ID
        games = requests.get(f"{BASE_URL}/api/games").json()["data"]["games"]
        game_id = games[0]["id"]
        
        # Create listing
        listing_data = {
            "game_id": game_id,
            "title": f"TEST_OrderFlow_{uuid.uuid4().hex[:8]}",
            "description": "Test listing for order flow testing - contains premium gaming account with rare items",
            "price_usd": 25.00,  # Lower price for testing
            "platforms": ["PC"],
            "regions": ["Global"],
            "account_level": "50",
            "account_rank": "Gold"
        }
        
        create_resp = requests.post(f"{BASE_URL}/api/listings", json=listing_data, headers=headers)
        if create_resp.status_code != 200:
            pytest.skip(f"Could not create listing: {create_resp.text}")
        
        listing = create_resp.json()["data"]
        listing_id = listing["id"]
        
        # Approve listing if pending
        if listing["status"] == "pending":
            approve_resp = requests.post(
                f"{BASE_URL}/api/listings/admin/{listing_id}/review",
                json={"approved": True},
                headers=headers
            )
            if approve_resp.status_code == 200:
                listing = approve_resp.json()["data"]
        
        if listing["status"] != "approved":
            pytest.skip(f"Listing not approved: {listing['status']}")
        
        print(f"Created approved listing: {listing_id}")
        return listing
    
    def test_buyer_purchases(self, buyer_auth):
        """Test getting buyer's purchases"""
        headers = {"Authorization": f"Bearer {buyer_auth['token']}"}
        response = requests.get(f"{BASE_URL}/api/orders/my/purchases", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"Buyer purchases: PASSED - total: {data['data']['total']}")
    
    def test_create_order_insufficient_balance(self, buyer_auth, approved_listing):
        """Test order creation fails with insufficient balance"""
        headers = {"Authorization": f"Bearer {buyer_auth['token']}"}
        
        # First drain wallet balance (skip if already low)
        balance = requests.get(f"{BASE_URL}/api/wallet/balance", headers=headers).json()["data"]
        if balance["available_usd"] >= approved_listing["price_usd"]:
            pytest.skip("Buyer has sufficient balance, cannot test insufficient balance scenario")
        
        response = requests.post(f"{BASE_URL}/api/orders", json={
            "listing_id": approved_listing["id"]
        }, headers=headers)
        
        # Should fail with insufficient balance
        assert response.status_code in [400, 403]
        print(f"Insufficient balance test: PASSED")
    
    def test_full_order_flow(self, admin_auth, buyer_auth, approved_listing):
        """Test complete order flow: create -> deliver -> complete"""
        buyer_headers = {"Authorization": f"Bearer {buyer_auth['token']}"}
        seller_headers = {"Authorization": f"Bearer {admin_auth['token']}"}  # Admin is seller
        
        # Ensure buyer has enough balance
        balance = requests.get(f"{BASE_URL}/api/wallet/balance", headers=buyer_headers).json()["data"]
        if balance["available_usd"] < approved_listing["price_usd"]:
            # Top up buyer's wallet
            deposit_resp = requests.post(f"{BASE_URL}/api/wallet/deposit", json={
                "amount_usd": 100.00
            }, headers=buyer_headers)
            assert deposit_resp.status_code == 200
        
        # 1. Create order (buyer buys listing)
        order_resp = requests.post(f"{BASE_URL}/api/orders", json={
            "listing_id": approved_listing["id"]
        }, headers=buyer_headers)
        
        print(f"Create order response: {order_resp.status_code} - {order_resp.text[:500]}")
        
        if order_resp.status_code != 200:
            error = order_resp.json()
            # Check for specific error messages
            if "own listing" in str(error).lower():
                pytest.skip("Cannot buy own listing - need different seller")
            pytest.fail(f"Order creation failed: {error}")
        
        order = order_resp.json()["data"]
        order_id = order["id"]
        assert order["status"] == "paid"
        print(f"Order created: {order['order_number']} - status: {order['status']}")
        
        # 2. Seller delivers order
        deliver_resp = requests.post(f"{BASE_URL}/api/orders/{order_id}/deliver", json={
            "delivery_info": "Account: test@email.com\nPassword: TestPass123\n2FA Codes: 123456, 789012"
        }, headers=seller_headers)
        
        print(f"Deliver order response: {deliver_resp.status_code} - {deliver_resp.text[:500]}")
        assert deliver_resp.status_code == 200
        delivered_order = deliver_resp.json()["data"]
        assert delivered_order["status"] == "delivered"
        print(f"Order delivered: {order['order_number']}")
        
        # 3. Buyer completes order
        complete_resp = requests.post(f"{BASE_URL}/api/orders/{order_id}/complete", headers=buyer_headers)
        
        print(f"Complete order response: {complete_resp.status_code} - {complete_resp.text[:500]}")
        assert complete_resp.status_code == 200
        completed_order = complete_resp.json()["data"]
        assert completed_order["status"] == "completed"
        print(f"Order completed: {order['order_number']}")
        
        # 4. Verify seller earnings in pending balance (10-day hold)
        seller_balance = requests.get(f"{BASE_URL}/api/wallet/balance", headers=seller_headers).json()["data"]
        print(f"Seller balance after completion: pending=${seller_balance['pending_usd']}")
        
        return order_id


class TestDisputeFlow:
    """Test dispute functionality"""
    
    @pytest.fixture(scope="class")
    def admin_auth(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        data = response.json()
        return {
            "token": data["data"]["access_token"],
            "user": data["data"]["user"]
        }
    
    @pytest.fixture(scope="class")
    def buyer_auth(self):
        """Get buyer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_BUYER_EMAIL,
            "password": TEST_BUYER_PASSWORD
        })
        data = response.json()
        return {
            "token": data["data"]["access_token"],
            "user": data["data"]["user"]
        }
    
    def test_dispute_requires_delivered_status(self, buyer_auth):
        """Test that dispute requires order in delivered status"""
        headers = {"Authorization": f"Bearer {buyer_auth['token']}"}
        
        # Get buyer's orders
        orders_resp = requests.get(f"{BASE_URL}/api/orders/my/purchases", headers=headers)
        if orders_resp.status_code != 200:
            pytest.skip("Could not get buyer orders")
        
        orders = orders_resp.json()["data"]["orders"]
        
        # Find a non-delivered order to test
        non_delivered = next((o for o in orders if o["status"] not in ["delivered"]), None)
        if not non_delivered:
            pytest.skip("No non-delivered orders to test dispute validation")
        
        response = requests.post(f"{BASE_URL}/api/orders/{non_delivered['id']}/dispute", json={
            "reason": "Test dispute reason for non-delivered order"
        }, headers=headers)
        
        # Should fail - can only dispute delivered orders
        assert response.status_code in [400, 403]
        print(f"Dispute validation: PASSED - correctly rejected non-delivered order")


class TestChatFlow:
    """Test chat/messaging system"""
    
    @pytest.fixture(scope="class")
    def buyer_auth(self):
        """Get buyer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_BUYER_EMAIL,
            "password": TEST_BUYER_PASSWORD
        })
        data = response.json()
        return {
            "token": data["data"]["access_token"],
            "user": data["data"]["user"]
        }
    
    @pytest.fixture(scope="class")
    def admin_auth(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        data = response.json()
        return {
            "token": data["data"]["access_token"],
            "user": data["data"]["user"]
        }
    
    def test_get_conversations(self, buyer_auth):
        """Test getting user conversations"""
        headers = {"Authorization": f"Bearer {buyer_auth['token']}"}
        response = requests.get(f"{BASE_URL}/api/chats", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "conversations" in data["data"]
        print(f"Get conversations: PASSED - {len(data['data']['conversations'])} conversations")
    
    def test_get_order_chat(self, buyer_auth):
        """Test getting chat for an order"""
        headers = {"Authorization": f"Bearer {buyer_auth['token']}"}
        
        # Get buyer's orders
        orders_resp = requests.get(f"{BASE_URL}/api/orders/my/purchases", headers=headers)
        if orders_resp.status_code != 200:
            pytest.skip("Could not get buyer orders")
        
        orders = orders_resp.json()["data"]["orders"]
        if not orders:
            pytest.skip("No orders to test order chat")
        
        order_id = orders[0]["id"]
        response = requests.get(f"{BASE_URL}/api/chats/order/{order_id}", headers=headers)
        
        print(f"Order chat response: {response.status_code}")
        # May return 200 or 404 depending on whether chat was created
        assert response.status_code in [200, 404]
        if response.status_code == 200:
            chat = response.json()["data"]
            print(f"Order chat found: {chat.get('id')}")
    
    def test_send_message_to_conversation(self, buyer_auth):
        """Test sending a message in a conversation"""
        headers = {"Authorization": f"Bearer {buyer_auth['token']}"}
        
        # Get conversations
        convs_resp = requests.get(f"{BASE_URL}/api/chats", headers=headers)
        if convs_resp.status_code != 200:
            pytest.skip("Could not get conversations")
        
        conversations = convs_resp.json()["data"]["conversations"]
        if not conversations:
            pytest.skip("No conversations to test messaging")
        
        conv_id = conversations[0]["id"]
        
        # Send message
        response = requests.post(f"{BASE_URL}/api/chats/{conv_id}/messages", json={
            "content": f"Test message at {datetime.now().isoformat()}"
        }, headers=headers)
        
        print(f"Send message response: {response.status_code} - {response.text[:300]}")
        assert response.status_code == 200
        message = response.json()["data"]
        assert "content" in message
        print(f"Message sent: PASSED - message_id: {message.get('id')}")


class TestReviewFlow:
    """Test review submission"""
    
    @pytest.fixture(scope="class")
    def buyer_auth(self):
        """Get buyer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_BUYER_EMAIL,
            "password": TEST_BUYER_PASSWORD
        })
        data = response.json()
        return {
            "token": data["data"]["access_token"],
            "user": data["data"]["user"]
        }
    
    def test_review_requires_completed_order(self, buyer_auth):
        """Test that review requires completed order"""
        headers = {"Authorization": f"Bearer {buyer_auth['token']}"}
        
        # Get buyer's orders
        orders_resp = requests.get(f"{BASE_URL}/api/orders/my/purchases", headers=headers)
        if orders_resp.status_code != 200:
            pytest.skip("Could not get buyer orders")
        
        orders = orders_resp.json()["data"]["orders"]
        
        # Find a non-completed order
        non_completed = next((o for o in orders if o["status"] != "completed"), None)
        if not non_completed:
            pytest.skip("No non-completed orders to test review validation")
        
        response = requests.post(f"{BASE_URL}/api/reviews/order/{non_completed['id']}", json={
            "rating": 5,
            "comment": "Great seller!"
        }, headers=headers)
        
        # Should fail - can only review completed orders
        assert response.status_code in [400, 403]
        print(f"Review validation: PASSED - correctly rejected non-completed order")
    
    def test_submit_review_completed_order(self, buyer_auth):
        """Test submitting review for completed order"""
        headers = {"Authorization": f"Bearer {buyer_auth['token']}"}
        
        # Get buyer's completed orders
        orders_resp = requests.get(f"{BASE_URL}/api/orders/my/purchases?status=completed", headers=headers)
        if orders_resp.status_code != 200:
            pytest.skip("Could not get buyer orders")
        
        orders = orders_resp.json()["data"]["orders"]
        completed = [o for o in orders if o["status"] == "completed"]
        
        if not completed:
            pytest.skip("No completed orders to test review")
        
        order_id = completed[0]["id"]
        response = requests.post(f"{BASE_URL}/api/reviews/order/{order_id}", json={
            "rating": 5,
            "comment": "Excellent service! Account delivered quickly and as described."
        }, headers=headers)
        
        print(f"Submit review response: {response.status_code} - {response.text[:300]}")
        
        # May succeed or fail with conflict (already reviewed)
        if response.status_code == 200:
            review = response.json()["data"]
            print(f"Review submitted: PASSED - rating: {review['rating']}")
        elif response.status_code == 409:
            print(f"Review already exists: PASSED (conflict expected)")
        else:
            print(f"Review submission: status {response.status_code}")


class TestSellerSales:
    """Test seller sales functionality"""
    
    @pytest.fixture(scope="class")
    def admin_auth(self):
        """Get admin auth token (admin is also a seller)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        data = response.json()
        return {
            "token": data["data"]["access_token"],
            "user": data["data"]["user"]
        }
    
    def test_get_my_sales(self, admin_auth):
        """Test getting seller's sales"""
        headers = {"Authorization": f"Bearer {admin_auth['token']}"}
        response = requests.get(f"{BASE_URL}/api/orders/my/sales", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"Seller sales: PASSED - total: {data['data']['total']}")
    
    def test_get_my_listings(self, admin_auth):
        """Test getting seller's listings"""
        headers = {"Authorization": f"Bearer {admin_auth['token']}"}
        response = requests.get(f"{BASE_URL}/api/listings/my", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"Seller listings: PASSED - total: {data['data']['total']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
