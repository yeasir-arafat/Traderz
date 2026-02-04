"""
Test new features: Notifications, Seller Profile, Password Recovery
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestNotifications:
    """Test notifications API endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Login as test buyer and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "testbuyer@test.com",
            "password": "Test1234!"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        return data.get("data", {}).get("access_token")
    
    def test_get_notifications_requires_auth(self):
        """Verify notifications endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 401 or response.status_code == 403, \
            f"Expected 401/403, got {response.status_code}"
        print("SUCCESS: GET /api/notifications requires auth")
    
    def test_get_notifications_success(self, auth_token):
        """Get user notifications successfully"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/notifications", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Data assertions
        assert "data" in data or "notifications" in data or "status" in data
        
        result = data.get("data", data)
        assert "notifications" in result, "Response should contain 'notifications' field"
        assert "unread_count" in result, "Response should contain 'unread_count' field"
        assert isinstance(result["notifications"], list), "notifications should be a list"
        assert isinstance(result["unread_count"], int), "unread_count should be an integer"
        
        print(f"SUCCESS: Got {len(result['notifications'])} notifications, {result['unread_count']} unread")
    
    def test_get_notifications_with_limit(self, auth_token):
        """Test notifications pagination with limit"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/notifications?limit=5", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        result = data.get("data", data)
        
        # Should return max 5 notifications
        assert len(result.get("notifications", [])) <= 5, "Should respect limit parameter"
        print("SUCCESS: Notifications limit parameter works")
    
    def test_mark_all_read(self, auth_token):
        """Test mark all notifications as read"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/notifications/read-all", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        result = data.get("data", data)
        
        assert "marked_count" in result, "Response should contain marked_count"
        print(f"SUCCESS: Marked {result.get('marked_count', 0)} notifications as read")


class TestSellerPublicProfile:
    """Test seller public profile endpoint by username"""
    
    def test_get_seller_profile_superadmin(self):
        """Get seller profile for superadmin"""
        response = requests.get(f"{BASE_URL}/api/users/seller/superadmin")
        
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        result = data.get("data", data)
        
        # Data assertions
        assert "username" in result, "Should have username"
        assert result["username"] == "superadmin", f"Expected 'superadmin', got '{result.get('username')}'"
        assert "seller_level" in result, "Should have seller_level"
        assert "seller_rating" in result, "Should have seller_rating"
        assert "total_reviews" in result, "Should have total_reviews"
        assert "member_since" in result, "Should have member_since"
        assert "listings" in result, "Should have listings array"
        assert "reviews" in result, "Should have reviews array"
        
        # Verify listings structure if there are any
        if result.get("listings"):
            listing = result["listings"][0]
            assert "id" in listing, "Listing should have id"
            assert "title" in listing, "Listing should have title"
            assert "price_usd" in listing, "Listing should have price_usd"
        
        # Verify reviews structure if there are any
        if result.get("reviews"):
            review = result["reviews"][0]
            assert "id" in review, "Review should have id"
            assert "rating" in review, "Review should have rating"
            
        print(f"SUCCESS: Got seller profile for superadmin - Level: {result.get('seller_level')}, Rating: {result.get('seller_rating')}")
    
    def test_seller_profile_not_found(self):
        """Test 404 for non-existent seller"""
        response = requests.get(f"{BASE_URL}/api/users/seller/nonexistentuser12345")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("SUCCESS: Returns 404 for non-existent seller")
    
    def test_seller_profile_requires_seller_role(self):
        """Test that regular buyer cannot have seller profile accessed"""
        # testbuyer is a buyer, not a seller
        response = requests.get(f"{BASE_URL}/api/users/seller/testbuyer")
        
        # Should return 404 because testbuyer is not a seller
        assert response.status_code == 404, f"Expected 404 for non-seller, got {response.status_code}"
        print("SUCCESS: Returns 404 for users without seller role")


class TestPasswordRecovery:
    """Test password forgot and reset functionality"""
    
    def test_forgot_password_endpoint_exists(self):
        """Test that forgot password endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/auth/password/forgot", json={
            "email": "test@example.com"
        })
        
        # Should return 200 even for non-existent emails (prevent enumeration)
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        print("SUCCESS: POST /api/auth/password/forgot returns 200")
    
    def test_forgot_password_existing_user(self):
        """Test forgot password for existing user (triggers email)"""
        response = requests.post(f"{BASE_URL}/api/auth/password/forgot", json={
            "email": "super@admin.com"
        })
        
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert "data" in data or "message" in data
        print("SUCCESS: Password reset requested for super@admin.com")
    
    def test_forgot_password_nonexistent_user(self):
        """Test forgot password for non-existent user (no enumeration)"""
        response = requests.post(f"{BASE_URL}/api/auth/password/forgot", json={
            "email": "nonexistent_user_12345@test.com"
        })
        
        # Should return 200 to prevent email enumeration
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("SUCCESS: Returns 200 even for non-existent email (no enumeration)")
    
    def test_reset_password_invalid_token(self):
        """Test password reset with invalid token"""
        response = requests.post(f"{BASE_URL}/api/auth/password/reset", json={
            "token": "invalid_token_12345",
            "new_password": "NewSecure123!"
        })
        
        # Should fail with 400 or similar for invalid token
        assert response.status_code in [400, 401, 422], \
            f"Expected 400/401/422 for invalid token, got {response.status_code}"
        print("SUCCESS: Password reset with invalid token rejected")
    
    def test_reset_password_weak_password(self):
        """Test password reset with weak password"""
        response = requests.post(f"{BASE_URL}/api/auth/password/reset", json={
            "token": "some_token",
            "new_password": "weak"  # Too short, no special chars
        })
        
        # Should fail validation
        assert response.status_code in [400, 422], \
            f"Expected 400/422 for weak password, got {response.status_code}"
        print("SUCCESS: Weak password rejected in reset")


class TestUserMeEndpoint:
    """Verify /api/users/me endpoint works"""
    
    def test_get_me_requires_auth(self):
        """Test that /api/users/me requires authentication"""
        response = requests.get(f"{BASE_URL}/api/users/me")
        assert response.status_code in [401, 403]
        print("SUCCESS: GET /api/users/me requires auth")
    
    def test_get_me_success(self):
        """Test getting current user profile"""
        # Login first
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "testbuyer@test.com",
            "password": "Test1234!"
        })
        assert login_resp.status_code == 200
        token = login_resp.json().get("data", {}).get("access_token")
        
        # Get profile
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/users/me", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        result = data.get("data", data)
        
        assert "email" in result
        assert "username" in result
        print(f"SUCCESS: Got profile for user {result.get('username')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
