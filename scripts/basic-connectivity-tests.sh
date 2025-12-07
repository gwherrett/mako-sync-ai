#!/bin/bash

# Basic Connectivity Tests for Mako Sync
# Based on command-line-testing-tasks.md requirements

echo "🔍 Basic Connectivity Tests for Mako Sync"
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

echo "🌐 Environment Configuration:"
echo "   Supabase URL: $SUPABASE_URL"
echo "   Anon Key: ${SUPABASE_ANON_KEY:0:20}..."
echo ""

# Test 1: Environment Variables Check
echo "📋 Test 1: Environment Variables"
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    print_result "Environment Variables Check" "FAIL" "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY"
    exit 1
else
    print_result "Environment Variables Check" "PASS" "Both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are present"
fi

# Test 2: Script Permissions Check
echo "📋 Test 2: Script Permissions"
if [ -x "scripts/debug-auth-endpoints.sh" ]; then
    print_result "Debug Script Permissions" "PASS" "scripts/debug-auth-endpoints.sh is executable"
else
    print_result "Debug Script Permissions" "FAIL" "scripts/debug-auth-endpoints.sh lacks executable permissions"
fi

# Test 3: Basic Supabase Health Check
echo "📋 Test 3: Supabase Health Check"
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

# Test 4: Auth Endpoint Accessibility
echo "📋 Test 4: Auth Endpoint Accessibility"
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

# Test 5: Invalid Credentials Test
echo "📋 Test 5: Invalid Credentials Handling"
INVALID_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{"email":"invalid@test.com","password":"wrongpassword"}' \
    "$SUPABASE_URL/auth/v1/token?grant_type=password" 2>/dev/null)

INVALID_STATUS=$(echo "$INVALID_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)

if [ "$INVALID_STATUS" = "400" ] || [ "$INVALID_STATUS" = "401" ] || [ "$INVALID_STATUS" = "422" ]; then
    print_result "Invalid Credentials Handling" "PASS" "HTTP Status: $INVALID_STATUS (correctly rejected invalid credentials)"
else
    print_result "Invalid Credentials Handling" "FAIL" "HTTP Status: $INVALID_STATUS (should reject invalid credentials with 400/401/422)"
fi

# Test 6: Network Connectivity Test with Invalid URL
echo "📋 Test 6: Network Error Handling"
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

# Test 7: Invalid API Key Test
echo "📋 Test 7: Invalid API Key Handling"
INVALID_KEY_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -H "apikey: invalid-key-12345" \
    -H "Authorization: Bearer invalid-key-12345" \
    "$SUPABASE_URL/rest/v1/" 2>/dev/null)

INVALID_KEY_STATUS=$(echo "$INVALID_KEY_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)

if [ "$INVALID_KEY_STATUS" = "401" ] || [ "$INVALID_KEY_STATUS" = "403" ]; then
    print_result "Invalid API Key Handling" "PASS" "HTTP Status: $INVALID_KEY_STATUS (correctly rejected invalid API key)"
else
    print_result "Invalid API Key Handling" "FAIL" "HTTP Status: $INVALID_KEY_STATUS (should reject invalid API key with 401/403)"
fi

# Test 8: Response Time Test
echo "📋 Test 8: Response Time Performance"
RESPONSE_TIME=$(curl -s -w "%{time_total}" -o /dev/null \
    -H "apikey: $SUPABASE_ANON_KEY" \
    "$SUPABASE_URL/auth/v1/user" 2>/dev/null)

if [ -z "$RESPONSE_TIME" ]; then
    print_result "Response Time Performance" "FAIL" "Could not measure response time"
else
    # Simple comparison using awk instead of bc
    UNDER_5_SEC=$(echo "$RESPONSE_TIME" | awk '{if ($1 < 5.0) print "yes"; else print "no"}')
    
    if [ "$UNDER_5_SEC" = "yes" ]; then
        print_result "Response Time Performance" "PASS" "Response time: ${RESPONSE_TIME}s (under 5 seconds)"
    else
        print_result "Response Time Performance" "FAIL" "Response time: ${RESPONSE_TIME}s (over 5 seconds)"
    fi
fi

# Summary
echo "=========================================="
echo "🏁 Test Summary:"
echo -e "   Total Tests: ${BLUE}$TOTAL_TESTS${NC}"
echo -e "   Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "   Failed: ${RED}$FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n🎉 ${GREEN}All connectivity tests passed!${NC}"
    echo "✅ Basic connectivity is working properly"
    exit 0
else
    echo -e "\n⚠️  ${YELLOW}Some tests failed${NC}"
    echo "❌ Please review the failed tests above"
    exit 1
fi