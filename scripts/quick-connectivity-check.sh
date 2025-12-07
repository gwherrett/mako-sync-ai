#!/bin/bash

# Quick Connectivity Check - Essential Tests Only
# Based on command-line-testing-tasks.md "Quick Test Summary"

echo "🚀 Quick Connectivity Check for Mako Sync"
echo "========================================="

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "❌ .env file not found"
    exit 1
fi

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Test 1: Environment check
echo "1️⃣ Environment Variables Check..."
ENV_CHECK=$(cat .env | grep -E "(VITE_SUPABASE_URL|VITE_SUPABASE_ANON_KEY)")
if [ -n "$ENV_CHECK" ]; then
    echo -e "   ✅ ${GREEN}PASS${NC}: Environment variables present"
else
    echo -e "   ❌ ${RED}FAIL${NC}: Missing environment variables"
    exit 1
fi

# Test 2: Basic connectivity
echo "2️⃣ Basic Supabase Connectivity..."
HEALTH_STATUS=$(curl -s -w "%{http_code}" -o /dev/null \
    -H "apikey: $VITE_SUPABASE_ANON_KEY" \
    "$VITE_SUPABASE_URL/rest/v1/")

if [ "$HEALTH_STATUS" = "200" ]; then
    echo -e "   ✅ ${GREEN}PASS${NC}: Health check (Status: $HEALTH_STATUS)"
else
    echo -e "   ❌ ${RED}FAIL${NC}: Health check failed (Status: $HEALTH_STATUS)"
    exit 1
fi

# Test 3: Auth endpoint check
echo "3️⃣ Auth Endpoint Check..."
AUTH_STATUS=$(curl -s -w "%{http_code}" -o /dev/null \
    -H "apikey: $VITE_SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    "$VITE_SUPABASE_URL/auth/v1/user")

if [ "$AUTH_STATUS" = "200" ] || [ "$AUTH_STATUS" = "401" ] || [ "$AUTH_STATUS" = "403" ]; then
    echo -e "   ✅ ${GREEN}PASS${NC}: Auth endpoint accessible (Status: $AUTH_STATUS)"
else
    echo -e "   ❌ ${RED}FAIL${NC}: Auth endpoint issue (Status: $AUTH_STATUS)"
    exit 1
fi

echo ""
echo "🎉 Quick connectivity check completed successfully!"
echo "✅ All essential connectivity tests passed"
echo ""
echo "💡 For comprehensive testing, run: ./scripts/basic-connectivity-tests.sh"
echo "💡 For full auth testing, run: ./scripts/debug-auth-endpoints.sh"