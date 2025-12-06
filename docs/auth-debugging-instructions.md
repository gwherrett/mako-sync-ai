# Auth Debugging Instructions

## Overview
Comprehensive debugging tools have been created to isolate and diagnose auth issues through direct endpoint testing.

## Quick Start

### 1. Command Line Testing
```bash
# Make script executable
chmod +x scripts/debug-auth-endpoints.sh

# Run endpoint tests
./scripts/debug-auth-endpoints.sh
```

### 2. Web UI Testing
Navigate to: `http://localhost:3000/auth-debug`

### 3. Browser Console Testing
```javascript
// Available in browser console on any page
AuthDebugger.captureAuthState('manual-test');
AuthDebugger.testAuthEndpoints();
AuthDebugger.testSignIn('your-email@example.com', 'your-password');
AuthDebugger.testSignOut();
AuthDebugger.exportLogs();
```

## Debugging Workflow

### Step 1: Capture Current State
```javascript
// In browser console
AuthDebugger.captureAuthState('initial-state');
```

### Step 2: Test Basic Connectivity
```bash
# Command line
./scripts/debug-auth-endpoints.sh
```
Or in browser console:
```javascript
AuthDebugger.testAuthEndpoints();
```

### Step 3: Test Auth Flow
1. Go to `/auth-debug` page
2. Enter test credentials
3. Click "Test Sign In Flow"
4. Check console for detailed logs

### Step 4: Monitor State Changes
```javascript
// Start monitoring
const stopMonitoring = AuthDebugger.startMonitoring();

// Perform actions (login, logout, navigate)
// Check console for state change logs

// Stop monitoring
stopMonitoring();
```

## Key Issues to Check

### 1. Session Extension Window Pulsing
- **Expected**: Intentional `animate-pulse` CSS when `timeRemaining <= 1`
- **Check**: Console logs for "Session timer update" frequency
- **Fixed**: Timer optimization reduces unnecessary re-renders

### 2. Input Field Focus Loss
- **Check**: Console logs for "updateField called" and "Debounced validation triggered"
- **Look for**: Rapid state updates during typing

### 3. Edge Browser Sign-out Failure
- **Check**: Console logs showing "Browser: Edge" detection
- **Look for**: Fallback to local scope when global scope fails

### 4. Blank Pages After Auth Actions
- **Check**: Auth state capture before/after actions
- **Look for**: Session/user state inconsistencies
- **Monitor**: Route changes and protected route logic

## Debug Data Collection

### Export Debug Logs
```javascript
// Get formatted logs
const logs = AuthDebugger.exportLogs();
console.log(logs);

// Or download as file from /auth-debug page
```

### Key Data Points
- Session state (expires_at, access_token presence)
- User state (email, email_confirmed_at)
- Browser storage (localStorage, sessionStorage)
- Network requests (success/failure status)
- Route navigation (current URL, redirects)

## Common Patterns to Look For

### 1. Session Expiry Issues
```javascript
// Check if session is expired
const session = await supabase.auth.getSession();
const expiresAt = new Date(session.data.session?.expires_at * 1000);
const isExpired = expiresAt < new Date();
console.log('Session expired:', isExpired);
```

### 2. Storage Persistence Issues
```javascript
// Check browser storage
console.log('localStorage:', Object.fromEntries(
  Object.entries(localStorage).filter(([k]) => k.includes('supabase'))
));
```

### 3. Network Connectivity
```javascript
// Test direct API calls
fetch(`${SUPABASE_URL}/auth/v1/user`, {
  headers: { 'apikey': SUPABASE_ANON_KEY }
}).then(r => console.log('API Status:', r.status));
```

## Troubleshooting Steps

### If Endpoints Fail
1. Check `.env` file for correct Supabase URL/keys
2. Verify network connectivity
3. Check Supabase dashboard for service status
4. Test with curl directly

### If Auth State is Inconsistent
1. Clear browser storage: `localStorage.clear(); sessionStorage.clear();`
2. Check for multiple auth contexts
3. Verify auth provider initialization
4. Monitor auth state change events

### If Routes Show Blank Pages
1. Check protected route logic
2. Verify auth redirect hooks
3. Monitor React component mounting
4. Check for JavaScript errors in console

## Advanced Debugging

### Network Tab Analysis
1. Open browser DevTools → Network tab
2. Filter by "auth" or "supabase"
3. Look for failed requests or unexpected responses
4. Check request/response headers

### React DevTools
1. Install React DevTools extension
2. Check component state in auth context
3. Monitor prop changes in protected routes
4. Verify hook dependencies

### Supabase Dashboard
1. Check Auth → Users for user state
2. Review Auth → Settings for configuration
3. Monitor Logs for server-side errors
4. Verify RLS policies if applicable

## Expected Outputs

### Successful Auth Flow
```
✅ Health Check: 200 OK
✅ Auth User Endpoint: 200 OK  
✅ Sign In Success: user@example.com
✅ Session Valid: expires in X minutes
✅ Sign Out Success
```

### Failed Auth Flow
```
❌ Health Check Failed: Network error
❌ Sign In Error: Invalid credentials
❌ Session Expired: Token invalid
❌ Sign Out Error: Already signed out
```

## Next Steps Based on Results

### If Endpoints Work But UI Fails
- Focus on React component state management
- Check auth context initialization
- Verify protected route logic

### If Endpoints Fail
- Check Supabase configuration
- Verify network connectivity
- Test with different browsers

### If Browser-Specific Issues
- Compare localStorage/sessionStorage between browsers
- Check cookie handling differences
- Test in incognito/private mode

## Support Information

When reporting issues, include:
1. Exported debug logs from AuthDebugger
2. Browser console output
3. Network tab screenshots
4. Steps to reproduce
5. Expected vs actual behavior

The debugging tools provide comprehensive visibility into the auth flow to isolate whether issues are frontend, backend, or integration-related.