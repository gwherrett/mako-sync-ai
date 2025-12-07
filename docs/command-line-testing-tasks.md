# Command Line Testing Task List

## Overview
This document provides a comprehensive, easy-to-follow command line testing task list based on the auth debugging instructions. Each task has clear pass/fail criteria for systematic testing of the Mako Sync authentication system.

## Prerequisites

### Environment Setup
Before running any tests, ensure your environment is properly configured:

```bash
# Verify .env file exists and contains required variables
cat .env | grep -E "(VITE_SUPABASE_URL|VITE_SUPABASE_ANON_KEY)"
```

**Expected Output:** Both variables should be present and non-empty
- ✅ **PASS:** Both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are visible
- ❌ **FAIL:** Either variable is missing or empty

---

## Test Categories

### 1. Environment Setup Verification

#### Task 1.1: Verify Script Permissions
```bash
# Make debug script executable
chmod +x scripts/debug-auth-endpoints.sh
ls -la scripts/debug-auth-endpoints.sh
```

**Pass Criteria:**
- ✅ **PASS:** File shows executable permissions (`-rwxr-xr-x` or similar)
- ❌ **FAIL:** File lacks executable permissions

#### Task 1.2: Verify Environment Variables
```bash
# Check environment variables are loaded
./scripts/debug-auth-endpoints.sh | head -10
```

**Pass Criteria:**
- ✅ **PASS:** Script displays Supabase URL and truncated anon key
- ❌ **FAIL:** Script shows "Missing Supabase environment variables" error

---

### 2. Basic Connectivity Tests

#### Task 2.1: Supabase Health Check
```bash
# Test basic Supabase connectivity
curl -s -w "\nStatus: %{http_code}\n" \
    -H "apikey: $VITE_SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
    "$VITE_SUPABASE_URL/rest/v1/"
```

**Pass Criteria:**
- ✅ **PASS:** Returns HTTP status 200
- ❌ **FAIL:** Returns any other status code or connection error

#### Task 2.2: Auth Endpoint Accessibility
```bash
# Test auth endpoint accessibility
curl -s -w "\nStatus: %{http_code}\n" \
    -H "apikey: $VITE_SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    "$VITE_SUPABASE_URL/auth/v1/user"
```

**Pass Criteria:**
- ✅ **PASS:** Returns HTTP status 200 or 401 (endpoint accessible)
- ❌ **FAIL:** Returns 404, 500, or connection timeout

---

### 3. Authentication Flow Tests

#### Task 3.1: Complete Auth Endpoint Test
```bash
# Run comprehensive auth endpoint test
./scripts/debug-auth-endpoints.sh
```

**Interactive Input Required:**
- Enter a valid test email when prompted
- Enter the corresponding password when prompted

**Pass Criteria:**
- ✅ **PASS:** All 6 tests complete successfully:
  1. Health Check: 200 OK
  2. Auth Session Endpoint: 200 OK
  3. Sign In: 200 OK with access token
  4. Authenticated Request: 200 OK
  5. Session Refresh: 200 OK
  6. Sign Out: 200 OK
- ❌ **FAIL:** Any test fails or returns unexpected status code

#### Task 3.2: Invalid Credentials Test
```bash
# Test with invalid credentials
echo "Testing invalid credentials..."
curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "apikey: $VITE_SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{"email":"invalid@test.com","password":"wrongpassword"}' \
    "$VITE_SUPABASE_URL/auth/v1/token?grant_type=password"
```

**Pass Criteria:**
- ✅ **PASS:** Returns HTTP status 400 or 401 with error message
- ❌ **FAIL:** Returns 200 (should not authenticate invalid credentials)

---

### 4. Session Management Tests

#### Task 4.1: Session Persistence Test
```bash
# Test session persistence across requests
# First, sign in and capture access token
SIGNIN_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "apikey: $VITE_SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{"email":"YOUR_TEST_EMAIL","password":"YOUR_TEST_PASSWORD"}' \
    "$VITE_SUPABASE_URL/auth/v1/token?grant_type=password")

# Extract access token
ACCESS_TOKEN=$(echo "$SIGNIN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

# Test multiple authenticated requests
for i in {1..3}; do
    echo "Request $i:"
    curl -s -w "Status: %{http_code}\n" \
        -H "apikey: $VITE_SUPABASE_ANON_KEY" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        "$VITE_SUPABASE_URL/auth/v1/user"
done
```

**Pass Criteria:**
- ✅ **PASS:** All 3 requests return HTTP status 200
- ❌ **FAIL:** Any request fails or returns 401

#### Task 4.2: Token Refresh Test
```bash
# Test token refresh functionality
# (Requires valid refresh token from previous sign-in)
REFRESH_TOKEN=$(echo "$SIGNIN_RESPONSE" | grep -o '"refresh_token":"[^"]*' | cut -d'"' -f4)

curl -s -w "\nStatus: %{http_code}\n" \
    -X POST \
    -H "apikey: $VITE_SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}" \
    "$VITE_SUPABASE_URL/auth/v1/token?grant_type=refresh_token"
```

**Pass Criteria:**
- ✅ **PASS:** Returns HTTP status 200 with new access token
- ❌ **FAIL:** Returns error status or invalid response

---

### 5. Browser Console Tests

#### Task 5.1: AuthDebugger Availability Test
```javascript
// Open browser console and run:
typeof AuthDebugger !== 'undefined' && typeof AuthDebugger.captureAuthState === 'function'
```

**Pass Criteria:**
- ✅ **PASS:** Returns `true`
- ❌ **FAIL:** Returns `false` or throws error

#### Task 5.2: Auth State Capture Test
```javascript
// In browser console:
AuthDebugger.captureAuthState('manual-test').then(state => {
    console.log('Auth state captured:', !!state);
    console.log('Has session:', !!state.session);
    console.log('Has user:', !!state.user);
    console.log('Supabase config:', state.supabaseConfig);
});
```

**Pass Criteria:**
- ✅ **PASS:** Successfully captures state without errors, shows config status
- ❌ **FAIL:** Throws error or returns null/undefined

#### Task 5.3: Endpoint Test via Console
```javascript
// In browser console:
AuthDebugger.testAuthEndpoints().then(() => {
    console.log('Endpoint tests completed - check console for results');
});
```

**Pass Criteria:**
- ✅ **PASS:** All endpoint tests complete without throwing errors
- ❌ **FAIL:** Throws JavaScript errors or fails to complete

#### Task 5.4: Browser Storage Inspection Test
```javascript
// In browser console:
AuthDebugger.captureAuthState('storage-test').then(state => {
    console.log('LocalStorage keys:', Object.keys(state.localStorage));
    console.log('SessionStorage keys:', Object.keys(state.sessionStorage));
    console.log('Cookies present:', !!state.cookies);
    
    // Check for Supabase-specific storage
    const supabaseKeys = Object.keys(state.localStorage).filter(key =>
        key.includes('supabase') || key.includes('auth')
    );
    console.log('Supabase auth keys:', supabaseKeys);
});
```

**Pass Criteria:**
- ✅ **PASS:** Shows storage contents, identifies Supabase auth keys
- ❌ **FAIL:** Throws error or cannot access storage

#### Task 5.5: Browser Info Validation Test
```javascript
// In browser console:
const browserInfo = AuthDebugger.getBrowserInfo();
console.log('Browser detection:', {
    userAgent: browserInfo.userAgent,
    isChrome: browserInfo.isChrome,
    isFirefox: browserInfo.isFirefox,
    isSafari: browserInfo.isSafari,
    isEdge: browserInfo.isEdge,
    cookieEnabled: browserInfo.cookieEnabled,
    onLine: browserInfo.onLine
});
```

**Pass Criteria:**
- ✅ **PASS:** Returns complete browser info object with boolean flags
- ❌ **FAIL:** Missing properties or throws error

#### Task 5.6: Auth State Monitoring Test
```javascript
// In browser console:
console.log('Starting auth monitoring...');
const stopMonitoring = AuthDebugger.startMonitoring();

// Let it run for a few seconds, then stop
setTimeout(() => {
    stopMonitoring();
    console.log('Monitoring stopped');
}, 5000);
```

**Pass Criteria:**
- ✅ **PASS:** Monitoring starts and stops without errors
- ❌ **FAIL:** Throws error or monitoring doesn't function

#### Task 5.7: Sign-In Flow Test (if credentials available)
```javascript
// In browser console (replace with actual test credentials):
AuthDebugger.testSignIn('test@example.com', 'testpassword').then(() => {
    console.log('Sign-in test completed - check console for detailed results');
});
```

**Pass Criteria:**
- ✅ **PASS:** Completes sign-in test, captures before/after states
- ❌ **FAIL:** Throws error or fails to complete flow

#### Task 5.8: Sign-Out Flow Test
```javascript
// In browser console (only if currently signed in):
AuthDebugger.testSignOut().then(() => {
    console.log('Sign-out test completed - check console for detailed results');
});
```

**Pass Criteria:**
- ✅ **PASS:** Completes sign-out test, captures before/after states
- ❌ **FAIL:** Throws error or fails to complete flow

#### Task 5.9: Debug Log Export Test
```javascript
// In browser console:
const logs = AuthDebugger.exportLogs();
console.log('Exported logs length:', logs.length);
console.log('Logs contain data:', logs.includes('timestamp'));

// Test log clearing
AuthDebugger.clearLogs();
const clearedLogs = AuthDebugger.exportLogs();
console.log('Logs after clearing:', clearedLogs);
```

**Pass Criteria:**
- ✅ **PASS:** Exports logs as JSON string, clearing works properly
- ❌ **FAIL:** Export fails or clearing doesn't work

#### Task 5.10: Environment Configuration Test
```javascript
// In browser console:
AuthDebugger.captureAuthState('env-test').then(state => {
    const config = state.supabaseConfig;
    console.log('Environment check:', {
        hasUrl: config.url !== 'NOT_SET',
        hasAnonKey: config.anonKey === 'SET',
        urlFormat: config.url.startsWith('https://') && config.url.includes('supabase'),
        timestamp: state.timestamp,
        userAgent: state.userAgent.substring(0, 50) + '...'
    });
});
```

**Pass Criteria:**
- ✅ **PASS:** Shows proper environment configuration, valid URL format
- ❌ **FAIL:** Missing configuration or invalid URL format

#### Task 5.11: Complete Console Test Suite
```javascript
// In browser console - comprehensive test runner:
async function runCompleteConsoleTests() {
    console.log('🧪 Starting Complete Console Test Suite...');
    
    try {
        // Test 1: Availability
        console.log('1. Testing AuthDebugger availability...');
        const available = typeof AuthDebugger !== 'undefined';
        console.log(available ? '✅ AuthDebugger available' : '❌ AuthDebugger not available');
        
        // Test 2: State capture
        console.log('2. Testing state capture...');
        const state = await AuthDebugger.captureAuthState('console-suite');
        console.log(state ? '✅ State captured' : '❌ State capture failed');
        
        // Test 3: Endpoints
        console.log('3. Testing endpoints...');
        await AuthDebugger.testAuthEndpoints();
        console.log('✅ Endpoint tests completed');
        
        // Test 4: Browser info
        console.log('4. Testing browser info...');
        const browserInfo = AuthDebugger.getBrowserInfo();
        console.log(browserInfo.userAgent ? '✅ Browser info available' : '❌ Browser info failed');
        
        // Test 5: Log management
        console.log('5. Testing log management...');
        const logs = AuthDebugger.exportLogs();
        console.log(logs.length > 0 ? '✅ Logs exported' : '❌ No logs to export');
        
        console.log('🎉 Console test suite completed successfully!');
        return true;
        
    } catch (error) {
        console.error('❌ Console test suite failed:', error);
        return false;
    }
}

// Run the complete test suite
runCompleteConsoleTests();
```

**Pass Criteria:**
- ✅ **PASS:** All 5 sub-tests pass, returns `true`
- ❌ **FAIL:** Any sub-test fails or throws error

#### Browser Console Tests Summary

**Quick Console Test Checklist:**
```javascript
// Paste this into browser console for rapid testing:
console.log('AuthDebugger available:', typeof AuthDebugger !== 'undefined');
AuthDebugger.captureAuthState('quick-test').then(s => console.log('State captured:', !!s));
AuthDebugger.testAuthEndpoints();
console.log('Browser info:', AuthDebugger.getBrowserInfo().userAgent.substring(0, 50));
```

**Expected Console Output Pattern:**
```
🔍 AUTH DEBUG: Capturing state for quick-test
✅ Health Check: 200 OK
🔐 Auth User Endpoint: 200 {...}
📱 Supabase Client Session: {...}
🔍 AUTH DEBUG SUMMARY: {...}
```

**Common Console Test Failures:**
- `AuthDebugger is not defined` → Frontend not loaded properly
- `Cannot read properties of undefined` → Supabase client not initialized
- `Network request failed` → Connectivity or CORS issues
- `Invalid API key` → Environment configuration problems

---

### 6. Web UI Testing

#### Task 6.1: Auth Debug Page Access
```bash
# Start development server (if not running)
npm run dev

# Then navigate to: http://localhost:3000/auth-debug
```

**Pass Criteria:**
- ✅ **PASS:** Page loads without errors, shows Auth Debug Panel
- ❌ **FAIL:** Page shows 404, blank screen, or JavaScript errors

#### Task 6.2: Quick Tests Functionality
**Manual Steps:**
1. Navigate to `http://localhost:3000/auth-debug`
2. Click "Capture Auth State" button
3. Click "Test Endpoints" button
4. Check browser console for output

**Pass Criteria:**
- ✅ **PASS:** Both buttons execute without errors, console shows debug output
- ❌ **FAIL:** Buttons don't respond or throw JavaScript errors

#### Task 6.3: Manual Sign-In Test
**Manual Steps:**
1. Go to "Manual Tests" tab
2. Enter valid test credentials
3. Click "Test Sign In Flow"
4. Check console and UI for results

**Pass Criteria:**
- ✅ **PASS:** Sign-in completes, auth status updates, no errors in console
- ❌ **FAIL:** Sign-in fails, errors in console, or UI doesn't update

---

### 7. Error Handling Tests

#### Task 7.1: Network Connectivity Test
```bash
# Test with invalid Supabase URL
INVALID_URL="https://invalid-url.supabase.co"
curl -s -w "\nStatus: %{http_code}\n" \
    -H "apikey: $VITE_SUPABASE_ANON_KEY" \
    --connect-timeout 10 \
    "$INVALID_URL/rest/v1/"
```

**Pass Criteria:**
- ✅ **PASS:** Returns connection error or timeout (expected behavior)
- ❌ **FAIL:** Unexpectedly succeeds or hangs indefinitely

#### Task 7.2: Invalid API Key Test
```bash
# Test with invalid API key
curl -s -w "\nStatus: %{http_code}\n" \
    -H "apikey: invalid-key-12345" \
    -H "Authorization: Bearer invalid-key-12345" \
    "$VITE_SUPABASE_URL/rest/v1/"
```

**Pass Criteria:**
- ✅ **PASS:** Returns HTTP status 401 or 403 (unauthorized)
- ❌ **FAIL:** Returns 200 (should reject invalid key)

---

### 8. Integration Tests

#### Task 8.1: Full Auth Flow Integration
```bash
# Complete end-to-end auth flow test
echo "Starting full auth flow test..."

# 1. Health check
echo "1. Health check..."
HEALTH_STATUS=$(curl -s -w "%{http_code}" -o /dev/null \
    -H "apikey: $VITE_SUPABASE_ANON_KEY" \
    "$VITE_SUPABASE_URL/rest/v1/")

# 2. Sign in
echo "2. Sign in..."
SIGNIN_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "apikey: $VITE_SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{"email":"YOUR_TEST_EMAIL","password":"YOUR_TEST_PASSWORD"}' \
    "$VITE_SUPABASE_URL/auth/v1/token?grant_type=password")

# 3. Extract tokens
ACCESS_TOKEN=$(echo "$SIGNIN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
REFRESH_TOKEN=$(echo "$SIGNIN_RESPONSE" | grep -o '"refresh_token":"[^"]*' | cut -d'"' -f4)

# 4. Authenticated request
echo "3. Authenticated request..."
AUTH_STATUS=$(curl -s -w "%{http_code}" -o /dev/null \
    -H "apikey: $VITE_SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    "$VITE_SUPABASE_URL/auth/v1/user")

# 5. Token refresh
echo "4. Token refresh..."
REFRESH_STATUS=$(curl -s -w "%{http_code}" -o /dev/null \
    -X POST \
    -H "apikey: $VITE_SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}" \
    "$VITE_SUPABASE_URL/auth/v1/token?grant_type=refresh_token")

# 6. Sign out
echo "5. Sign out..."
SIGNOUT_STATUS=$(curl -s -w "%{http_code}" -o /dev/null \
    -X POST \
    -H "apikey: $VITE_SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    "$VITE_SUPABASE_URL/auth/v1/logout")

# Results
echo "=== INTEGRATION TEST RESULTS ==="
echo "Health Check: $HEALTH_STATUS"
echo "Sign In: $(echo "$SIGNIN_RESPONSE" | tail -n 1 | cut -d: -f2)"
echo "Authenticated Request: $AUTH_STATUS"
echo "Token Refresh: $REFRESH_STATUS"
echo "Sign Out: $SIGNOUT_STATUS"
```

**Pass Criteria:**
- ✅ **PASS:** All status codes are 200
- ❌ **FAIL:** Any status code is not 200

---

### 9. Performance and Monitoring Tests

#### Task 9.1: Response Time Test
```bash
# Test response times for auth endpoints
echo "Testing auth endpoint response times..."

for i in {1..5}; do
    echo "Test $i:"
    curl -s -w "Time: %{time_total}s, Status: %{http_code}\n" -o /dev/null \
        -H "apikey: $VITE_SUPABASE_ANON_KEY" \
        "$VITE_SUPABASE_URL/auth/v1/user"
done
```

**Pass Criteria:**
- ✅ **PASS:** All responses complete within 5 seconds
- ❌ **FAIL:** Any response takes longer than 5 seconds

#### Task 9.2: Concurrent Request Test
```bash
# Test handling of concurrent auth requests
echo "Testing concurrent requests..."

for i in {1..3}; do
    curl -s -w "Request $i: %{http_code}\n" -o /dev/null \
        -H "apikey: $VITE_SUPABASE_ANON_KEY" \
        "$VITE_SUPABASE_URL/auth/v1/user" &
done

wait
echo "All concurrent requests completed"
```

**Pass Criteria:**
- ✅ **PASS:** All requests return status 200 or 401 (no 500 errors)
- ❌ **FAIL:** Any request returns 500 or times out

---

### 10. Troubleshooting Verification

#### Task 10.1: Debug Log Export Test
**Manual Steps:**
1. Navigate to `http://localhost:3000/auth-debug`
2. Perform several auth actions (capture state, test endpoints)
3. Go to "Debug Logs" tab
4. Click "Export Logs" button

**Pass Criteria:**
- ✅ **PASS:** JSON file downloads with debug information
- ❌ **FAIL:** Export fails or file is empty

#### Task 10.2: Browser Storage Inspection
```javascript
// In browser console:
const authKeys = Object.keys(localStorage).filter(key => 
    key.includes('supabase') || key.includes('auth')
);
console.log('Auth-related localStorage keys:', authKeys);

authKeys.forEach(key => {
    console.log(`${key}:`, localStorage.getItem(key));
});
```

**Pass Criteria:**
- ✅ **PASS:** Shows Supabase auth tokens and session data
- ❌ **FAIL:** No auth-related data found or access denied

#### Task 10.3: Network Tab Verification
**Manual Steps:**
1. Open browser DevTools → Network tab
2. Filter by "auth" or "supabase"
3. Perform sign-in action
4. Check network requests

**Pass Criteria:**
- ✅ **PASS:** Auth requests visible with proper headers and responses
- ❌ **FAIL:** No requests visible or requests show errors

---

## Quick Test Summary

### Essential Tests (Run First)
```bash
# 1. Environment check
cat .env | grep -E "(VITE_SUPABASE_URL|VITE_SUPABASE_ANON_KEY)"

# 2. Basic connectivity
curl -s -w "\nStatus: %{http_code}\n" \
    -H "apikey: $VITE_SUPABASE_ANON_KEY" \
    "$VITE_SUPABASE_URL/rest/v1/"

# 3. Full auth test
./scripts/debug-auth-endpoints.sh

# 4. Web UI test
# Navigate to http://localhost:3000/auth-debug
```

### Expected Success Pattern
```
✅ Environment variables present
✅ Health check: 200 OK
✅ Auth endpoints: 200 OK
✅ Sign in: 200 OK with tokens
✅ Authenticated requests: 200 OK
✅ Token refresh: 200 OK
✅ Sign out: 200 OK
✅ Web UI loads and functions
```

### Common Failure Patterns
```
❌ Missing environment variables → Check .env file
❌ Health check fails → Network/Supabase connectivity issue
❌ Auth endpoints 404 → Incorrect Supabase URL
❌ Sign in fails → Invalid credentials or auth configuration
❌ Token refresh fails → Session/token management issue
❌ Web UI errors → Frontend build or routing issue
```

---

## Support Information

When reporting issues, include:
1. Which specific task failed
2. Exact error messages or status codes
3. Browser console output (for UI tests)
4. Network tab screenshots (for connectivity issues)
5. Exported debug logs from AuthDebugger
6. Environment details (browser, OS, network)

This comprehensive testing approach ensures systematic verification of all authentication components and provides clear diagnostic information for troubleshooting.