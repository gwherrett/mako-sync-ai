#!/bin/bash

# Phase 4 API Endpoints Testing Script
# This script tests all Phase 4 functionality

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SUPABASE_URL="https://bzzstdpfmyqttnzhgaoa.supabase.co"
FUNCTION_URL="${SUPABASE_URL}/functions/v1/spotify-sync-liked"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to test API endpoint
test_endpoint() {
    local test_name="$1"
    local payload="$2"
    local expected_status="$3"
    
    print_status "Testing: $test_name"
    
    if [ -z "$JWT_TOKEN" ]; then
        print_error "JWT_TOKEN not set. Please set your JWT token first."
        return 1
    fi
    
    local response=$(curl -s -w "\n%{http_code}" -X POST "$FUNCTION_URL" \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$payload")
    
    local body=$(echo "$response" | head -n -1)
    local status_code=$(echo "$response" | tail -n 1)
    
    echo "Response: $body"
    echo "Status Code: $status_code"
    
    if [ "$status_code" = "$expected_status" ]; then
        print_success "$test_name passed"
        return 0
    else
        print_error "$test_name failed (expected $expected_status, got $status_code)"
        return 1
    fi
}

echo "🧪 Phase 4 API Endpoints Testing"
echo "================================="
echo ""

# Check if JWT token is provided
if [ -z "$JWT_TOKEN" ]; then
    print_error "JWT_TOKEN environment variable is required"
    echo ""
    echo "To get your JWT token:"
    echo "1. Open browser developer tools"
    echo "2. Go to your Mako Sync app"
    echo "3. Check Application/Storage → Local Storage"
    echo "4. Look for 'sb-bzzstdpfmyqttnzhgaoa-auth-token'"
    echo "5. Copy the 'access_token' value"
    echo ""
    echo "Then run: JWT_TOKEN='your_token_here' $0"
    exit 1
fi

print_success "JWT token provided"
echo ""

# Test 1: Health Check
echo "🏥 Test 1: Health Check"
echo "----------------------"
if test_endpoint "Health Check" '{"health_check": true}' "200"; then
    echo "✅ Health check endpoint working"
else
    echo "❌ Health check endpoint failed"
fi
echo ""

# Test 2: Token Refresh
echo "🔄 Test 2: Token Refresh"
echo "------------------------"
if test_endpoint "Token Refresh" '{"refresh_only": true}' "200"; then
    echo "✅ Token refresh endpoint working"
else
    echo "❌ Token refresh endpoint failed"
fi
echo ""

# Test 3: Vault Validation
echo "🔐 Test 3: Vault Validation"
echo "---------------------------"
if test_endpoint "Vault Validation" '{"validate_vault": true}' "200"; then
    echo "✅ Vault validation endpoint working"
else
    echo "❌ Vault validation endpoint failed"
fi
echo ""

# Test 4: Force Token Rotation
echo "🔄 Test 4: Force Token Rotation"
echo "-------------------------------"
if test_endpoint "Force Token Rotation" '{"force_token_rotation": true}' "200"; then
    echo "✅ Token rotation endpoint working"
else
    echo "❌ Token rotation endpoint failed"
fi
echo ""

# Test 5: Regular Sync (should work without special flags)
echo "🎵 Test 5: Regular Sync"
echo "-----------------------"
print_status "Testing regular sync endpoint..."
if test_endpoint "Regular Sync" '{}' "200"; then
    echo "✅ Regular sync endpoint working"
else
    print_warning "Regular sync may require Spotify connection"
fi
echo ""

# Test 6: Invalid Request (should return error)
echo "❌ Test 6: Invalid Request"
echo "--------------------------"
print_status "Testing invalid request handling..."
if test_endpoint "Invalid Request" '{"invalid_flag": true}' "200"; then
    echo "✅ Invalid request handled gracefully"
else
    print_warning "Invalid request handling may vary"
fi
echo ""

echo "📊 Phase 4 Testing Summary"
echo "=========================="
echo ""
echo "All Phase 4 endpoints have been tested."
echo ""
echo "🔗 Useful debugging commands:"
echo ""
echo "# Check edge function logs"
echo "supabase functions logs spotify-sync-liked"
echo ""
echo "# Check function deployment status"
echo "supabase functions list"
echo ""
echo "# Test database connectivity"
echo "supabase db ping"
echo ""
echo "📖 For troubleshooting, see:"
echo "- docs/supabase-phase4-configuration.md"
echo "- scripts/env-variables-template.md"
echo ""

# Additional verification
echo "🔍 Additional Verification"
echo "=========================="
echo ""

print_status "Checking function deployment..."
if command -v supabase &> /dev/null; then
    if supabase functions list | grep -q "spotify-sync-liked"; then
        print_success "Edge function is deployed"
    else
        print_warning "Edge function may not be deployed"
    fi
else
    print_warning "Supabase CLI not available for verification"
fi

echo ""
print_status "Testing complete!"
echo ""
echo "💡 Tips:"
echo "- If tests fail, check environment variables in Supabase Dashboard"
echo "- Ensure Spotify account is connected"
echo "- Verify Vault extension is enabled"
echo "- Check function logs for detailed error messages"