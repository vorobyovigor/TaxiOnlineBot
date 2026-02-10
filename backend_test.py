#!/usr/bin/env python3
"""
Backend API Testing for Telegram Mini App Taxi Service
Tests all API endpoints for client, admin, and driver functionality
"""

import requests
import json
import sys
from datetime import datetime
from typing import Dict, Any, Optional

class TaxiAPITester:
    def __init__(self, base_url="https://teleport-taxi.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.admin_token = None
        self.client_data = None
        self.test_order_id = None
        self.test_driver_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    {details}")
        
        if success:
            self.tests_passed += 1
        else:
            self.failed_tests.append({"name": name, "details": details})

    def make_request(self, method: str, endpoint: str, data: Dict = None, params: Dict = None, headers: Dict = None) -> tuple:
        """Make HTTP request and return (success, response_data, status_code)"""
        url = f"{self.api_url}/{endpoint.lstrip('/')}"
        
        default_headers = {'Content-Type': 'application/json'}
        if headers:
            default_headers.update(headers)
        
        try:
            if method.upper() == 'GET':
                response = requests.get(url, params=params, headers=default_headers, timeout=10)
            elif method.upper() == 'POST':
                response = requests.post(url, json=data, params=params, headers=default_headers, timeout=10)
            elif method.upper() == 'PATCH':
                response = requests.patch(url, json=data, params=params, headers=default_headers, timeout=10)
            else:
                return False, {}, 0
            
            try:
                response_data = response.json()
            except:
                response_data = {"text": response.text}
            
            return response.status_code < 400, response_data, response.status_code
            
        except Exception as e:
            return False, {"error": str(e)}, 0

    def test_api_root(self):
        """Test API root endpoint"""
        success, data, status = self.make_request('GET', '/')
        expected_keys = ['message', 'version']
        
        if success and any(key in data for key in expected_keys):
            self.log_test("API Root", True, f"Status: {status}, Response: {data}")
        else:
            self.log_test("API Root", False, f"Status: {status}, Response: {data}")

    def test_client_auth(self):
        """Test client authentication"""
        # Test with demo init data
        test_data = {
            "init_data": "user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22Demo%22%2C%22username%22%3A%22demo_user%22%7D"
        }
        
        success, data, status = self.make_request('POST', '/client/auth', test_data)
        
        if success and 'telegram_id' in data:
            self.client_data = data
            self.log_test("Client Auth", True, f"Client ID: {data.get('id', 'N/A')}")
        else:
            self.log_test("Client Auth", False, f"Status: {status}, Response: {data}")

    def test_admin_auth(self):
        """Test admin authentication"""
        test_data = {
            "telegram_id": "admin_123",
            "username": "test_admin",
            "first_name": "Test",
            "last_name": "Admin",
            "auth_date": int(datetime.now().timestamp()),
            "hash": "demo_hash"
        }
        
        success, data, status = self.make_request('POST', '/admin/auth', test_data)
        
        if success and 'token' in data:
            self.admin_token = data['token']
            self.log_test("Admin Auth", True, f"Token: {self.admin_token}")
        else:
            self.log_test("Admin Auth", False, f"Status: {status}, Response: {data}")

    def test_create_order(self):
        """Test order creation"""
        if not self.client_data:
            self.log_test("Create Order", False, "No client data available")
            return
        
        order_data = {
            "address_from": "Тестовая улица, 1",
            "address_to": "Тестовая улица, 10",
            "comment": "Тестовый заказ"
        }
        
        params = {"telegram_id": self.client_data['telegram_id']}
        success, data, status = self.make_request('POST', '/client/order', order_data, params)
        
        if success and 'id' in data:
            self.test_order_id = data['id']
            self.log_test("Create Order", True, f"Order ID: {self.test_order_id}")
        else:
            self.log_test("Create Order", False, f"Status: {status}, Response: {data}")

    def test_get_active_order(self):
        """Test getting active order"""
        if not self.client_data:
            self.log_test("Get Active Order", False, "No client data available")
            return
        
        params = {"telegram_id": self.client_data['telegram_id']}
        success, data, status = self.make_request('GET', '/client/order/active', params=params)
        
        if success:
            if data and 'id' in data:
                self.log_test("Get Active Order", True, f"Found active order: {data['id']}")
            else:
                self.log_test("Get Active Order", True, "No active order (expected)")
        else:
            self.log_test("Get Active Order", False, f"Status: {status}, Response: {data}")

    def test_order_history(self):
        """Test getting order history"""
        if not self.client_data:
            self.log_test("Order History", False, "No client data available")
            return
        
        params = {"telegram_id": self.client_data['telegram_id']}
        success, data, status = self.make_request('GET', '/client/orders/history', params=params)
        
        if success and isinstance(data, list):
            self.log_test("Order History", True, f"Found {len(data)} orders")
        else:
            self.log_test("Order History", False, f"Status: {status}, Response: {data}")

    def test_cancel_order(self):
        """Test order cancellation by client"""
        if not self.test_order_id or not self.client_data:
            self.log_test("Cancel Order (Client)", False, "No order ID or client data available")
            return
        
        params = {"telegram_id": self.client_data['telegram_id']}
        success, data, status = self.make_request('POST', f'/client/order/{self.test_order_id}/cancel', params=params)
        
        if success and data.get('success'):
            self.log_test("Cancel Order (Client)", True, "Order cancelled successfully")
        else:
            self.log_test("Cancel Order (Client)", False, f"Status: {status}, Response: {data}")

    def test_admin_stats(self):
        """Test admin dashboard stats"""
        success, data, status = self.make_request('GET', '/admin/stats')
        
        expected_keys = ['orders', 'drivers', 'clients']
        if success and all(key in data for key in expected_keys):
            self.log_test("Admin Stats", True, f"Orders: {data['orders']['total']}, Drivers: {data['drivers']['total']}")
        else:
            self.log_test("Admin Stats", False, f"Status: {status}, Response: {data}")

    def test_admin_orders(self):
        """Test getting all orders (admin)"""
        success, data, status = self.make_request('GET', '/admin/orders')
        
        if success and isinstance(data, list):
            self.log_test("Admin Orders", True, f"Found {len(data)} orders")
        else:
            self.log_test("Admin Orders", False, f"Status: {status}, Response: {data}")

    def test_admin_drivers(self):
        """Test getting all drivers"""
        success, data, status = self.make_request('GET', '/admin/drivers')
        
        if success and isinstance(data, list):
            self.log_test("Admin Drivers", True, f"Found {len(data)} drivers")
            if data:
                self.test_driver_id = data[0].get('id')
        else:
            self.log_test("Admin Drivers", False, f"Status: {status}, Response: {data}")

    def test_admin_clients(self):
        """Test getting all clients"""
        success, data, status = self.make_request('GET', '/admin/clients')
        
        if success and isinstance(data, list):
            self.log_test("Admin Clients", True, f"Found {len(data)} clients")
        else:
            self.log_test("Admin Clients", False, f"Status: {status}, Response: {data}")

    def test_admin_logs(self):
        """Test getting action logs"""
        success, data, status = self.make_request('GET', '/admin/logs')
        
        if success and isinstance(data, list):
            self.log_test("Admin Logs", True, f"Found {len(data)} log entries")
        else:
            self.log_test("Admin Logs", False, f"Status: {status}, Response: {data}")

    def test_update_driver(self):
        """Test updating driver status"""
        if not self.test_driver_id:
            self.log_test("Update Driver", False, "No driver ID available")
            return
        
        update_data = {"phone": "+7900123456"}
        success, data, status = self.make_request('PATCH', f'/admin/drivers/{self.test_driver_id}', update_data)
        
        if success and 'id' in data:
            self.log_test("Update Driver", True, f"Driver updated: {data.get('phone', 'N/A')}")
        else:
            self.log_test("Update Driver", False, f"Status: {status}, Response: {data}")

    def test_admin_cancel_order(self):
        """Test order cancellation by admin"""
        # First create a new order to cancel
        if not self.client_data:
            self.log_test("Admin Cancel Order", False, "No client data available")
            return
        
        # Create order
        order_data = {
            "address_from": "Админ тест улица, 1",
            "address_to": "Админ тест улица, 2"
        }
        params = {"telegram_id": self.client_data['telegram_id']}
        success, data, status = self.make_request('POST', '/client/order', order_data, params)
        
        if not success or 'id' not in data:
            self.log_test("Admin Cancel Order", False, "Failed to create test order")
            return
        
        order_id = data['id']
        
        # Cancel by admin
        success, data, status = self.make_request('POST', f'/admin/orders/{order_id}/cancel')
        
        if success and data.get('success'):
            self.log_test("Admin Cancel Order", True, "Order cancelled by admin")
        else:
            self.log_test("Admin Cancel Order", False, f"Status: {status}, Response: {data}")

    def test_drivers_chat_settings(self):
        """Test saving drivers chat ID"""
        chat_data = {"chat_id": "-1001234567890"}
        success, data, status = self.make_request('POST', '/admin/settings/drivers-chat', chat_data)
        
        if success and data.get('success'):
            self.log_test("Drivers Chat Settings", True, "Chat ID saved")
        else:
            self.log_test("Drivers Chat Settings", False, f"Status: {status}, Response: {data}")

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Telegram Mini App Taxi Service API Tests")
        print(f"📡 Testing API: {self.api_url}")
        print("=" * 60)
        
        # Basic API tests
        self.test_api_root()
        
        # Authentication tests
        self.test_client_auth()
        self.test_admin_auth()
        
        # Client API tests
        self.test_create_order()
        self.test_get_active_order()
        self.test_order_history()
        self.test_cancel_order()
        
        # Admin API tests
        self.test_admin_stats()
        self.test_admin_orders()
        self.test_admin_drivers()
        self.test_admin_clients()
        self.test_admin_logs()
        self.test_update_driver()
        self.test_admin_cancel_order()
        self.test_drivers_chat_settings()
        
        # Print summary
        print("=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.failed_tests:
            print("\n❌ Failed Tests:")
            for test in self.failed_tests:
                print(f"  - {test['name']}: {test['details']}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test runner"""
    tester = TaxiAPITester()
    
    try:
        success = tester.run_all_tests()
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\n⚠️  Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n💥 Unexpected error: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())