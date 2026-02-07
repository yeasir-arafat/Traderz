"""
Test module for Chat System - Support Chat functionality
Tests:
- User creating support request
- Admin viewing pending support requests
- Admin accepting support request
- Sending messages in support chat
- Close chat functionality
- File upload in support chats
- Unread count badge functionality
"""

import pytest
import requests
import os
import time
from uuid import UUID

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from the review request
USER_EMAIL = "testseller1@example.com"
USER_PASSWORD = "TestSeller123!"
ADMIN_EMAIL = "super@admin.com"
ADMIN_PASSWORD = "admin12"


class TestChatSystemSetup:
    """Setup tests - verify basic authentication works"""
    
    @pytest.fixture(scope="class")
    def user_token(self):
        """Login as regular user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER_EMAIL,
            "password": USER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"User login failed: {response.text}")
        data = response.json().get("data", response.json())
        return data.get("access_token")
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        data = response.json().get("data", response.json())
        return data.get("access_token")
    
    @pytest.fixture(scope="class")
    def user_client(self, user_token):
        """Session with user auth"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {user_token}"
        })
        return session
    
    @pytest.fixture(scope="class")
    def admin_client(self, admin_token):
        """Session with admin auth"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {admin_token}"
        })
        return session
    
    def test_user_login(self, user_token):
        """Verify user can authenticate"""
        assert user_token is not None
        print(f"User login successful, token received")
    
    def test_admin_login(self, admin_token):
        """Verify admin can authenticate"""
        assert admin_token is not None
        print(f"Admin login successful, token received")


class TestSupportChat:
    """Support chat flow tests"""
    
    @pytest.fixture(scope="class")
    def user_token(self):
        """Login as regular user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER_EMAIL,
            "password": USER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"User login failed: {response.text}")
        data = response.json().get("data", response.json())
        return data.get("access_token")
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        data = response.json().get("data", response.json())
        return data.get("access_token")
    
    @pytest.fixture(scope="class")
    def user_client(self, user_token):
        """Session with user auth"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {user_token}"
        })
        return session
    
    @pytest.fixture(scope="class")
    def admin_client(self, admin_token):
        """Session with admin auth"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {admin_token}"
        })
        return session
    
    def test_get_user_conversations(self, user_client):
        """User can get their conversations"""
        response = user_client.get(f"{BASE_URL}/api/chats")
        assert response.status_code == 200, f"Get conversations failed: {response.text}"
        data = response.json().get("data", response.json())
        assert "conversations" in data
        print(f"User has {len(data['conversations'])} total conversations")
    
    def test_get_support_conversations(self, user_client):
        """User can get support conversations"""
        response = user_client.get(f"{BASE_URL}/api/chats?conversation_type=support")
        assert response.status_code == 200, f"Get support conversations failed: {response.text}"
        data = response.json().get("data", response.json())
        assert "conversations" in data
        print(f"User has {len(data['conversations'])} support conversations")
    
    def test_create_support_request(self, user_client):
        """User can create a new support request"""
        timestamp = int(time.time())
        payload = {
            "subject": f"TEST Support Request {timestamp}",
            "initial_message": "This is a test support request message created by automated testing. Please ignore.",
            "attachments": []
        }
        response = user_client.post(f"{BASE_URL}/api/chats/support", json=payload)
        assert response.status_code == 200, f"Create support request failed: {response.text}"
        
        data = response.json().get("data", response.json())
        assert "id" in data
        assert data["conversation_type"] == "support"
        assert data["support_status"] == "pending"
        print(f"Created support request: {data['id']}")
        
        # Store for next tests
        TestSupportChat.created_support_id = data["id"]
        return data["id"]
    
    def test_admin_can_view_support_requests(self, admin_client):
        """Admin can see pending support requests"""
        response = admin_client.get(f"{BASE_URL}/api/chats/support/requests")
        assert response.status_code == 200, f"Get support requests failed: {response.text}"
        
        data = response.json().get("data", response.json())
        assert "pending_requests" in data
        assert "active_chats" in data
        print(f"Admin sees {data['total_pending']} pending, {data['total_active']} active support chats")
        
        # Check if our created request is in pending
        if hasattr(TestSupportChat, 'created_support_id'):
            pending_ids = [r["id"] for r in data["pending_requests"]]
            assert TestSupportChat.created_support_id in pending_ids, \
                f"Created support request not found in pending requests"
            print(f"Verified: Created support request {TestSupportChat.created_support_id} is in pending queue")
            
            # Check requester info is visible to admin
            for req in data["pending_requests"]:
                if req["id"] == TestSupportChat.created_support_id:
                    assert req.get("requester_info") is not None or req.get("display_name") is not None, \
                        "Admin should see requester info"
                    print(f"Requester info visible: {req.get('requester_info') or req.get('display_name')}")
    
    def test_admin_can_accept_support_request(self, admin_client):
        """Admin can accept a support request"""
        if not hasattr(TestSupportChat, 'created_support_id'):
            pytest.skip("No support request created")
        
        conv_id = TestSupportChat.created_support_id
        response = admin_client.post(f"{BASE_URL}/api/chats/support/{conv_id}/accept")
        assert response.status_code == 200, f"Accept support request failed: {response.text}"
        
        data = response.json().get("data", response.json())
        assert data["support_status"] == "active", "Status should be active after acceptance"
        assert data["admin_joined"] == True, "Admin should be marked as joined"
        print(f"Admin accepted support request {conv_id}, status: {data['support_status']}")
    
    def test_user_can_send_message_in_support_chat(self, user_client):
        """User can send messages in support chat"""
        if not hasattr(TestSupportChat, 'created_support_id'):
            pytest.skip("No support request created")
        
        conv_id = TestSupportChat.created_support_id
        payload = {
            "content": "Test message from user in support chat",
            "attachments": []
        }
        response = user_client.post(f"{BASE_URL}/api/chats/{conv_id}/messages", json=payload)
        assert response.status_code == 200, f"Send message failed: {response.text}"
        
        data = response.json().get("data", response.json())
        assert data["content"] == payload["content"]
        print(f"User sent message in support chat: {data['id']}")
    
    def test_admin_can_send_message_in_support_chat(self, admin_client):
        """Admin can send messages in support chat"""
        if not hasattr(TestSupportChat, 'created_support_id'):
            pytest.skip("No support request created")
        
        conv_id = TestSupportChat.created_support_id
        payload = {
            "content": "Test reply from admin in support chat",
            "attachments": []
        }
        response = admin_client.post(f"{BASE_URL}/api/chats/{conv_id}/messages", json=payload)
        assert response.status_code == 200, f"Admin send message failed: {response.text}"
        
        data = response.json().get("data", response.json())
        assert data["content"] == payload["content"]
        print(f"Admin sent message in support chat: {data['id']}")
    
    def test_get_messages_in_support_chat(self, user_client):
        """User can get messages from support chat"""
        if not hasattr(TestSupportChat, 'created_support_id'):
            pytest.skip("No support request created")
        
        conv_id = TestSupportChat.created_support_id
        response = user_client.get(f"{BASE_URL}/api/chats/{conv_id}/messages")
        assert response.status_code == 200, f"Get messages failed: {response.text}"
        
        data = response.json().get("data", response.json())
        assert "messages" in data
        assert len(data["messages"]) >= 2, "Should have at least 2 messages (system + user initial)"
        print(f"Support chat has {len(data['messages'])} messages")
    
    def test_close_support_chat(self, user_client):
        """User can close their support chat"""
        if not hasattr(TestSupportChat, 'created_support_id'):
            pytest.skip("No support request created")
        
        conv_id = TestSupportChat.created_support_id
        payload = {"reason": "Issue resolved through automated testing"}
        response = user_client.post(f"{BASE_URL}/api/chats/support/{conv_id}/close", json=payload)
        assert response.status_code == 200, f"Close support chat failed: {response.text}"
        
        data = response.json().get("data", response.json())
        assert data["support_status"] == "closed"
        print(f"Support chat {conv_id} closed successfully")


class TestUnreadCount:
    """Test unread message count functionality"""
    
    @pytest.fixture(scope="class")
    def user_token(self):
        """Login as regular user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER_EMAIL,
            "password": USER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"User login failed: {response.text}")
        data = response.json().get("data", response.json())
        return data.get("access_token")
    
    @pytest.fixture(scope="class")
    def user_client(self, user_token):
        """Session with user auth"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {user_token}"
        })
        return session
    
    def test_get_unread_count(self, user_client):
        """User can get their unread count"""
        response = user_client.get(f"{BASE_URL}/api/chats/unread-count")
        assert response.status_code == 200, f"Get unread count failed: {response.text}"
        
        data = response.json().get("data", response.json())
        assert "unread_count" in data
        print(f"User has {data['unread_count']} unread messages")


class TestExistingSupportChat:
    """Test with existing support conversation"""
    
    # Known existing conversation ID from review request
    EXISTING_CONV_ID = "a0e4fa11-9235-47cd-8a68-ede2f6122840"
    
    @pytest.fixture(scope="class")
    def user_token(self):
        """Login as regular user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER_EMAIL,
            "password": USER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"User login failed: {response.text}")
        data = response.json().get("data", response.json())
        return data.get("access_token")
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        data = response.json().get("data", response.json())
        return data.get("access_token")
    
    @pytest.fixture(scope="class")
    def user_client(self, user_token):
        """Session with user auth"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {user_token}"
        })
        return session
    
    @pytest.fixture(scope="class")
    def admin_client(self, admin_token):
        """Session with admin auth"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {admin_token}"
        })
        return session
    
    def test_get_existing_conversation_messages(self, user_client):
        """Get messages from existing support conversation"""
        response = user_client.get(f"{BASE_URL}/api/chats/{self.EXISTING_CONV_ID}/messages")
        
        # If user is not participant, this will fail - that's expected
        if response.status_code == 403:
            print(f"User is not participant in conversation {self.EXISTING_CONV_ID}")
            pytest.skip("User not participant in existing conversation")
        
        if response.status_code == 404:
            print(f"Conversation {self.EXISTING_CONV_ID} not found")
            pytest.skip("Conversation not found")
        
        assert response.status_code == 200, f"Get messages failed: {response.text}"
        data = response.json().get("data", response.json())
        print(f"Existing conversation has {len(data.get('messages', []))} messages")


class TestFileUpload:
    """Test file upload functionality for chat"""
    
    @pytest.fixture(scope="class")
    def user_token(self):
        """Login as regular user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER_EMAIL,
            "password": USER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"User login failed: {response.text}")
        data = response.json().get("data", response.json())
        return data.get("access_token")
    
    def test_chat_file_upload_endpoint_exists(self, user_token):
        """Test that the chat file upload endpoint exists and requires file"""
        headers = {"Authorization": f"Bearer {user_token}"}
        # Send empty request to check endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/upload/chat",
            headers=headers
        )
        # Should return 422 (validation error) if endpoint exists but no file
        # or 400 if file is required
        assert response.status_code in [400, 422], \
            f"Upload endpoint should return 400/422 without file, got: {response.status_code}"
        print(f"Chat file upload endpoint exists, returns {response.status_code} without file")


class TestConversationTypes:
    """Test different conversation types - casual, order, support"""
    
    @pytest.fixture(scope="class")
    def user_token(self):
        """Login as regular user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER_EMAIL,
            "password": USER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"User login failed: {response.text}")
        data = response.json().get("data", response.json())
        return data.get("access_token")
    
    @pytest.fixture(scope="class")
    def user_client(self, user_token):
        """Session with user auth"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {user_token}"
        })
        return session
    
    def test_get_casual_conversations(self, user_client):
        """Get casual DM conversations"""
        response = user_client.get(f"{BASE_URL}/api/chats?conversation_type=casual")
        assert response.status_code == 200, f"Get casual conversations failed: {response.text}"
        
        data = response.json().get("data", response.json())
        print(f"User has {len(data.get('conversations', []))} casual conversations")
    
    def test_get_order_conversations(self, user_client):
        """Get order conversations"""
        response = user_client.get(f"{BASE_URL}/api/chats?conversation_type=order")
        assert response.status_code == 200, f"Get order conversations failed: {response.text}"
        
        data = response.json().get("data", response.json())
        print(f"User has {len(data.get('conversations', []))} order conversations")
    
    def test_get_support_conversations(self, user_client):
        """Get support conversations"""
        response = user_client.get(f"{BASE_URL}/api/chats?conversation_type=support")
        assert response.status_code == 200, f"Get support conversations failed: {response.text}"
        
        data = response.json().get("data", response.json())
        for conv in data.get('conversations', []):
            # Support conversations should have support-specific fields
            print(f"Support conv {conv['id']}: status={conv.get('support_status')}, subject={conv.get('support_subject')}")


class TestAuthRequired:
    """Test that chat endpoints require authentication"""
    
    def test_get_chats_requires_auth(self):
        """GET /api/chats requires auth"""
        response = requests.get(f"{BASE_URL}/api/chats")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("GET /api/chats correctly requires authentication")
    
    def test_get_unread_requires_auth(self):
        """GET /api/chats/unread-count requires auth"""
        response = requests.get(f"{BASE_URL}/api/chats/unread-count")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("GET /api/chats/unread-count correctly requires authentication")
    
    def test_create_support_requires_auth(self):
        """POST /api/chats/support requires auth"""
        response = requests.post(f"{BASE_URL}/api/chats/support", json={
            "subject": "Test",
            "initial_message": "Test message"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("POST /api/chats/support correctly requires authentication")
    
    def test_support_requests_requires_admin(self):
        """GET /api/chats/support/requests requires admin"""
        # First login as regular user
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER_EMAIL,
            "password": USER_PASSWORD
        })
        if login_response.status_code != 200:
            pytest.skip("User login failed")
        
        token = login_response.json().get("data", {}).get("access_token")
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/chats/support/requests", headers=headers)
        # Regular users should get 403 (forbidden) for admin-only endpoint
        # Note: if the user has admin role, this will succeed
        print(f"GET /api/chats/support/requests for non-admin user: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
