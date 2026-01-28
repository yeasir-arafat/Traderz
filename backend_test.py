#!/usr/bin/env python3
"""
Backend API Testing for PlayTraderz Game Marketplace
Tests all core functionality including auth, games, and admin features
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class PlayTraderzAPITester:
    def __init__(self, base_url: str = "https://game-exchange-17.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        
        # Test results tracking
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.test_results = []
        
        # Auth tokens
        self.user_token = None
        self.admin_token = None
        self.super_admin_token = None

    def log_test(self, name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
            self.failed_tests.append({"test": name, "error": details, "response": response_data})
        
        self.test_results.append({
            "name": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })

    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                    token: Optional[str] = None, expected_status: int = 200) -> tuple[bool, Any]:
        """Make HTTP request and return success status and response data"""
        url = f"{self.base_url}/api/{endpoint.lstrip('/')}"
        headers = {}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        try:
            if method.upper() == 'GET':
                response = self.session.get(url, headers=headers)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data, headers=headers)
            elif method.upper() == 'PUT':
                response = self.session.put(url, json=data, headers=headers)
            elif method.upper() == 'DELETE':
                response = self.session.delete(url, headers=headers)
            else:
                return False, f"Unsupported method: {method}"
            
            success = response.status_code == expected_status
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text, "status_code": response.status_code}
            
            return success, response_data
            
        except Exception as e:
            return False, {"error": str(e)}

    def test_health_endpoints(self):
        """Test health check endpoints"""
        print("\n🔍 Testing Health Endpoints...")
        
        # Basic health check
        success, data = self.make_request('GET', '/health')
        self.log_test("Health Check", success, 
                     "" if success else f"Status: {data.get('status_code', 'unknown')}")
        
        # Database health check
        success, data = self.make_request('GET', '/health/db')
        self.log_test("Database Health Check", success,
                     "" if success else f"DB Error: {data.get('error', 'unknown')}")

    def test_games_endpoint(self):
        """Test games listing endpoint"""
        print("\n🔍 Testing Games Endpoint...")
        
        success, data = self.make_request('GET', '/games')
        if success and data.get('success') and 'games' in data.get('data', {}):
            games = data['data']['games']
            self.log_test("Games List", True, f"Found {len(games)} games")
            
            # Check if games have required fields
            if games:
                game = games[0]
                required_fields = ['id', 'name', 'slug']
                missing_fields = [field for field in required_fields if field not in game]
                if missing_fields:
                    self.log_test("Games Structure", False, f"Missing fields: {missing_fields}")
                else:
                    self.log_test("Games Structure", True, "All required fields present")
            else:
                self.log_test("Games Data", False, "No games found in response")
        else:
            self.log_test("Games List", False, f"Invalid response: {data}")

    def test_user_registration(self):
        """Test user registration"""
        print("\n🔍 Testing User Registration...")
        
        timestamp = datetime.now().strftime("%H%M%S")
        test_user_data = {
            "username": f"testuser_{timestamp}",
            "email": f"test_{timestamp}@example.com",
            "password": "TestPass123!",
            "full_name": "Test User",
            "phone_number": "+1234567890",
            "terms_accepted": True
        }
        
        success, data = self.make_request('POST', '/auth/register', test_user_data, expected_status=200)
        if success and data.get('success'):
            user_data = data.get('data', {})
            if 'access_token' in user_data:
                self.user_token = user_data['access_token']
                self.log_test("User Registration", True, f"User created: {user_data.get('user', {}).get('username')}")
            else:
                self.log_test("User Registration", False, "No access token in response")
        else:
            self.log_test("User Registration", False, f"Registration failed: {data}")

    def test_user_login(self):
        """Test user login with email/password"""
        print("\n🔍 Testing User Login...")
        
        # Test with a known user (we'll use the one we just created)
        if not self.user_token:
            print("⚠️  Skipping login test - no user token from registration")
            return
        
        # Test login with invalid credentials first
        invalid_login = {
            "email": "invalid@example.com",
            "password": "wrongpassword"
        }
        
        success, data = self.make_request('POST', '/auth/login', invalid_login, expected_status=401)
        self.log_test("Invalid Login", success, "Correctly rejected invalid credentials" if success else "Should reject invalid login")

    def test_admin_login(self):
        """Test admin login"""
        print("\n🔍 Testing Admin Login...")
        
        admin_credentials = {
            "email": "admin@admin.com",
            "password": "admin12"
        }
        
        success, data = self.make_request('POST', '/auth/login', admin_credentials)
        if success and data.get('success'):
            user_data = data.get('data', {})
            if 'access_token' in user_data:
                self.admin_token = user_data['access_token']
                user_info = user_data.get('user', {})
                self.log_test("Admin Login", True, f"Admin logged in: {user_info.get('email')}")
            else:
                self.log_test("Admin Login", False, "No access token in response")
        else:
            self.log_test("Admin Login", False, f"Admin login failed: {data}")

    def test_super_admin_login(self):
        """Test super admin login"""
        print("\n🔍 Testing Super Admin Login...")
        
        super_admin_credentials = {
            "email": "super@admin.com",
            "password": "admin12"
        }
        
        success, data = self.make_request('POST', '/auth/login', super_admin_credentials)
        if success and data.get('success'):
            user_data = data.get('data', {})
            if 'access_token' in user_data:
                self.super_admin_token = user_data['access_token']
                user_info = user_data.get('user', {})
                self.log_test("Super Admin Login", True, f"Super admin logged in: {user_info.get('email')}")
            else:
                self.log_test("Super Admin Login", False, "No access token in response")
        else:
            self.log_test("Super Admin Login", False, f"Super admin login failed: {data}")

    def test_protected_endpoints(self):
        """Test protected endpoints with authentication"""
        print("\n🔍 Testing Protected Endpoints...")
        
        if self.user_token:
            # Test /auth/me endpoint
            success, data = self.make_request('GET', '/auth/me', token=self.user_token)
            self.log_test("Get Current User", success, 
                         f"User profile retrieved" if success else f"Failed to get user: {data}")
        else:
            self.log_test("Get Current User", False, "No user token available")

    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting PlayTraderz API Tests...")
        print(f"🌐 Testing against: {self.base_url}")
        
        # Run test suites in order
        self.test_health_endpoints()
        self.test_games_endpoint()
        self.test_user_registration()
        self.test_user_login()
        self.test_admin_login()
        self.test_super_admin_login()
        self.test_protected_endpoints()
        
        # Print summary
        print(f"\n📊 Test Summary:")
        print(f"   Tests Run: {self.tests_run}")
        print(f"   Tests Passed: {self.tests_passed}")
        print(f"   Tests Failed: {len(self.failed_tests)}")
        print(f"   Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ Failed Tests:")
            for failure in self.failed_tests:
                print(f"   - {failure['test']}: {failure['error']}")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test runner"""
    tester = PlayTraderzAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    results = {
        "timestamp": datetime.now().isoformat(),
        "base_url": tester.base_url,
        "summary": {
            "tests_run": tester.tests_run,
            "tests_passed": tester.tests_passed,
            "tests_failed": len(tester.failed_tests),
            "success_rate": (tester.tests_passed/tester.tests_run*100) if tester.tests_run > 0 else 0
        },
        "test_results": tester.test_results,
        "failed_tests": tester.failed_tests
    }
    
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/backend_test_results.json")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())