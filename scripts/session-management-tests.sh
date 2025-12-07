#!/bin/bash

# Session Management Tests for Mako Sync
# Tests session persistence, token refresh, and session lifecycle

echo "🔐 Session Management Tests for Mako Sync"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    print_result "Environment File Check" "FAIL" ".env file not found"
    exit 1
fi

SUPABASE_URL="${VITE_SUPABASE_URL}"
SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    print_result "Environment Variables" "FAIL" "Missing required environment variables"
    exit 1
fi

echo "🌐 Environment Configuration:"
echo "   Supabase URL: $SUPABASE_URL"
echo "   Anon Key: ${SUPABASE_ANON_KEY:0:20}..."
echo ""

# Get test credentials
echo "📝 Please provide test credentials for session management tests:"
read -p "Enter test email: " TEST_EMAIL
read -s -p "Enter test password: " TEST_PASSWORD
echo ""
echo ""

if [ -z "$TEST_EMAIL" ] || [ -z "$TEST_PASSWORD" ]; then
    print_result "Test Credentials" "FAIL" "Email and password are required"
    exit 1
fi

# Test 1: Initial Sign In
echo "📋 Test 1: Initial Sign In"
SIGNIN_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
    "$SUPABASE_URL/auth/v1/token?grant_type=password")

SIGNIN_STATUS=$(echo "$SIGNIN_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
SIGNIN_BODY=$(echo "$SIGNIN_RESPONSE" | sed '/HTTP_STATUS:/d')

if [ "$SIGNIN_STATUS" = "200" ]; then
    print_result "Initial Sign In" "PASS" "Successfully authenticated (Status: $SIGNIN_STATUS)"
    
    # Extract tokens
    ACCESS_TOKEN=$(echo "$SIGNIN_BODY" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
    REFRESH_TOKEN=$(echo "$SIGNIN_BODY" | grep -o '"refresh_token":"[^"]*' | cut -d'"' -f4)
    
    if [ -z "$ACCESS_TOKEN" ] || [ -z "$REFRESH_TOKEN" ]; then
        print_result "Token Extraction" "FAIL" "Could not extract access or refresh tokens"
        exit 1
    else
        print_result "Token Extraction" "PASS" "Successfully extracted access and refresh tokens"
    fi
else
    print_result "Initial Sign In" "FAIL" "Authentication failed (Status: $SIGNIN_STATUS)"
    echo "Response: $SIGNIN_BODY"
    exit 1
fi

# Test 2: Session Persistence Test
echo "📋 Test 2: Session Persistence (Multiple Authenticated Requests)"
PERSISTENCE_FAILED=0

for i in {1..3}; do
    echo "   Request $i..."
    AUTH_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
        -H "apikey: $SUPABASE_ANON_KEY" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        "$SUPABASE_URL/auth/v1/user")
    
    AUTH_STATUS=$(echo "$AUTH_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
    
    if [ "$AUTH_STATUS" != "200" ]; then
        PERSISTENCE_FAILED=1
        echo "   ❌ Request $i failed with status: $AUTH_STATUS"
    else
        echo "   ✅ Request $i successful (Status: $AUTH_STATUS)"
    fi
done

if [ $PERSISTENCE_FAILED -eq 0 ]; then
    print_result "Session Persistence" "PASS" "All 3 authenticated requests successful"
else
    print_result "Session Persistence" "FAIL" "One or more authenticated requests failed"
fi

# Test 3: Token Refresh Test
echo "📋 Test 3: Token Refresh"
REFRESH_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}" \
    "$SUPABASE_URL/auth/v1/token?grant_type=refresh_token")

REFRESH_STATUS=$(echo "$REFRESH_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
REFRESH_BODY=$(echo "$REFRESH_RESPONSE" | sed '/HTTP_STATUS:/d')

if [ "$REFRESH_STATUS" = "200" ]; then
    print_result "Token Refresh" "PASS" "Successfully refreshed tokens (Status: $REFRESH_STATUS)"
    
    # Extract new tokens
    NEW_ACCESS_TOKEN=$(echo "$REFRESH_BODY" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
    NEW_REFRESH_TOKEN=$(echo "$REFRESH_BODY" | grep -o '"refresh_token":"[^"]*' | cut -d'"' -f4)
    
    if [ -n "$NEW_ACCESS_TOKEN" ] && [ -n "$NEW_REFRESH_TOKEN" ]; then
        print_result "New Token Extraction" "PASS" "Successfully extracted new tokens"
        ACCESS_TOKEN="$NEW_ACCESS_TOKEN"
        REFRESH_TOKEN="$NEW_REFRESH_TOKEN"
    else
        print_result "New Token Extraction" "FAIL" "Could not extract new tokens from refresh response"
    fi
else
    print_result "Token Refresh" "FAIL" "Token refresh failed (Status: $REFRESH_STATUS)"
    echo "Response: $REFRESH_BODY"
fi

# Test 4: New Token Validation
echo "📋 Test 4: New Token Validation"
NEW_TOKEN_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    "$SUPABASE_URL/auth/v1/user")

NEW_TOKEN_STATUS=$(echo "$NEW_TOKEN_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)

if [ "$NEW_TOKEN_STATUS" = "200" ]; then
    print_result "New Token Validation" "PASS" "New access token works correctly (Status: $NEW_TOKEN_STATUS)"
else
    print_result "New Token Validation" "FAIL" "New access token validation failed (Status: $NEW_TOKEN_STATUS)"
fi

# Test 5: Concurrent Session Test
echo "📋 Test 5: Concurrent Session Requests"
echo "   Testing concurrent authenticated requests..."

# Create temporary files for concurrent test results
TEMP_DIR=$(mktemp -d)
CONCURRENT_FAILED=0

for i in {1..3}; do
    (
        CONCURRENT_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
            -H "apikey: $SUPABASE_ANON_KEY" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            "$SUPABASE_URL/auth/v1/user")
        echo "$CONCURRENT_RESPONSE" > "$TEMP_DIR/result_$i"
    ) &
done

# Wait for all background processes to complete
wait

# Check results
for i in {1..3}; do
    RESULT=$(cat "$TEMP_DIR/result_$i")
    if [ "$RESULT" != "200" ]; then
        CONCURRENT_FAILED=1
        echo "   ❌ Concurrent request $i failed with status: $RESULT"
    else
        echo "   ✅ Concurrent request $i successful (Status: $RESULT)"
    fi
done

# Cleanup
rm -rf "$TEMP_DIR"

if [ $CONCURRENT_FAILED -eq 0 ]; then
    print_result "Concurrent Session Requests" "PASS" "All concurrent requests successful"
else
    print_result "Concurrent Session Requests" "FAIL" "One or more concurrent requests failed"
fi

# Test 6: Session Logout
echo "📋 Test 6: Session Logout"
LOGOUT_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    "$SUPABASE_URL/auth/v1/logout")

LOGOUT_STATUS=$(echo "$LOGOUT_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)

if [ "$LOGOUT_STATUS" = "200" ] || [ "$LOGOUT_STATUS" = "204" ]; then
    print_result "Session Logout" "PASS" "Successfully logged out (Status: $LOGOUT_STATUS)"
else
    print_result "Session Logout" "FAIL" "Logout failed (Status: $LOGOUT_STATUS)"
fi

# Test 7: Post-Logout Token Validation
echo "📋 Test 7: Post-Logout Token Validation"
POST_LOGOUT_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    "$SUPABASE_URL/auth/v1/user")

POST_LOGOUT_STATUS=$(echo "$POST_LOGOUT_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)

if [ "$POST_LOGOUT_STATUS" = "401" ] || [ "$POST_LOGOUT_STATUS" = "403" ]; then
    print_result "Post-Logout Token Validation" "PASS" "Token correctly invalidated after logout (Status: $POST_LOGOUT_STATUS)"
else
    print_result "Post-Logout Token Validation" "FAIL" "Token still valid after logout (Status: $POST_LOGOUT_STATUS)"
fi

# Summary
echo "=========================================="
echo "🏁 Session Management Test Summary:"
echo -e "   Total Tests: ${BLUE}$TOTAL_TESTS${NC}"
echo -e "   Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "   Failed: ${RED}$FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n🎉 ${GREEN}All session management tests passed!${NC}"
    echo "✅ Session management is working properly"
    exit 0
else
    echo -e "\n⚠️  ${YELLOW}Some session management tests failed${NC}"
    echo "❌ Please review the failed tests above"
    exit 1
fi