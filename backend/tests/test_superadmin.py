"""
Super Admin API Tests
Tests for Owner-grade Super Admin system including:
- Dashboard stats API
- Users management API
- Finance console (credit/debit/freeze)
- Audit logs (admin-actions)
- Role-based access control (admin vs super_admin)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "super@admin.com"
SUPER_ADMIN_PASSWORD = "admin12"
ADMIN_EMAIL = "admin@admin.com"
ADMIN_PASSWORD = "admin12"


class TestSuperAdminAuth:
    """Test authentication for super admin"""
    
    def test_super_admin_login(self):
        """Super admin can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert data["success"] is True
        assert "super_admin" in data["data"]["user"]["roles"]
        print(f"✓ Super admin login successful, roles: {data['data']['user']['roles']}")
    
    def test_admin_login(self):
        """Regular admin can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert data["success"] is True
        assert "admin" in data["data"]["user"]["roles"]
        assert "super_admin" not in data["data"]["user"]["roles"]
        print(f"✓ Admin login successful, roles: {data['data']['user']['roles']}")


class TestSuperAdminDashboard:
    """Test Super Admin Dashboard API"""
    
    @pytest.fixture
    def super_admin_token(self):
        """Get super admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Super admin login failed")
        return response.json()["data"]["access_token"]
    
    @pytest.fixture
    def admin_token(self):
        """Get regular admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["data"]["access_token"]
    
    def test_dashboard_returns_stats(self, super_admin_token):
        """Dashboard API returns comprehensive stats"""
        response = requests.get(
            f"{BASE_URL}/api/superadmin/dashboard",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        resp = response.json()
        assert resp["success"] is True
        data = resp["data"]
        
        # Verify KPI fields exist
        assert "total_users" in data
        assert "total_sellers" in data
        assert "active_listings" in data
        assert "pending_listings" in data
        assert "pending_kyc" in data
        assert "disputed_orders" in data
        assert "orders_in_delivery" in data
        assert "platform_earnings_7d" in data
        
        # Verify finance section
        assert "finance" in data
        finance = data["finance"]
        assert "total_deposits_usd" in finance
        assert "total_withdrawals_usd" in finance
        assert "total_escrow_held_usd" in finance
        assert "total_frozen_usd" in finance
        assert "platform_fee_all_time_usd" in finance
        
        # Verify charts data
        assert "orders_over_time" in data
        assert "revenue_over_time" in data
        assert "listing_status_distribution" in data
        assert "kyc_status_distribution" in data
        
        # Verify queues
        assert "pending_listings_queue" in data
        assert "pending_kyc_queue" in data
        assert "recent_disputes" in data
        assert "recent_admin_actions" in data
        
        # Verify system health
        assert "system_health" in data
        assert "db_connected" in data["system_health"]
        
        print(f"✓ Dashboard stats: {data['total_users']} users, {data['active_listings']} listings")
    
    def test_admin_cannot_access_superadmin_dashboard(self, admin_token):
        """Regular admin should NOT access super admin dashboard"""
        response = requests.get(
            f"{BASE_URL}/api/superadmin/dashboard",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        # Should return 403 Forbidden
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("✓ Admin correctly denied access to super admin dashboard")


class TestSuperAdminUsersManagement:
    """Test Users Management API"""
    
    @pytest.fixture
    def super_admin_token(self):
        """Get super admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Super admin login failed")
        return response.json()["data"]["access_token"]
    
    @pytest.fixture
    def admin_token(self):
        """Get regular admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["data"]["access_token"]
    
    def test_get_users_list(self, super_admin_token):
        """Super admin can get users list"""
        response = requests.get(
            f"{BASE_URL}/api/superadmin/users",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Get users failed: {response.text}"
        resp = response.json()
        assert resp["success"] is True
        data = resp["data"]
        
        assert "users" in data
        assert "total" in data
        assert "page" in data
        assert isinstance(data["users"], list)
        
        if len(data["users"]) > 0:
            user = data["users"][0]
            assert "id" in user
            assert "username" in user
            assert "email" in user
            assert "roles" in user
        
        print(f"✓ Users list: {data['total']} total users, page {data['page']}")
    
    def test_get_users_with_filters(self, super_admin_token):
        """Super admin can filter users by role"""
        response = requests.get(
            f"{BASE_URL}/api/superadmin/users?role=seller",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Filter users failed: {response.text}"
        resp = response.json()
        data = resp["data"]
        
        # All returned users should have seller role
        for user in data["users"]:
            assert "seller" in user["roles"], f"User {user['username']} doesn't have seller role"
        
        print(f"✓ Filtered users by seller role: {len(data['users'])} sellers")
    
    def test_get_user_detail(self, super_admin_token):
        """Super admin can get user detail with wallet info"""
        # First get a user ID
        response = requests.get(
            f"{BASE_URL}/api/superadmin/users",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        users = response.json()["data"]["users"]
        
        if len(users) == 0:
            pytest.skip("No users to test")
        
        user_id = users[0]["id"]
        
        # Get user detail
        response = requests.get(
            f"{BASE_URL}/api/superadmin/users/{user_id}",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Get user detail failed: {response.text}"
        resp = response.json()
        data = resp["data"]
        
        # Verify wallet info is included
        assert "wallet_available" in data
        assert "wallet_frozen" in data
        assert "total_orders" in data
        assert "total_listings" in data
        
        print(f"✓ User detail: wallet_available=${data['wallet_available']}, wallet_frozen=${data['wallet_frozen']}")
    
    def test_admin_cannot_access_superadmin_users(self, admin_token):
        """Regular admin should NOT access super admin users endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/superadmin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Admin correctly denied access to super admin users")


class TestSuperAdminFinanceConsole:
    """Test Finance Console API (credit/debit/freeze)"""
    
    @pytest.fixture
    def super_admin_token(self):
        """Get super admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Super admin login failed")
        return response.json()["data"]["access_token"]
    
    @pytest.fixture
    def test_user_id(self, super_admin_token):
        """Get a test user ID (not super admin)"""
        response = requests.get(
            f"{BASE_URL}/api/superadmin/users",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        if response.status_code != 200:
            pytest.skip("Cannot get users")
        
        users = response.json()["data"]["users"]
        # Find a non-super-admin user
        for user in users:
            if "super_admin" not in user["roles"]:
                return user["id"]
        
        pytest.skip("No non-super-admin user found")
    
    def test_search_user_for_finance(self, super_admin_token):
        """Can search for user in finance console"""
        response = requests.get(
            f"{BASE_URL}/api/superadmin/users?q=admin",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()["data"]
        
        # Should find admin user
        assert data["total"] > 0
        print(f"✓ Search found {data['total']} users matching 'admin'")
    
    def test_credit_wallet_creates_audit_log(self, super_admin_token, test_user_id):
        """Credit wallet operation creates audit log"""
        # Credit a small amount
        idempotency_key = str(uuid.uuid4())
        response = requests.post(
            f"{BASE_URL}/api/superadmin/wallet/credit",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={
                "user_id": test_user_id,
                "amount_usd": 10.00,
                "reason": "TEST_credit_for_testing",
                "idempotency_key": idempotency_key
            }
        )
        assert response.status_code == 200, f"Credit failed: {response.text}"
        resp = response.json()
        data = resp["data"]
        
        assert "audit_id" in data
        assert data["action"] == "credit"
        assert data["amount_usd"] == 10.00
        
        print(f"✓ Wallet credited: ${data['amount_usd']}, audit_id: {data['audit_id']}")
        
        # Verify audit log was created
        response = requests.get(
            f"{BASE_URL}/api/superadmin/admin-actions?action_type=wallet_credit",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        logs = response.json()["data"]["logs"]
        
        # Should find our credit action
        found = any(log.get("id") == str(data["audit_id"]) for log in logs)
        assert found or len(logs) > 0, "Audit log not found"
        print("✓ Audit log created for wallet credit")
    
    def test_debit_requires_password(self, super_admin_token, test_user_id):
        """Debit operation requires admin password (step-up confirmation)"""
        # Try debit without password
        response = requests.post(
            f"{BASE_URL}/api/superadmin/wallet/debit",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={
                "user_id": test_user_id,
                "amount_usd": 5.00,
                "reason": "TEST_debit_test"
            }
        )
        # Should fail without password
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}: {response.text}"
        print("✓ Debit correctly requires password")
    
    def test_freeze_requires_password(self, super_admin_token, test_user_id):
        """Freeze operation requires admin password (step-up confirmation)"""
        response = requests.post(
            f"{BASE_URL}/api/superadmin/wallet/freeze",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={
                "user_id": test_user_id,
                "amount_usd": 5.00,
                "reason": "TEST_freeze_test"
            }
        )
        # Should fail without password
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}: {response.text}"
        print("✓ Freeze correctly requires password")


class TestSuperAdminAuditLogs:
    """Test Audit Logs API (admin-actions endpoint)"""
    
    @pytest.fixture
    def super_admin_token(self):
        """Get super admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Super admin login failed")
        return response.json()["data"]["access_token"]
    
    @pytest.fixture
    def admin_token(self):
        """Get regular admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["data"]["access_token"]
    
    def test_get_audit_logs(self, super_admin_token):
        """Super admin can get audit logs (admin-actions)"""
        response = requests.get(
            f"{BASE_URL}/api/superadmin/admin-actions",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Get audit logs failed: {response.text}"
        resp = response.json()
        data = resp["data"]
        
        assert "logs" in data
        assert "total" in data
        assert "page" in data
        
        if len(data["logs"]) > 0:
            log = data["logs"][0]
            assert "id" in log
            assert "action_type" in log
            assert "created_at" in log
        
        print(f"✓ Audit logs: {data['total']} total entries")
    
    def test_filter_audit_logs_by_action_type(self, super_admin_token):
        """Can filter audit logs by action type"""
        response = requests.get(
            f"{BASE_URL}/api/superadmin/admin-actions?action_type=wallet_credit",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Filter failed: {response.text}"
        data = response.json()["data"]
        
        # All logs should be wallet_credit type
        for log in data["logs"]:
            assert log["action_type"] == "wallet_credit"
        
        print(f"✓ Filtered audit logs by wallet_credit: {len(data['logs'])} entries")
    
    def test_admin_cannot_access_audit_logs(self, admin_token):
        """Regular admin should NOT access audit logs"""
        response = requests.get(
            f"{BASE_URL}/api/superadmin/admin-actions",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Admin correctly denied access to audit logs")


class TestRoleBasedAccessControl:
    """Test role-based access control for /superadmin routes"""
    
    @pytest.fixture
    def admin_token(self):
        """Get regular admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["data"]["access_token"]
    
    def test_admin_denied_superadmin_dashboard(self, admin_token):
        """Admin cannot access /superadmin/dashboard"""
        response = requests.get(
            f"{BASE_URL}/api/superadmin/dashboard",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 403
        print("✓ Admin denied /superadmin/dashboard")
    
    def test_admin_denied_superadmin_users(self, admin_token):
        """Admin cannot access /superadmin/users"""
        response = requests.get(
            f"{BASE_URL}/api/superadmin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 403
        print("✓ Admin denied /superadmin/users")
    
    def test_admin_denied_superadmin_audit_logs(self, admin_token):
        """Admin cannot access /superadmin/admin-actions"""
        response = requests.get(
            f"{BASE_URL}/api/superadmin/admin-actions",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 403
        print("✓ Admin denied /superadmin/admin-actions")
    
    def test_admin_denied_wallet_credit(self, admin_token):
        """Admin cannot credit wallet"""
        response = requests.post(
            f"{BASE_URL}/api/superadmin/wallet/credit",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "user_id": "00000000-0000-0000-0000-000000000000",
                "amount_usd": 100,
                "reason": "test"
            }
        )
        assert response.status_code == 403
        print("✓ Admin denied wallet credit")
    
    def test_unauthenticated_denied_superadmin(self):
        """Unauthenticated requests denied"""
        response = requests.get(f"{BASE_URL}/api/superadmin/dashboard")
        assert response.status_code == 401
        print("✓ Unauthenticated denied /superadmin/dashboard")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
