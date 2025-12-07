#!/bin/bash

# Auth Endpoint Debug Script
# Tests Supabase auth endpoints directly to isolate issues

echo "🔍 Auth Endpoint Debug Testing"
echo "================================"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

SUPABASE_URL="${VITE_SUPABASE_URL}"
SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "❌ Missing Supabase environment variables"
    echo "Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env"
    exit 1
fi

echo "🌐 Supabase URL: $SUPABASE_URL"
echo "🔑 Using anon key: ${SUPABASE_ANON_KEY:0:20}..."
echo ""

# Test 1: Health Check
echo "1️⃣ Testing Supabase Health..."
curl -s -w "\nStatus: %{http_code}\n" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    "$SUPABASE_URL/rest/v1/" || echo "❌ Health check failed"

echo ""

# Test 2: Auth Session Check
echo "2️⃣ Testing Auth Session Endpoint..."
curl -s -w "\nStatus: %{http_code}\n" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    "$SUPABASE_URL/auth/v1/user" || echo "❌ Auth session check failed"

echo ""

# Test 3: Sign In Test (requires user input)
echo "3️⃣ Testing Sign In Endpoint..."
read -p "Enter test email: " TEST_EMAIL
read -s -p "Enter test password: " TEST_PASSWORD
echo ""

SIGNIN_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
    "$SUPABASE_URL/auth/v1/token?grant_type=password")

HTTP_STATUS=$(echo "$SIGNIN_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$SIGNIN_RESPONSE" | sed '/HTTP_STATUS:/d')

echo "Response Status: $HTTP_STATUS"
echo "Response Body: $RESPONSE_BODY"

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Sign in successful"
    
    # Extract access token for further tests
    ACCESS_TOKEN=$(echo "$RESPONSE_BODY" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
    
    if [ -n "$ACCESS_TOKEN" ]; then
        echo "🔑 Access token obtained: ${ACCESS_TOKEN:0:20}..."
        
        # Test 4: Authenticated Request
        echo ""
        echo "4️⃣ Testing Authenticated Request..."
        curl -s -w "\nStatus: %{http_code}\n" \
            -H "apikey: $SUPABASE_ANON_KEY" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            "$SUPABASE_URL/auth/v1/user"
        
        # Test 5: Session Refresh
        REFRESH_TOKEN=$(echo "$RESPONSE_BODY" | grep -o '"refresh_token":"[^"]*' | cut -d'"' -f4)
        if [ -n "$REFRESH_TOKEN" ]; then
            echo ""
            echo "5️⃣ Testing Session Refresh..."
            curl -s -w "\nStatus: %{http_code}\n" \
                -X POST \
                -H "apikey: $SUPABASE_ANON_KEY" \
                -H "Content-Type: application/json" \
                -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}" \
                "$SUPABASE_URL/auth/v1/token?grant_type=refresh_token"
        fi
        
        # Test 6: Sign Out
        echo ""
        echo "6️⃣ Testing Sign Out..."
        curl -s -w "\nStatus: %{http_code}\n" \
            -X POST \
            -H "apikey: $SUPABASE_ANON_KEY" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            "$SUPABASE_URL/auth/v1/logout"
    fi
else
    echo "❌ Sign in failed with status: $HTTP_STATUS"
    echo "Response: $RESPONSE_BODY"
fi

echo ""
echo "🏁 Auth endpoint testing complete"