"""
Test suite for Admin Panel and Seller Management features
Tests: Admin dashboard, pending listings, pending KYC, disputes, seller routes
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@admin.com"
ADMIN_PASSWORD = "admin12"
SUPER_ADMIN_EMAIL = "super@admin.com"
SUPER_ADMIN_PASSWORD = "admin12"


class TestAdminAuthentication:
    """Test admin login and authentication"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        assert "access_token" in data["data"]
        assert "user" in data["data"]
        user = data["data"]["user"]
        assert "admin" in user.get("roles", []) or "super_admin" in user.get("roles", [])
        print(f"Admin login successful - roles: {user.get('roles')}")
    
    def test_super_admin_login_success(self):
        """Test super admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Super admin login failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        user = data["data"]["user"]
        assert "super_admin" in user.get("roles", [])
        print(f"Super admin login successful - roles: {user.get('roles')}")
    
    def test_admin_login_invalid_credentials(self):
        """Test admin login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Invalid credentials correctly rejected")


class TestAdminDashboard:
    """Test admin dashboard endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["data"]["access_token"]
    
    def test_dashboard_requires_auth(self):
        """Test dashboard endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/dashboard")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Dashboard correctly requires authentication")
    
    def test_dashboard_returns_stats(self, admin_token):
        """Test dashboard returns pending counts"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=headers)
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        dashboard = data["data"]
        
        # Verify all expected fields are present
        assert "pending_listings" in dashboard
        assert "pending_kyc" in dashboard
        assert "disputed_orders" in dashboard
        assert "active_orders" in dashboard
        
        # Verify values are integers
        assert isinstance(dashboard["pending_listings"], int)
        assert isinstance(dashboard["pending_kyc"], int)
        assert isinstance(dashboard["disputed_orders"], int)
        assert isinstance(dashboard["active_orders"], int)
        
        print(f"Dashboard stats: pending_listings={dashboard['pending_listings']}, "
              f"pending_kyc={dashboard['pending_kyc']}, disputed_orders={dashboard['disputed_orders']}, "
              f"active_orders={dashboard['active_orders']}")


class TestAdminPendingListings:
    """Test admin pending listings endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["data"]["access_token"]
    
    def test_pending_listings_requires_auth(self):
        """Test pending listings endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/listings/admin/pending")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Pending listings correctly requires authentication")
    
    def test_pending_listings_returns_data(self, admin_token):
        """Test pending listings returns paginated data"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/listings/admin/pending", headers=headers)
        assert response.status_code == 200, f"Pending listings failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        result = data["data"]
        
        # Verify pagination fields
        assert "listings" in result
        assert "total" in result
        assert "page" in result
        assert "total_pages" in result
        
        assert isinstance(result["listings"], list)
        print(f"Pending listings: {result['total']} total, page {result['page']} of {result['total_pages']}")


class TestAdminPendingKYC:
    """Test admin pending KYC endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["data"]["access_token"]
    
    def test_pending_kyc_requires_auth(self):
        """Test pending KYC endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/kyc/admin/pending")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Pending KYC correctly requires authentication")
    
    def test_pending_kyc_returns_data(self, admin_token):
        """Test pending KYC returns paginated data"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/kyc/admin/pending", headers=headers)
        assert response.status_code == 200, f"Pending KYC failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        result = data["data"]
        
        # Verify pagination fields
        assert "submissions" in result
        assert "total" in result
        assert "page" in result
        
        assert isinstance(result["submissions"], list)
        print(f"Pending KYC: {result['total']} total, page {result['page']}")


class TestAdminDisputes:
    """Test admin disputes endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["data"]["access_token"]
    
    def test_disputes_requires_auth(self):
        """Test disputes endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/disputes")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Disputes correctly requires authentication")
    
    def test_disputes_returns_data(self, admin_token):
        """Test disputes returns paginated data"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/disputes", headers=headers)
        assert response.status_code == 200, f"Disputes failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        result = data["data"]
        
        # Verify pagination fields
        assert "orders" in result
        assert "total" in result
        assert "page" in result
        assert "total_pages" in result
        
        assert isinstance(result["orders"], list)
        print(f"Disputes: {result['total']} total, page {result['page']} of {result['total_pages']}")


class TestSellerRoutes:
    """Test seller-specific routes"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token (admin has seller role too)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["data"]["access_token"]
    
    def test_my_listings_requires_auth(self):
        """Test my listings endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/listings/my")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("My listings correctly requires authentication")
    
    def test_my_listings_requires_seller_role(self, admin_token):
        """Test my listings endpoint with admin token (may or may not have seller role)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/listings/my", headers=headers)
        # Admin may or may not have seller role - check for 200 or 403
        assert response.status_code in [200, 403], f"Unexpected status: {response.status_code}"
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            print("My listings accessible with admin token")
        else:
            print("My listings requires seller role (admin doesn't have it)")


class TestRoleBasedAccess:
    """Test role-based access control"""
    
    def test_regular_user_cannot_access_admin_dashboard(self):
        """Test that regular users cannot access admin endpoints"""
        # First register a regular user
        import uuid
        test_email = f"test_user_{uuid.uuid4().hex[:8]}@test.com"
        
        # Register
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "testpass123",
            "username": f"testuser_{uuid.uuid4().hex[:6]}"
        })
        
        if register_response.status_code != 200:
            pytest.skip("Could not register test user")
        
        token = register_response.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Try to access admin dashboard
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("Regular user correctly denied access to admin dashboard")
    
    def test_regular_user_cannot_access_pending_listings(self):
        """Test that regular users cannot access admin pending listings"""
        import uuid
        test_email = f"test_user_{uuid.uuid4().hex[:8]}@test.com"
        
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "testpass123",
            "username": f"testuser_{uuid.uuid4().hex[:6]}"
        })
        
        if register_response.status_code != 200:
            pytest.skip("Could not register test user")
        
        token = register_response.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/listings/admin/pending", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("Regular user correctly denied access to pending listings")


class TestGamesAPI:
    """Test games API for listing creation"""
    
    def test_games_list(self):
        """Test games list endpoint"""
        response = requests.get(f"{BASE_URL}/api/games")
        assert response.status_code == 200, f"Games list failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "games" in data["data"]
        games = data["data"]["games"]
        assert isinstance(games, list)
        print(f"Games available: {len(games)}")
        if games:
            print(f"Sample game: {games[0].get('name')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
