"""
Test Super Admin New Modules - Iteration 4
Tests: Gift Cards, Orders, Withdrawals, Admin Scopes, System Health
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "super@admin.com"
SUPER_ADMIN_PASSWORD = "admin12"


class TestSuperAdminAuth:
    """Authentication tests for super admin"""
    
    @pytest.fixture(scope="class")
    def super_admin_token(self):
        """Get super admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert data.get("success"), f"Login not successful: {data}"
        token = data.get("data", {}).get("access_token")
        assert token, "No access token returned"
        return token
    
    def test_super_admin_login(self, super_admin_token):
        """Verify super admin can login"""
        assert super_admin_token is not None
        print(f"✓ Super admin login successful")


class TestGiftCardManagement:
    """Gift Card Management API tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers for super admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        token = response.json().get("data", {}).get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_generate_gift_cards(self, auth_headers):
        """Test generating gift cards with 16-digit codes"""
        response = requests.post(
            f"{BASE_URL}/api/superadmin/giftcards/generate",
            json={"count": 2, "value_usd": 25.00},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to generate gift cards: {response.text}"
        data = response.json()
        assert data.get("success"), f"Gift card generation not successful: {data}"
        
        cards = data.get("data", {}).get("cards", [])
        assert len(cards) == 2, f"Expected 2 cards, got {len(cards)}"
        
        # Verify 16-digit numeric codes
        for card in cards:
            code = card.get("code", "")
            assert len(code) == 16, f"Code should be 16 digits, got {len(code)}: {code}"
            assert code.isdigit(), f"Code should be numeric: {code}"
            assert card.get("value_usd") == 25.00, f"Value mismatch: {card.get('value_usd')}"
            assert card.get("status") == "active", f"Status should be active: {card.get('status')}"
        
        print(f"✓ Generated {len(cards)} gift cards with 16-digit codes")
        return cards
    
    def test_list_gift_cards(self, auth_headers):
        """Test listing gift cards with filters"""
        # List all
        response = requests.get(
            f"{BASE_URL}/api/superadmin/giftcards",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to list gift cards: {response.text}"
        data = response.json()
        assert data.get("success"), f"List not successful: {data}"
        
        cards = data.get("data", {}).get("cards", [])
        total = data.get("data", {}).get("total", 0)
        print(f"✓ Listed {len(cards)} gift cards (total: {total})")
        
        # Filter by status
        response = requests.get(
            f"{BASE_URL}/api/superadmin/giftcards?status=active",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to filter gift cards: {response.text}"
        print(f"✓ Filter by status=active works")
        
        return cards
    
    def test_search_gift_card_by_code(self, auth_headers):
        """Test searching gift card by code"""
        # First generate a card
        gen_response = requests.post(
            f"{BASE_URL}/api/superadmin/giftcards/generate",
            json={"count": 1, "value_usd": 10.00},
            headers=auth_headers
        )
        card = gen_response.json().get("data", {}).get("cards", [{}])[0]
        code = card.get("code", "")
        
        # Search by partial code
        response = requests.get(
            f"{BASE_URL}/api/superadmin/giftcards?code={code[:8]}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to search gift cards: {response.text}"
        data = response.json()
        cards = data.get("data", {}).get("cards", [])
        
        # Should find the card
        found = any(c.get("code") == code for c in cards)
        assert found, f"Card with code {code} not found in search results"
        print(f"✓ Search by code works")
    
    def test_deactivate_gift_card(self, auth_headers):
        """Test deactivating a gift card with reason"""
        # First generate a card
        gen_response = requests.post(
            f"{BASE_URL}/api/superadmin/giftcards/generate",
            json={"count": 1, "value_usd": 5.00},
            headers=auth_headers
        )
        card = gen_response.json().get("data", {}).get("cards", [{}])[0]
        card_id = card.get("id")
        
        # Deactivate with reason
        response = requests.post(
            f"{BASE_URL}/api/superadmin/giftcards/{card_id}/deactivate",
            json={"reason": "Test deactivation - card no longer needed"},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to deactivate gift card: {response.text}"
        data = response.json()
        assert data.get("success"), f"Deactivation not successful: {data}"
        
        result = data.get("data", {})
        assert result.get("status") == "deactivated", f"Status should be deactivated: {result.get('status')}"
        print(f"✓ Gift card deactivated with reason")
    
    def test_deactivate_requires_reason(self, auth_headers):
        """Test that deactivation requires a reason"""
        # First generate a card
        gen_response = requests.post(
            f"{BASE_URL}/api/superadmin/giftcards/generate",
            json={"count": 1, "value_usd": 5.00},
            headers=auth_headers
        )
        card = gen_response.json().get("data", {}).get("cards", [{}])[0]
        card_id = card.get("id")
        
        # Try to deactivate without reason (should fail validation)
        response = requests.post(
            f"{BASE_URL}/api/superadmin/giftcards/{card_id}/deactivate",
            json={"reason": ""},  # Empty reason
            headers=auth_headers
        )
        # Should fail with 422 validation error
        assert response.status_code in [400, 422], f"Should require reason: {response.status_code}"
        print(f"✓ Deactivation requires reason (validation works)")


class TestAllOrdersView:
    """All Orders View API tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers for super admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        token = response.json().get("data", {}).get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_all_orders(self, auth_headers):
        """Test getting all orders"""
        response = requests.get(
            f"{BASE_URL}/api/superadmin/orders",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get orders: {response.text}"
        data = response.json()
        assert data.get("success"), f"Get orders not successful: {data}"
        
        orders = data.get("data", {}).get("orders", [])
        total = data.get("data", {}).get("total", 0)
        print(f"✓ Got {len(orders)} orders (total: {total})")
        
        # Verify order structure if orders exist
        if orders:
            order = orders[0]
            assert "id" in order, "Order should have id"
            assert "order_number" in order, "Order should have order_number"
            assert "status" in order, "Order should have status"
            print(f"✓ Order structure verified")
    
    def test_filter_orders_by_status(self, auth_headers):
        """Test filtering orders by status"""
        statuses = ["pending", "paid", "delivered", "completed", "disputed"]
        
        for status in statuses:
            response = requests.get(
                f"{BASE_URL}/api/superadmin/orders?status={status}",
                headers=auth_headers
            )
            assert response.status_code == 200, f"Failed to filter by {status}: {response.text}"
        
        print(f"✓ Order status filter works for all statuses")
    
    def test_search_orders(self, auth_headers):
        """Test searching orders by query"""
        response = requests.get(
            f"{BASE_URL}/api/superadmin/orders?q=test",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to search orders: {response.text}"
        print(f"✓ Order search works")
    
    def test_orders_pagination(self, auth_headers):
        """Test orders pagination"""
        response = requests.get(
            f"{BASE_URL}/api/superadmin/orders?page=1&page_size=10",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed pagination: {response.text}"
        data = response.json()
        
        assert "page" in data.get("data", {}), "Response should include page"
        assert "page_size" in data.get("data", {}), "Response should include page_size"
        print(f"✓ Orders pagination works")


class TestWithdrawalsManagement:
    """Withdrawals Management API tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers for super admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        token = response.json().get("data", {}).get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_withdrawals(self, auth_headers):
        """Test getting withdrawal requests"""
        response = requests.get(
            f"{BASE_URL}/api/superadmin/withdrawals",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get withdrawals: {response.text}"
        data = response.json()
        assert data.get("success"), f"Get withdrawals not successful: {data}"
        
        requests_list = data.get("data", {}).get("requests", [])
        total = data.get("data", {}).get("total", 0)
        print(f"✓ Got {len(requests_list)} withdrawal requests (total: {total})")
    
    def test_filter_withdrawals_by_status(self, auth_headers):
        """Test filtering withdrawals by status"""
        statuses = ["pending", "approved", "rejected", "cancelled"]
        
        for status in statuses:
            response = requests.get(
                f"{BASE_URL}/api/superadmin/withdrawals?status={status}",
                headers=auth_headers
            )
            assert response.status_code == 200, f"Failed to filter by {status}: {response.text}"
        
        print(f"✓ Withdrawal status filter works")
    
    def test_withdrawals_pagination(self, auth_headers):
        """Test withdrawals pagination"""
        response = requests.get(
            f"{BASE_URL}/api/superadmin/withdrawals?page=1&page_size=20",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed pagination: {response.text}"
        data = response.json()
        
        assert "page" in data.get("data", {}), "Response should include page"
        print(f"✓ Withdrawals pagination works")


class TestAdminScopes:
    """Admin Permission Scopes API tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers for super admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        token = response.json().get("data", {}).get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_admins_list(self, auth_headers):
        """Test getting list of admins"""
        response = requests.get(
            f"{BASE_URL}/api/superadmin/admins",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get admins: {response.text}"
        data = response.json()
        assert data.get("success"), f"Get admins not successful: {data}"
        
        admins = data.get("data", {}).get("admins", [])
        print(f"✓ Got {len(admins)} admin users")
        return admins
    
    def test_get_admin_scopes(self, auth_headers):
        """Test getting admin scopes"""
        # First get list of admins
        admins_response = requests.get(
            f"{BASE_URL}/api/superadmin/admins",
            headers=auth_headers
        )
        admins = admins_response.json().get("data", {}).get("admins", [])
        
        # Find a non-super-admin
        admin = None
        for a in admins:
            if "admin" in a.get("roles", []) and "super_admin" not in a.get("roles", []):
                admin = a
                break
        
        if admin:
            response = requests.get(
                f"{BASE_URL}/api/superadmin/admins/{admin['id']}/scopes",
                headers=auth_headers
            )
            assert response.status_code == 200, f"Failed to get admin scopes: {response.text}"
            data = response.json()
            assert data.get("success"), f"Get scopes not successful: {data}"
            
            result = data.get("data", {})
            assert "admin_permissions" in result, "Response should include admin_permissions"
            print(f"✓ Got admin scopes for {admin.get('username')}")
        else:
            print(f"⚠ No non-super-admin found to test scopes")
    
    def test_update_admin_scopes(self, auth_headers):
        """Test updating admin scopes"""
        # First get list of admins
        admins_response = requests.get(
            f"{BASE_URL}/api/superadmin/admins",
            headers=auth_headers
        )
        admins = admins_response.json().get("data", {}).get("admins", [])
        
        # Find a non-super-admin
        admin = None
        for a in admins:
            if "admin" in a.get("roles", []) and "super_admin" not in a.get("roles", []):
                admin = a
                break
        
        if admin:
            response = requests.put(
                f"{BASE_URL}/api/superadmin/admins/{admin['id']}/scopes",
                json={
                    "scopes": ["LISTINGS_REVIEW", "KYC_REVIEW"],
                    "admin_password": SUPER_ADMIN_PASSWORD
                },
                headers=auth_headers
            )
            assert response.status_code == 200, f"Failed to update admin scopes: {response.text}"
            data = response.json()
            assert data.get("success"), f"Update scopes not successful: {data}"
            print(f"✓ Updated admin scopes for {admin.get('username')}")
        else:
            print(f"⚠ No non-super-admin found to test scope update")


class TestSystemHealth:
    """System Health API tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers for super admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        token = response.json().get("data", {}).get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_system_health(self, auth_headers):
        """Test getting system health status"""
        response = requests.get(
            f"{BASE_URL}/api/superadmin/system-health",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get system health: {response.text}"
        data = response.json()
        assert data.get("success"), f"Get system health not successful: {data}"
        
        health = data.get("data", {})
        print(f"✓ System health retrieved: {health}")


class TestDashboardNavigation:
    """Test dashboard has navigation to new pages"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers for super admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        token = response.json().get("data", {}).get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_dashboard_stats(self, auth_headers):
        """Test dashboard returns comprehensive stats"""
        response = requests.get(
            f"{BASE_URL}/api/superadmin/dashboard",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get dashboard: {response.text}"
        data = response.json()
        assert data.get("success"), f"Get dashboard not successful: {data}"
        
        stats = data.get("data", {})
        print(f"✓ Dashboard stats retrieved")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
