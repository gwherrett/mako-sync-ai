#!/bin/bash

# Comprehensive Authentication Integration Tests for Mako Sync
# Combines all authentication flow tests from command-line-testing-tasks.md

echo "🚀 Comprehensive Authentication Integration Tests"
echo "================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to print test results
print_result() {
    local test_name="$1"
    local status="$2"
    local details="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$status" = "PASS" ]; then
        echo -e "✅ ${GREEN}PASS${NC}: $test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "❌ ${RED}FAIL${NC}: $test_name"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    if [ -n "$details" ]; then
        echo -e "   ${BLUE}Details:${NC} $details"
    fi
    echo ""
}

# Function to print section headers
print_section() {
    echo -e "\n${CYAN}=== $1 ===${NC}"
}

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    print_result "Environment File Check" "FAIL" ".env file not found"
    exit 1
fi

SUPABASE_URL="${VITE_SUPABASE_URL}"
SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY}"

echo "🌐 Environment Configuration:"
echo "   Supabase URL: $SUPABASE_URL"
echo "   Anon Key: ${SUPABASE_ANON_KEY:0:20}..."
echo ""

# SECTION 1: Environment Setup Verification
print_section "1. Environment Setup Verification"

# Test 1.1: Environment Variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    print_result "Environment Variables Check" "FAIL" "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY"
    exit 1
else
    print_result "Environment Variables Check" "PASS" "Both required environment variables are present"
fi

# Test 1.2: Script Permissions
if [ -x "scripts/debug-auth-endpoints.sh" ]; then
    print_result "Script Permissions Check" "PASS" "debug-auth-endpoints.sh is executable"
else
    print_result "Script Permissions Check" "FAIL" "debug-auth-endpoints.sh lacks executable permissions"
fi

# SECTION 2: Basic Connectivity Tests
print_section "2. Basic Connectivity Tests"

# Test 2.1: Supabase Health Check
HEALTH_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    "$SUPABASE_URL/rest/v1/" 2>/dev/null)

HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)

if [ "$HEALTH_STATUS" = "200" ]; then
    print_result "Supabase Health Check" "PASS" "HTTP Status: $HEALTH_STATUS"
else
    print_result "Supabase Health Check" "FAIL" "HTTP Status: $HEALTH_STATUS (expected 200)"
fi

# Test 2.2: Auth Endpoint Accessibility
AUTH_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    "$SUPABASE_URL/auth/v1/user" 2>/dev/null)

AUTH_STATUS=$(echo "$AUTH_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)

if [ "$AUTH_STATUS" = "200" ] || [ "$AUTH_STATUS" = "401" ] || [ "$AUTH_STATUS" = "403" ]; then
    print_result "Auth Endpoint Accessibility" "PASS" "HTTP Status: $AUTH_STATUS (endpoint accessible)"
else
    print_result "Auth Endpoint Accessibility" "FAIL" "HTTP Status: $AUTH_STATUS (expected 200, 401, or 403)"
fi

# SECTION 3: Authentication Flow Tests
print_section "3. Authentication Flow Tests"

# Get test credentials
echo "📝 Please provide test credentials for authentication flow tests:"
read -p "Enter test email: " TEST_EMAIL
read -s -p "Enter test password: " TEST_PASSWORD
echo ""
echo ""

if [ -z "$TEST_EMAIL" ] || [ -z "$TEST_PASSWORD" ]; then
    print_result "Test Credentials Input" "FAIL" "Email and password are required"
    exit 1
else
    print_result "Test Credentials Input" "PASS" "Test credentials provided"
fi

# Test 3.1: Valid Sign In
SIGNIN_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
    "$SUPABASE_URL/auth/v1/token?grant_type=password")

SIGNIN_STATUS=$(echo "$SIGNIN_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
SIGNIN_BODY=$(echo "$SIGNIN_RESPONSE" | sed '/HTTP_STATUS:/d')

if [ "$SIGNIN_STATUS" = "200" ]; then
    print_result "Valid Sign In" "PASS" "Successfully authenticated (Status: $SIGNIN_STATUS)"
    
    # Extract tokens
    ACCESS_TOKEN=$(echo "$SIGNIN_BODY" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
    REFRESH_TOKEN=$(echo "$SIGNIN_BODY" | grep -o '"refresh_token":"[^"]*' | cut -d'"' -f4)
    
    if [ -n "$ACCESS_TOKEN" ] && [ -n "$REFRESH_TOKEN" ]; then
        print_result "Token Extraction" "PASS" "Successfully extracted access and refresh tokens"
    else
        print_result "Token Extraction" "FAIL" "Could not extract tokens from sign-in response"
        exit 1
    fi
else
    print_result "Valid Sign In" "FAIL" "Authentication failed (Status: $SIGNIN_STATUS)"
    echo "Response: $SIGNIN_BODY"
    exit 1
fi

# Test 3.2: Invalid Credentials Test
INVALID_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{"email":"invalid@test.com","password":"wrongpassword"}' \
    "$SUPABASE_URL/auth/v1/token?grant_type=password" 2>/dev/null)

INVALID_STATUS=$(echo "$INVALID_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)

if [ "$INVALID_STATUS" = "400" ] || [ "$INVALID_STATUS" = "401" ] || [ "$INVALID_STATUS" = "422" ]; then
    print_result "Invalid Credentials Rejection" "PASS" "HTTP Status: $INVALID_STATUS (correctly rejected)"
else
    print_result "Invalid Credentials Rejection" "FAIL" "HTTP Status: $INVALID_STATUS (should reject with 400/401/422)"
fi

# SECTION 4: Session Management Tests
print_section "4. Session Management Tests"

# Test 4.1: Authenticated Request
AUTH_REQUEST_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    "$SUPABASE_URL/auth/v1/user")

AUTH_REQUEST_STATUS=$(echo "$AUTH_REQUEST_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)

if [ "$AUTH_REQUEST_STATUS" = "200" ]; then
    print_result "Authenticated Request" "PASS" "HTTP Status: $AUTH_REQUEST_STATUS"
else
    print_result "Authenticated Request" "FAIL" "HTTP Status: $AUTH_REQUEST_STATUS (expected 200)"
fi

# Test 4.2: Session Persistence (Multiple Requests)
PERSISTENCE_FAILED=0
for i in {1..3}; do
    PERSISTENCE_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
        -H "apikey: $SUPABASE_ANON_KEY" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        "$SUPABASE_URL/auth/v1/user")
    
    if [ "$PERSISTENCE_RESPONSE" != "200" ]; then
        PERSISTENCE_FAILED=1
        break
    fi
done

if [ $PERSISTENCE_FAILED -eq 0 ]; then
    print_result "Session Persistence" "PASS" "All 3 consecutive requests successful"
else
    print_result "Session Persistence" "FAIL" "One or more consecutive requests failed"
fi

# Test 4.3: Token Refresh
REFRESH_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}" \
    "$SUPABASE_URL/auth/v1/token?grant_type=refresh_token")

REFRESH_STATUS=$(echo "$REFRESH_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)

if [ "$REFRESH_STATUS" = "200" ]; then
    print_result "Token Refresh" "PASS" "HTTP Status: $REFRESH_STATUS"
    
    # Extract new tokens
    REFRESH_BODY=$(echo "$REFRESH_RESPONSE" | sed '/HTTP_STATUS:/d')
    NEW_ACCESS_TOKEN=$(echo "$REFRESH_BODY" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
    
    if [ -n "$NEW_ACCESS_TOKEN" ]; then
        ACCESS_TOKEN="$NEW_ACCESS_TOKEN"
        print_result "New Token Extraction" "PASS" "Successfully extracted new access token"
    else
        print_result "New Token Extraction" "FAIL" "Could not extract new access token"
    fi
else
    print_result "Token Refresh" "FAIL" "HTTP Status: $REFRESH_STATUS (expected 200)"
fi

# SECTION 5: Error Handling Tests
print_section "5. Error Handling Tests"

# Test 5.1: Invalid API Key
INVALID_KEY_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -H "apikey: invalid-key-12345" \
    -H "Authorization: Bearer invalid-key-12345" \
    "$SUPABASE_URL/rest/v1/" 2>/dev/null)

INVALID_KEY_STATUS=$(echo "$INVALID_KEY_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)

if [ "$INVALID_KEY_STATUS" = "401" ] || [ "$INVALID_KEY_STATUS" = "403" ]; then
    print_result "Invalid API Key Handling" "PASS" "HTTP Status: $INVALID_KEY_STATUS (correctly rejected)"
else
    print_result "Invalid API Key Handling" "FAIL" "HTTP Status: $INVALID_KEY_STATUS (should reject with 401/403)"
fi

# Test 5.2: Network Connectivity
INVALID_URL="https://invalid-url-that-does-not-exist.supabase.co"
NETWORK_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    --connect-timeout 5 \
    --max-time 10 \
    "$INVALID_URL/rest/v1/" 2>/dev/null)

NETWORK_STATUS=$(echo "$NETWORK_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)

if [ -z "$NETWORK_STATUS" ] || [ "$NETWORK_STATUS" = "000" ]; then
    print_result "Network Error Handling" "PASS" "Connection properly failed for invalid URL"
else
    print_result "Network Error Handling" "FAIL" "Unexpected response from invalid URL: $NETWORK_STATUS"
fi

# SECTION 6: Performance Tests
print_section "6. Performance Tests"

# Test 6.1: Response Time
RESPONSE_TIME=$(curl -s -w "%{time_total}" -o /dev/null \
    -H "apikey: $SUPABASE_ANON_KEY" \
    "$SUPABASE_URL/auth/v1/user" 2>/dev/null)

if [ -n "$RESPONSE_TIME" ]; then
    UNDER_5_SEC=$(echo "$RESPONSE_TIME" | awk '{if ($1 < 5.0) print "yes"; else print "no"}')
    
    if [ "$UNDER_5_SEC" = "yes" ]; then
        print_result "Response Time Performance" "PASS" "Response time: ${RESPONSE_TIME}s (under 5 seconds)"
    else
        print_result "Response Time Performance" "FAIL" "Response time: ${RESPONSE_TIME}s (over 5 seconds)"
    fi
else
    print_result "Response Time Performance" "FAIL" "Could not measure response time"
fi

# Test 6.2: Concurrent Requests
TEMP_DIR=$(mktemp -d)
CONCURRENT_FAILED=0

for i in {1..3}; do
    (
        CONCURRENT_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
            -H "apikey: $SUPABASE_ANON_KEY" \
            "$SUPABASE_URL/auth/v1/user")
        echo "$CONCURRENT_RESPONSE" > "$TEMP_DIR/result_$i"
    ) &
done

wait

for i in {1..3}; do
    RESULT=$(cat "$TEMP_DIR/result_$i")
    if [ "$RESULT" != "200" ] && [ "$RESULT" != "401" ] && [ "$RESULT" != "403" ]; then
        CONCURRENT_FAILED=1
        break
    fi
done

rm -rf "$TEMP_DIR"

if [ $CONCURRENT_FAILED -eq 0 ]; then
    print_result "Concurrent Request Handling" "PASS" "All concurrent requests handled properly"
else
    print_result "Concurrent Request Handling" "FAIL" "One or more concurrent requests failed unexpectedly"
fi

# SECTION 7: Session Cleanup
print_section "7. Session Cleanup"

# Test 7.1: Sign Out
LOGOUT_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    "$SUPABASE_URL/auth/v1/logout")

LOGOUT_STATUS=$(echo "$LOGOUT_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)

if [ "$LOGOUT_STATUS" = "200" ] || [ "$LOGOUT_STATUS" = "204" ]; then
    print_result "Session Logout" "PASS" "HTTP Status: $LOGOUT_STATUS"
else
    print_result "Session Logout" "FAIL" "HTTP Status: $LOGOUT_STATUS (expected 200 or 204)"
fi

# Test 7.2: Post-Logout Token Validation
POST_LOGOUT_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    "$SUPABASE_URL/auth/v1/user")

POST_LOGOUT_STATUS=$(echo "$POST_LOGOUT_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)

if [ "$POST_LOGOUT_STATUS" = "401" ] || [ "$POST_LOGOUT_STATUS" = "403" ]; then
    print_result "Post-Logout Token Invalidation" "PASS" "HTTP Status: $POST_LOGOUT_STATUS (token properly invalidated)"
else
    print_result "Post-Logout Token Invalidation" "FAIL" "HTTP Status: $POST_LOGOUT_STATUS (token should be invalidated)"
fi

# FINAL SUMMARY
echo ""
echo "================================================="
echo "🏁 Comprehensive Authentication Integration Test Summary:"
echo -e "   Total Tests: ${BLUE}$TOTAL_TESTS${NC}"
echo -e "   Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "   Failed: ${RED}$FAILED_TESTS${NC}"

SUCCESS_RATE=$(echo "scale=1; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l 2>/dev/null || echo "N/A")
echo -e "   Success Rate: ${CYAN}${SUCCESS_RATE}%${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n🎉 ${GREEN}ALL AUTHENTICATION TESTS PASSED!${NC}"
    echo "✅ Complete authentication flow is working properly"
    echo ""
    echo "📋 Test Coverage Summary:"
    echo "   ✅ Environment setup verification"
    echo "   ✅ Basic connectivity tests"
    echo "   ✅ Authentication flow tests"
    echo "   ✅ Session management tests"
    echo "   ✅ Error handling tests"
    echo "   ✅ Performance tests"
    echo "   ✅ Session cleanup tests"
    exit 0
else
    echo -e "\n⚠️  ${YELLOW}SOME AUTHENTICATION TESTS FAILED${NC}"
    echo "❌ Please review the failed tests above"
    echo ""
    echo "🔧 Troubleshooting Tips:"
    echo "   • Check environment variables in .env file"
    echo "   • Verify Supabase project configuration"
    echo "   • Ensure test credentials are valid"
    echo "   • Check network connectivity"
    echo "   • Review Supabase auth settings"
    exit 1
fi