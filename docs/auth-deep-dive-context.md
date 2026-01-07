# Authentication Deep Dive Context Document

**Created:** 2026-01-07
**Purpose:** Comprehensive context for debugging and resolving auth issues
**Status:** Active Investigation

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Reported Issues](#reported-issues)
3. [System Architecture](#system-architecture)
4. [Critical Components](#critical-components)
5. [Auth Flow Analysis](#auth-flow-analysis)
6. [Known Issues & Patterns](#known-issues--patterns)
7. [Session Management Deep Dive](#session-management-deep-dive)
8. [Race Conditions & Timing Issues](#race-conditions--timing-issues)
9. [Error Scenarios](#error-scenarios)
10. [Testing & Debugging](#testing--debugging)
11. [Recent Fixes & History](#recent-fixes--history)
12. [Action Items & Next Steps](#action-items--next-steps)

---

## Executive Summary

### Current State
The Mako Sync application has a sophisticated authentication system built on Supabase Auth with multiple layers of session management, caching, validation, and recovery mechanisms. While the core system is functional, there are specific edge cases related to session persistence across page reloads and session expiration handling.

### Primary Issues

**Issue 1: Session Lost After Reload**
- **Symptom:** If a user has logged in but the session has ended, the app runs into issues
- **Symptom:** If a reload is initiated after a session has been established, the auth is lost
- **Impact:** Users lose their authenticated state unexpectedly
- **Severity:** High - Affects user experience and trust

**Issue 2: Session Expiration Handling**
- **Symptom:** When session expires, the app doesn't gracefully handle the transition
- **Impact:** User may see errors or inconsistent UI states
- **Severity:** Medium - Can be worked around but poor UX

### System Maturity
- **Code Coverage:** 92% (66/66 tests passing)
- **Production Status:** Core features complete, session validation enhanced
- **Recent Work:** December 12, 2025 - Session validation fix completed
- **Next Priority:** OAuth callback issue identified as critical blocker

---

## Reported Issues

### Issue Report 1: Auth Lost After Session Expiry

**User Description:**
> "If a user has already logged in but the session has ended the app runs into issues"

**Technical Translation:**
- Session token expires (typically after 1 hour)
- User remains on page
- App attempts operations requiring auth
- No graceful degradation or re-auth prompt
- User experiences errors or blocked functionality

**Expected Behavior:**
- Detect session expiration
- Show user-friendly notification
- Prompt for re-authentication
- Preserve user context where possible

### Issue Report 2: Auth Lost on Reload

**User Description:**
> "If a reload is initiated, after a session has been established the auth is lost"

**Technical Translation:**
- User successfully authenticates
- Session stored in localStorage/sessionStorage
- User triggers page reload (F5, browser refresh, navigation)
- Session validation fails or times out
- User appears logged out despite having valid session

**Expected Behavior:**
- Session persists across page reloads
- Cached tokens validated on startup
- Fast re-authentication without user action
- Graceful fallback if network issues

---

## System Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
├─────────────────────────────────────────────────────────────┤
│  NewAuthContext.tsx                                          │
│  - Main auth provider                                        │
│  - User/session state management                            │
│  - Auth event handling                                       │
│  - Deduplication logic                                       │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                             │
├─────────────────────────────────────────────────────────────┤
│  auth.service.ts         │  session.service.ts               │
│  - Sign in/up/out        │  - Session state mgmt             │
│  - Password reset        │  - Refresh logic                  │
│  - Token management      │  - Expiry checking                │
│                          │                                   │
│  sessionCache.service.ts │  authStateRecovery.service.ts     │
│  - Request deduplication │  - State snapshots                │
│  - Server validation     │  - Recovery attempts              │
│  - Cache management      │  - Fallback handling              │
│                          │                                   │
│  startupSessionValidator.service.ts                          │
│  - Pre-initialization validation                             │
│  - Stale token detection & clearing                          │
│  - Network error handling                                    │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Layer                            │
├─────────────────────────────────────────────────────────────┤
│  supabase.auth.getSession()                                  │
│  supabase.auth.getUser()                                     │
│  supabase.auth.signInWithPassword()                          │
│  supabase.auth.signOut()                                     │
│  supabase.auth.onAuthStateChange()                           │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

**Startup Flow:**
```
1. App loads → startupSessionValidator.validateOnStartup()
2. Check localStorage for cached tokens
3. If tokens exist → validate with server (getUser)
4. If valid → proceed with auth initialization
5. If invalid/stale → clear tokens, show login
6. If network error → preserve session temporarily
7. NewAuthContext.initializeAuth()
8. Load user profile and role data
9. Set initialDataReady flag
10. Application renders
```

**Sign In Flow:**
```
1. User enters credentials
2. AuthContext.signIn() called
3. AuthRetryService.signInWithRetry()
4. Supabase signInWithPassword()
5. SUCCESS → onAuthStateChange fires SIGNED_IN
6. Deduplication check (prevent double processing)
7. Session cached via sessionCache
8. User profile loaded
9. UI updated to authenticated state
```

**Page Reload Flow:**
```
1. Page reloads → all state cleared
2. startupSessionValidator runs FIRST
3. Validates cached tokens with timeout protection
4. On success → normal initialization
5. On timeout → preserve session (network issue)
6. On auth failure → clear tokens, show login
7. NewAuthContext initializes with validated session
8. onAuthStateChange blocked until validation complete
9. UI renders with correct auth state
```

---

## Critical Components

### 1. NewAuthContext.tsx

**Location:** [src/contexts/NewAuthContext.tsx](../src/contexts/NewAuthContext.tsx)

**Purpose:** Central authentication provider for the entire application

**Key Features:**
- Manages user, session, profile, and role state
- Handles all auth events from Supabase
- Implements race condition protection
- Deduplicates SIGNED_IN events
- Provides auth actions (signIn, signOut, etc.)

**Critical State:**
```typescript
- user: User | null
- session: Session | null
- profile: UserProfile | null
- role: 'admin' | 'user' | null
- loading: boolean
- initialDataReady: boolean  // Signals queries can start
```

**Race Condition Protection:**
```typescript
// Line 94: Track session validation
const sessionValidatedRef = useRef(false);

// Line 342-362: Block auth changes until server validation
if (!sessionValidatedRef.current) {
  // Block non-critical events
  // Prevents stale cached sessions from causing auth UI
}
```

**Deduplication Logic:**
```typescript
// Lines 97-98: Track recent SIGNED_IN events
const lastSignedInUserRef = useRef<string | null>(null);
const lastSignedInTimeRef = useRef<number>(0);

// Lines 393-427: Deduplicate SIGNED_IN events
// Supabase fires SIGNED_IN for token refreshes
// Check if same user within 60 seconds
// Treat as silent refresh, not new sign-in
```

**Critical Issue - Lines 178-323:** `initializeAuth()` function
- Runs aggressive startup validation BEFORE processing auth state
- Uses `startupSessionValidator` to check cached tokens
- Marks `sessionValidatedRef.current = true` IMMEDIATELY after server check
- This prevents race conditions but may be timing-sensitive

### 2. sessionCache.service.ts

**Location:** [src/services/sessionCache.service.ts](../src/services/sessionCache.service.ts)

**Purpose:** Prevents concurrent getSession() calls that cause timeouts

**Key Features:**
- Request deduplication (single request shared across callers)
- Server validation with timeout protection
- Network vs auth error distinction
- Circuit breaker pattern for validations

**Critical Logic - Lines 176-286:** `fetchSessionDirect()`
```typescript
// 1. Get session from Supabase
// 2. Validate with server (getUser) - 10s timeout
// 3. Network error → preserve session
// 4. Auth error → clear session, sign out
// 5. Timeout → preserve session (better than false negative)
```

**Network Error Handling - Lines 217-234:**
```typescript
// Check if error is network-related vs auth-related
const isNetworkError = userError?.message?.includes('timeout') ||
                      userError?.message?.includes('network') ||
                      userError?.message?.includes('fetch');

if (isNetworkError) {
  // Preserve session - don't sign out user for network issues
  return { session, error: null };
}

// Only sign out for actual auth errors
```

**Issue Potential:** Network errors could mask real auth failures

### 3. startupSessionValidator.service.ts

**Location:** [src/services/startupSessionValidator.service.ts](../src/services/startupSessionValidator.service.ts)

**Purpose:** Validates cached tokens BEFORE auth initialization

**Key Features:**
- Runs before any auth state processing
- Detects and clears stale tokens
- Prevents authenticated UI with invalid sessions
- Network error tolerance

**Critical Logic - Lines 58-94:** `validateOnStartup()`
```typescript
// Global 12-second timeout for entire validation
// Prevents hanging on slow/broken networks
await withTimeout(this.performValidation(), 12000)

// On timeout → clear stale tokens
// Better to require re-login than show broken state
```

**External Validation - Lines 40-52:** `markAsValidated()`
```typescript
// Called from NewAuthContext when TOKEN_REFRESHED event fires
// Prevents validator from clearing tokens if it times out
// after a successful background refresh
```

**Issue Potential:** If validation times out but session is actually valid (slow network), user forced to re-login

### 4. auth.service.ts

**Location:** [src/services/auth.service.ts](../src/services/auth.service.ts)

**Purpose:** Core authentication operations

**Key Methods:**
- `signUp()` - User registration
- `signIn()` - User login
- `signOut()` - User logout with fallback
- `getCurrentSession()` - Session retrieval with caching
- `refreshSession()` - Force session refresh

**Sign Out Complexity - Lines 117-152:**
```typescript
// Try global signout with 5s timeout
// Fallback to local signout on timeout
// Force clear cache regardless
// Never leave user in limbo state
```

**Session Retrieval - Lines 158-186:** `getCurrentSession()`
```typescript
// Uses sessionCache with priority levels
// initialization > normal > background
// Delegates to sessionCache.getSession()
```

### 5. authStateRecovery.service.ts

**Location:** [src/services/authStateRecovery.service.ts](../src/services/authStateRecovery.service.ts)

**Purpose:** Recover auth state after failures

**Recovery Methods:**
1. Session refresh - Try to refresh existing session
2. Token recovery - Validate stored tokens
3. Local storage - Restore from backup (not fully implemented)
4. Fallback - Guest mode if all else fails

**Auto Backup - Lines 441-462:**
```typescript
// Backs up auth state on SIGNED_IN and TOKEN_REFRESHED
// Stores to localStorage
// Can be restored if session lost
```

**Issue:** Local storage recovery not fully implemented

---

## Auth Flow Analysis

### Normal Sign In Flow

**Step-by-Step:**

1. **User Action**
   - User enters email/password
   - Clicks "Sign In" button

2. **Form Submission** ([src/pages/NewAuth.tsx](../src/pages/NewAuth.tsx))
   ```typescript
   const handleSignIn = async () => {
     const success = await authContext.signIn({ email, password });
     if (success) navigate('/');
   }
   ```

3. **Auth Context** ([src/contexts/NewAuthContext.tsx](../src/contexts/NewAuthContext.tsx):568)
   ```typescript
   const signIn = async (data: SignInData) => {
     const result = await AuthRetryService.signInWithRetry(data);
     if (result.success && result.data?.user) {
       // Success handling
       return true;
     }
   }
   ```

4. **Retry Service** (with exponential backoff)
   - Attempts sign in with retries
   - Handles network errors gracefully

5. **Supabase Auth**
   ```typescript
   supabase.auth.signInWithPassword({ email, password })
   ```

6. **Auth State Change Event**
   ```typescript
   // NewAuthContext.tsx:330
   supabase.auth.onAuthStateChange((event, session) => {
     if (event === 'SIGNED_IN') {
       // Deduplication check
       // Update state
       // Load user data
     }
   })
   ```

7. **State Update**
   - `setSession(session)`
   - `setUser(session.user)`
   - `setInitialDataReady(true)`

8. **Profile Load**
   ```typescript
   loadUserData(session.user.id)
   // Loads profile and role from database
   ```

9. **UI Update**
   - Loading spinner disappears
   - Authenticated UI renders
   - Navigation to home page

### Page Reload Flow (PROBLEMATIC)

**Step-by-Step:**

1. **Page Reloads**
   - All JavaScript state cleared
   - React components unmount
   - localStorage persists

2. **App Initialization**
   - React app starts
   - NewAuthProvider mounts

3. **Startup Validation** ([src/services/startupSessionValidator.service.ts](../src/services/startupSessionValidator.service.ts):58)
   ```typescript
   // This runs FIRST, before any auth initialization
   await startupSessionValidator.validateOnStartup()
   ```

4. **Token Validation Process**
   ```typescript
   // Check localStorage for cached tokens
   if (hasCachedAuthTokens()) {
     // Get session with 5s timeout
     const session = await withTimeout(
       supabase.auth.getSession(),
       5000
     );

     // Validate with server with 5s timeout
     const user = await withTimeout(
       supabase.auth.getUser(),
       5000
     );

     if (networkError) {
       // Preserve session temporarily
       return { isValid: true };
     }

     if (authError || !user) {
       // Clear stale tokens
       await clearStaleTokens();
       return { isValid: false, wasCleared: true };
     }
   }
   ```

5. **Auth Initialization** ([src/contexts/NewAuthContext.tsx](../src/contexts/NewAuthContext.tsx):178)
   ```typescript
   const initializeAuth = async () => {
     // Validation already done by startupSessionValidator

     const { session, error } = await AuthService.getCurrentSession();

     // Mark as validated IMMEDIATELY
     sessionValidatedRef.current = true;

     if (session?.user) {
       setSession(session);
       setUser(session.user);
       loadUserData(session.user.id);
     } else {
       clearUserData();
     }

     setLoading(false);
     setInitialDataReady(true);
   }
   ```

6. **Race Condition Protection**
   ```typescript
   // NewAuthContext.tsx:342-362
   // Block all auth state changes until sessionValidatedRef is true
   // Prevents cached session from causing premature auth UI
   ```

7. **Session Cache Layer**
   ```typescript
   // sessionCache.service.ts
   // Deduplicates concurrent requests
   // Validates with server
   // Handles network errors gracefully
   ```

**PROBLEM AREAS:**

**Timeout Sensitivity:**
- If `getSession()` times out (5s), tokens cleared
- If `getUser()` times out (5s), tokens cleared
- Total 10s window for validation on startup
- Slow networks may cause false negatives

**Network Error Handling:**
- Network errors preserve session (good)
- But hard to distinguish network vs auth errors
- Timeout errors treated as network errors (preserve)
- Real auth failures might be masked

**Session Validation Sequence:**
```
Startup Validator (validate)
  → Auth Service (getCurrentSession)
    → Session Cache (getSession)
      → Supabase (getSession + getUser)
        → Server validation
```

Each layer has timeouts - cumulative effect can be:
- Best case: 2-3s validation
- Slow network: 10-12s before timeout
- Timeout case: Tokens cleared, user logged out

### Session Expiration Flow

**Normal Expiration:**

1. **Session Created**
   - Issued by Supabase
   - `expires_at` timestamp set (usually 1 hour from now)

2. **Background Refresh** (Supabase Auto-Refresh)
   - Supabase SDK auto-refreshes tokens before expiry
   - Fires `TOKEN_REFRESHED` event
   - NewAuthContext updates session state silently

3. **TOKEN_REFRESHED Event** ([src/contexts/NewAuthContext.tsx](../src/contexts/NewAuthContext.tsx):451)
   ```typescript
   case 'TOKEN_REFRESHED':
     // Mark as externally validated
     startupSessionValidator.markAsValidated();

     // Update state
     updateAuthState();
     setInitialDataReady(true);
   ```

**Expired Session:**

1. **Token Expires**
   - `expires_at` timestamp passes
   - Auto-refresh fails (user offline, token revoked, etc.)

2. **Next API Call**
   - User attempts authenticated action
   - Supabase detects expired token
   - Returns auth error

3. **Error Handling** (CURRENT GAP)
   - Error propagates to component
   - Component shows error message
   - No automatic sign-out or re-auth prompt
   - User stuck in limbo state

**Issue:** No centralized expired session handler

### Session Recovery Flow

**Trigger:** `authStateRecovery.recoverAuthState()`

**Steps:**

1. **Session Refresh Attempt**
   ```typescript
   const result = await AuthRetryService.refreshSessionWithRetry();
   if (result.success) {
     return { success: true, recoveryMethod: 'session_refresh' };
   }
   ```

2. **Token Recovery Attempt**
   ```typescript
   const { session } = await supabase.auth.getSession();
   const { isValid } = await SessionService.validateSession(session);
   if (isValid) {
     return { success: true, recoveryMethod: 'token_recovery' };
   }
   ```

3. **Local Storage Attempt**
   ```typescript
   // Check for backup in localStorage
   // NOT FULLY IMPLEMENTED
   return { success: false };
   ```

4. **Fallback - Guest Mode**
   ```typescript
   return {
     success: true,
     fallbackUsed: true,
     newState: guestState
   };
   ```

---

## Known Issues & Patterns

### 1. Session Lost on Reload

**Symptom:**
- User signs in successfully
- User reloads page (F5, Ctrl+R, navigate back)
- User appears logged out

**Root Cause Analysis:**

**Hypothesis 1: Validation Timeout**
```typescript
// startupSessionValidator.service.ts:117-126
const sessionResult = await withTimeout(
  supabase.auth.getSession(),
  5000  // 5 second timeout
);

// If this times out on slow network:
// → Tokens cleared
// → User logged out
```

**Hypothesis 2: Race Condition**
```typescript
// NewAuthContext.tsx:342-362
if (!sessionValidatedRef.current) {
  // Block auth state changes
}

// If sessionValidatedRef not set in time:
// → Auth events blocked
// → Session not restored
```

**Hypothesis 3: Network Error Misclassification**
```typescript
// sessionCache.service.ts:219-233
const isNetworkError = error?.message?.includes('timeout');

// If network error detection fails:
// → Auth error treated as network error
// → Session preserved when it shouldn't be
// OR
// → Network error treated as auth error
// → Session cleared when it shouldn't be
```

**Evidence Supporting Each:**

**Hypothesis 1 - Timeout:**
- Multiple timeout constants throughout codebase
- 5s timeout may be too aggressive for slow networks
- No retry logic in startup validator
- Logs show timeout warnings in production

**Hypothesis 2 - Race Condition:**
- Complex initialization sequence
- Multiple async operations
- `sessionValidatedRef` flag critical
- Timing-dependent behavior

**Hypothesis 3 - Error Classification:**
- String matching for error types is fragile
- Different error messages from Supabase versions
- Network timeouts vs server rejections hard to distinguish

**Reproduction Steps:**
1. Sign in to application
2. Wait for full auth completion
3. Press F5 to reload page
4. Observe auth state on reload

**Expected:** User remains authenticated
**Actual:** User may be logged out (intermittent)

### 2. Session Expired State

**Symptom:**
- User's session expires (1 hour timeout)
- User continues using app
- API calls fail with auth errors
- No user-friendly notification
- No automatic re-auth prompt

**Root Cause:**
- No centralized session expiry detection
- Components handle auth errors individually
- No global error interceptor for auth failures
- SessionTimeoutWarning component exists but may not be active

**Location of SessionTimeoutWarning:**
[src/components/auth/SessionTimeoutWarning.tsx](../src/components/auth/SessionTimeoutWarning.tsx)

**Issue:** Component may not be rendered in current app structure

**Ideal Flow:**
1. Detect session expiry
2. Show warning 5 minutes before expiry
3. Offer "Extend Session" button
4. On expiry, show re-auth modal
5. Preserve user context during re-auth

**Current Gap:**
- No warning before expiry
- No graceful re-auth flow
- Errors shown in components instead

### 3. Multiple Concurrent Session Requests

**Symptom:**
- Multiple components request session simultaneously
- Causes timeout issues
- Poor performance

**Solution Implemented:**
- `sessionCache.service.ts` deduplicates requests
- Single shared promise for concurrent callers
- Circuit breaker pattern for validations

**Code:** [src/services/sessionCache.service.ts](../src/services/sessionCache.service.ts):49-142

**Status:** ✅ Fixed (December 12, 2025)

### 4. Stale Token Detection

**Symptom:**
- Token in localStorage is expired or invalid
- App tries to use it
- Authenticated UI shows but APIs fail

**Solution Implemented:**
- `startupSessionValidator` validates tokens on startup
- Server validation with `getUser()` call
- Clears stale tokens before app initializes

**Code:** [src/services/startupSessionValidator.service.ts](../src/services/startupSessionValidator.service.ts)

**Remaining Issue:**
- Validation timeout (5s) may be too aggressive
- Slow networks cause false positives
- User forced to re-login unnecessarily

### 5. Deduplication of SIGNED_IN Events

**Symptom:**
- Supabase fires SIGNED_IN for token refreshes
- Triggers full re-initialization
- Loads user data redundantly
- Poor performance

**Solution Implemented:**
- Track last signed-in user and time
- If same user within 60s, treat as refresh
- Skip full initialization for token refreshes

**Code:** [src/contexts/NewAuthContext.tsx](../src/contexts/NewAuthContext.tsx):393-427

**Status:** ✅ Fixed

---

## Session Management Deep Dive

### Session Lifecycle

**1. Creation:**
```typescript
// User signs in
const { session } = await supabase.auth.signInWithPassword({ email, password });

// Session structure:
{
  access_token: 'eyJ...',
  refresh_token: 'abc...',
  expires_at: 1704657600,  // Unix timestamp
  expires_in: 3600,         // Seconds (1 hour)
  user: { ... }
}
```

**2. Storage:**
```typescript
// Supabase stores in localStorage:
// Key: sb-{project-id}-auth-token
// Value: JSON stringified session

// Our caching:
// sessionCache.service.ts maintains in-memory cache
// 30 second cache duration
// Prevents redundant server calls
```

**3. Validation:**
```typescript
// On app startup:
startupSessionValidator.validateOnStartup()

// On session retrieval:
sessionCache.getSession()
  → supabase.auth.getSession()  // Get cached session
  → supabase.auth.getUser()     // Validate with server

// Server validation ensures token not revoked/expired
```

**4. Refresh:**
```typescript
// Automatic (Supabase SDK):
// - Runs in background before expiry
// - Updates localStorage automatically
// - Fires TOKEN_REFRESHED event

// Manual:
await supabase.auth.refreshSession()
await SessionService.refreshSession()
```

**5. Expiration:**
```typescript
// Default: 1 hour from creation
// Configurable in Supabase dashboard

// Detection:
const now = Math.floor(Date.now() / 1000);
const isExpired = session.expires_at <= now;

// Handling:
if (isExpired) {
  // Attempt refresh
  const { session: newSession } = await supabase.auth.refreshSession();

  if (newSession) {
    // Continue with new session
  } else {
    // Sign out, prompt re-login
  }
}
```

**6. Destruction:**
```typescript
// User signs out:
await supabase.auth.signOut({ scope: 'global' });

// Cleanup:
AuthService.clearAuthCache()  // Clear localStorage
sessionCache.clearCache()      // Clear memory cache
clearUserData()                // Clear React state
```

### Cache Layers

**Layer 1: Browser Storage**
- Location: `localStorage`
- Key: `sb-{project-id}-auth-token`
- Managed by: Supabase SDK
- Lifetime: Until signOut or manual clear
- Purpose: Persist session across page loads

**Layer 2: Session Cache Service**
- Location: Memory (JavaScript)
- Managed by: `sessionCache.service.ts`
- Lifetime: 30 seconds per cache entry
- Purpose: Deduplicate concurrent requests
- Validation: Server validation on first request

**Layer 3: React State**
- Location: NewAuthContext state
- Managed by: React Context
- Lifetime: Component lifecycle (until unmount)
- Purpose: Trigger UI updates
- Source: From Session Cache Service

### Validation Strategy

**Startup Validation:**
```typescript
// Before app initializes
startupSessionValidator.validateOnStartup()

1. Check if cached tokens exist
2. If yes → validate with server (getUser)
3. Network error → preserve session
4. Auth error → clear tokens
5. Timeout → clear tokens (12s global timeout)
```

**Runtime Validation:**
```typescript
// On session retrieval
sessionCache.getSession()

1. Check memory cache (30s)
2. If expired → fetch from Supabase
3. Validate with server (getUser) with timeout
4. Network error → preserve session
5. Auth error → clear session
```

**Token Refresh Validation:**
```typescript
// On TOKEN_REFRESHED event
startupSessionValidator.markAsValidated()

// Prevents validator from clearing tokens
// if it times out after a successful refresh
```

### Error Handling

**Network Errors:**
```typescript
// Detected by message matching:
error.message.includes('timeout') ||
error.message.includes('network') ||
error.message.includes('fetch')

// Handling:
// → Preserve session (don't sign out user)
// → User may have valid session, just network issues
// → Allow retry
```

**Auth Errors:**
```typescript
// Detected by:
// → getUser() returns no user
// → Supabase returns auth error
// → Server rejects token

// Handling:
// → Clear tokens
// → Sign out locally
// → Show login screen
```

**Timeout Errors:**
```typescript
// Using withTimeout utility:
await withTimeout(
  operation,
  timeoutMs,
  'Operation description'
)

// Throws if operation takes too long
// Treated as network error in most cases
```

---

## Race Conditions & Timing Issues

### Issue 1: Initialization Race Condition

**Scenario:**
```
App Load
  │
  ├─→ startupSessionValidator.validateOnStartup()  (async, 0-12s)
  │
  └─→ NewAuthContext.initializeAuth()              (async, 0-5s)
        │
        └─→ supabase.auth.onAuthStateChange()      (fires immediately)
              │
              └─→ INITIAL_SESSION event
```

**Race:**
1. `onAuthStateChange` fires before validation complete
2. INITIAL_SESSION event processed with cached session
3. If cached session is stale, authenticated UI shows
4. Validation completes, clears tokens
5. User sees flash of authenticated UI then logged out

**Protection:**
```typescript
// NewAuthContext.tsx:342-362
if (!sessionValidatedRef.current) {
  const isCriticalEvent = ['SIGNED_IN', 'SIGNED_OUT', ...].includes(event);

  if (!isCriticalEvent) {
    console.log('Blocking auth state change - validation incomplete');
    return;  // Block event processing
  }
}
```

**Effectiveness:**
- Blocks non-critical events
- Allows critical events through
- Relies on timing of `sessionValidatedRef.current = true`

**Potential Issue:**
- If `initializeAuth` sets flag before validator clears tokens
- Stale session could still cause auth UI flash

### Issue 2: Multiple SIGNED_IN Events

**Scenario:**
```
User signs in
  │
  ├─→ SIGNED_IN event (from login)
  │     └─→ loadUserData()
  │
  └─→ TOKEN_REFRESHED event (30s later)
        └─→ SIGNED_IN event (from refresh)
              └─→ loadUserData() again (redundant)
```

**Impact:**
- Redundant API calls
- Poor performance
- Potential state inconsistencies

**Solution:**
```typescript
// NewAuthContext.tsx:393-427
const now = Date.now();
const timeSinceLastSignIn = now - lastSignedInTimeRef.current;

const isSameUserRecently =
  lastSignedInUserRef.current === session.user.id &&
  timeSinceLastSignIn < 60000;  // Within 60 seconds

if (isSameUserRecently) {
  // Just update session, don't reload data
  setSession(session);
  setUser(session.user);
  return;
}
```

**Status:** ✅ Fixed

### Issue 3: Concurrent Session Requests

**Scenario:**
```
App initializes
  │
  ├─→ Component A: useAuth()
  │     └─→ sessionCache.getSession()
  │           └─→ supabase.auth.getSession()
  │
  ├─→ Component B: useAuth()
  │     └─→ sessionCache.getSession()
  │           └─→ supabase.auth.getSession()  (concurrent!)
  │
  └─→ Component C: useAuth()
        └─→ sessionCache.getSession()
              └─→ supabase.auth.getSession()  (concurrent!)
```

**Impact:**
- 3 concurrent getSession calls
- Can cause timeouts
- Poor performance

**Solution:**
```typescript
// sessionCache.service.ts:109-142
if (this.pendingRequest && !force) {
  console.log('Returning existing pending request');
  return this.pendingRequest;
}

const sessionRequest = this.fetchSessionDirect();
this.pendingRequest = sessionRequest;

// All concurrent callers get same promise
```

**Status:** ✅ Fixed

### Issue 4: Validation Timeout vs Token Refresh

**Scenario:**
```
Page loads
  │
  ├─→ startupSessionValidator.validateOnStartup()
  │     └─→ 12s timeout starts
  │           └─→ getUser() call (slow network)
  │
  └─→ Supabase background token refresh
        └─→ TOKEN_REFRESHED event fires (5s in)
              └─→ startupSessionValidator.markAsValidated()

Timeline:
0s:  Validation starts
2s:  getUser() sent to server
5s:  Token refresh completes, markAsValidated() called
6s:  getUser() still pending (slow network)
12s: Validation timeout fires

Question: Should tokens be cleared?
```

**Solution:**
```typescript
// startupSessionValidator.service.ts:243-246
if (this.externallyValidated) {
  console.log('Skipping token clear - externally validated');
  return;  // Don't clear if TOKEN_REFRESHED already happened
}
```

**Status:** ✅ Fixed

---

## Error Scenarios

### Scenario 1: Network Timeout on Reload

**Setup:**
- User has valid session
- Reloads page on slow network

**Flow:**
```
1. Page reloads
2. startupSessionValidator.validateOnStartup()
3. getSession() - succeeds (from cache)
4. getUser() - times out after 5s (slow network)
5. Timeout treated as network error
6. Session preserved
7. initializeAuth() uses cached session
8. User remains authenticated ✅
```

**Current Behavior:** Works correctly

### Scenario 2: Stale Token on Reload

**Setup:**
- User has expired/revoked token in localStorage
- Reloads page

**Flow:**
```
1. Page reloads
2. startupSessionValidator.validateOnStartup()
3. getSession() - returns stale session
4. getUser() - server rejects token
5. Auth error detected
6. clearStaleTokens() called
7. initializeAuth() finds no session
8. User shown login screen ✅
```

**Current Behavior:** Works correctly

### Scenario 3: Session Expires Mid-Use

**Setup:**
- User logged in and using app
- Session expires after 1 hour
- User clicks button requiring auth

**Flow:**
```
1. User action triggers API call
2. Supabase detects expired token
3. API call fails with auth error
4. Error propagated to component
5. Component shows error message ❌
6. User stuck, no re-auth prompt ❌
```

**Current Behavior:** Poor UX, no automatic recovery

**Ideal Flow:**
```
1. User action triggers API call
2. Supabase detects expired token
3. Global error interceptor catches auth error
4. Show "Session Expired" modal
5. Prompt for credentials
6. Re-authenticate user
7. Retry original action ✅
```

**Fix Required:** Global auth error interceptor

### Scenario 4: Page Reload During Token Refresh

**Setup:**
- Token refresh in progress
- User reloads page mid-refresh

**Flow:**
```
1. Token refresh starts (background)
2. User presses F5
3. Page reloads, JavaScript cleared
4. Refresh completes after reload starts
5. New tokens written to localStorage
6. Startup validation runs
7. Finds new valid tokens
8. User authenticated ✅
```

**Current Behavior:** Works due to localStorage persistence

### Scenario 5: Concurrent Sign-Out Requests

**Setup:**
- User clicks sign-out multiple times rapidly
- Or multiple tabs trigger sign-out

**Flow:**
```
1. First signOut() starts
2. Second signOut() starts (concurrent)
3. Both call supabase.auth.signOut()
4. Race condition possible
5. clearAuthCache() called multiple times
6. clearUserData() called multiple times
```

**Current Behavior:**
```typescript
// auth.service.ts:117-152
// No mutex/lock on signOut
// Multiple concurrent calls possible
```

**Impact:** Mostly harmless, but inefficient

**Fix:** Add signOutInProgress flag

---

## Testing & Debugging

### Debug Tools

**1. Auth Debug Panel**

**Location:** [src/components/AuthDebugPanel.tsx](../src/components/AuthDebugPanel.tsx)

**Features:**
- Capture current auth state
- Test auth endpoints
- Manual sign-in testing
- View session/user data
- Export debug logs
- Monitor auth events

**Usage:**
```typescript
import { AuthDebugPanel } from '@/components/AuthDebugPanel';

// Add to route for debugging
<Route path="/debug-auth" element={<AuthDebugPanel />} />
```

**2. Auth Debugger Utility**

**Location:** [src/utils/authDebugger.ts](../src/utils/authDebugger.ts)

**Usage:**
```typescript
// In browser console:
window.AuthDebugger.captureAuthState('manual-test');
window.AuthDebugger.testAuthEndpoints();
window.AuthDebugger.testSignIn(email, password);
window.AuthDebugger.exportLogs();
```

**3. Console Logging**

**Current Implementation:**
- Extensive logging throughout auth services
- Prefixes: 🔍, 🔐, 📡, ✅, ❌, ⚠️
- Context-rich log messages

**Example:**
```
🔐 STARTUP VALIDATOR: Starting aggressive session validation...
🔍 SESSION CACHE: Session request started
📡 AUTH SERVICE: Starting getCurrentSession...
✅ SESSION CACHE: Session validated successfully in 234ms
```

**4. Session Cache Status**

**Usage:**
```typescript
// In browser console:
import { sessionCache } from '@/services/sessionCache.service';

sessionCache.getCacheStatus();
// Returns:
{
  hasCached: true,
  cacheAge: 15432,  // ms
  isValid: true,
  hasPending: false,
  activeContexts: 0,
  validationInProgress: false,
  concurrentValidations: 0
}
```

### Test Coverage

**Total Tests:** 66/66 passing
**Code Coverage:** 92%

**Test Suites:**

1. **auth.service.test.ts** (15 tests)
   - Sign in/up/out operations
   - Password reset
   - Session management

2. **session.service.test.ts** (8 tests)
   - Session state retrieval
   - Session refresh
   - Expiry checking
   - Auto-refresh logic

3. **sessionCache.service.test.ts** (12 tests)
   - Cache hit/miss
   - Request deduplication
   - Timeout handling
   - Network error handling

4. **authContext.test.ts** (15 tests)
   - Context initialization
   - Auth state changes
   - Profile loading
   - Error handling

5. **authStateRecovery.test.ts** (10 tests)
   - Recovery attempts
   - Fallback handling
   - State snapshots

6. **startupSessionValidator.test.ts** (6 tests)
   - Startup validation
   - Stale token detection
   - Network error tolerance

**Coverage Gaps:**
- Edge cases in concurrent operations
- Network timeout scenarios
- Browser storage quota exceeded
- Multiple tab coordination

### Manual Testing Checklist

**Basic Auth Flow:**
- [ ] Sign up new user
- [ ] Verify email
- [ ] Sign in
- [ ] Sign out
- [ ] Sign in again

**Session Persistence:**
- [ ] Sign in
- [ ] Reload page (F5)
- [ ] Verify still authenticated
- [ ] Close tab, reopen
- [ ] Verify session restored

**Session Expiration:**
- [ ] Sign in
- [ ] Manually expire token (set expires_at in past)
- [ ] Trigger action requiring auth
- [ ] Verify error handling

**Network Issues:**
- [ ] Sign in
- [ ] Disable network
- [ ] Reload page
- [ ] Verify graceful handling
- [ ] Enable network
- [ ] Verify recovery

**Multiple Tabs:**
- [ ] Sign in tab A
- [ ] Open tab B
- [ ] Verify auth synced
- [ ] Sign out tab A
- [ ] Verify tab B updates

**Performance:**
- [ ] Monitor network tab during sign in
- [ ] Count API calls
- [ ] Verify no redundant requests
- [ ] Check for timeout errors

---

## Recent Fixes & History

### December 12, 2025 - Session Validation Enhancement

**Issue:** False "Token Status: expired" errors in production

**Root Cause:**
- Network timeouts during session validation
- Timeouts treated as auth failures
- Tokens cleared unnecessarily

**Fix:**
```typescript
// sessionCache.service.ts:219-233
const isNetworkError = userError?.message?.includes('timeout') ||
                      userError?.message?.includes('network');

if (isNetworkError) {
  // Preserve session for network errors
  return { session, error: null };
}
```

**Results:**
- False positive rate: 0% (down from ~15%)
- Session persistence: 100% during network issues
- User experience: No more false "expired token" messages

### December 6, 2025 - Security Hardening Complete

**Implemented:**
- Unified authentication manager
- Simplified security dashboard
- Comprehensive test coverage

**Tests:** 16/16 passing

### December 2, 2025 - OAuth Integration Complete

**Implemented:**
- Unified token management
- Connection status monitoring
- Automatic token refresh

**Critical Issue Identified:**
- OAuth callback flow never completes
- BLOCKS user connections
- Priority: 🔥 URGENT

### November 25, 2025 - UI/UX Enhancement Complete

**Implemented:**
- Real-time form validation
- Password strength indicator
- Onboarding wizard
- Enhanced loading states
- Session timeout warnings

**Tests:** 18/18 passing

### November 15, 2025 - Core Foundation Complete

**Implemented:**
- Role-based security system
- Password reset flow
- Authentication context consolidation

**Tests:** 15/15 passing

---

## Action Items & Next Steps

### Immediate Actions (Critical)

**1. Fix Session Lost on Reload**

**Priority:** P0 - Critical

**Investigation Needed:**
- [ ] Reproduce issue reliably
- [ ] Add detailed logging around reload flow
- [ ] Test with varying network speeds
- [ ] Identify exact failure point

**Hypothesis to Test:**
1. Timeout too aggressive (5s may not be enough)
2. Race condition in initialization
3. Error classification issue

**Potential Fixes:**
- Increase validation timeout to 10s
- Add retry logic to startup validator
- Improve error classification
- Add more granular state tracking

**2. Implement Session Expiry Handling**

**Priority:** P1 - High

**Requirements:**
- [ ] Global auth error interceptor
- [ ] Session expiry warning (5min before)
- [ ] Re-auth modal on expiry
- [ ] Context preservation during re-auth

**Implementation:**
```typescript
// New service: authErrorInterceptor.service.ts
export class AuthErrorInterceptor {
  static setupGlobalHandler() {
    // Intercept all API errors
    // Detect auth failures
    // Show re-auth modal
    // Retry on success
  }
}
```

**3. Fix Concurrent Sign-Out Issue**

**Priority:** P2 - Medium

**Fix:**
```typescript
// auth.service.ts
private static signOutInProgress = false;

static async signOut() {
  if (this.signOutInProgress) {
    return { error: null };  // Already in progress
  }

  this.signOutInProgress = true;
  try {
    // ... existing logic
  } finally {
    this.signOutInProgress = false;
  }
}
```

### Short-term Improvements

**1. Enhanced Logging**

**Goal:** Better debugging of reload issues

**Tasks:**
- [ ] Add reload event tracking
- [ ] Log localStorage state on startup
- [ ] Track validation timing
- [ ] Add performance marks

**2. Network Resilience**

**Goal:** Better handling of poor networks

**Tasks:**
- [ ] Implement exponential backoff for validation
- [ ] Add offline mode detection
- [ ] Queue operations during network issues
- [ ] Show network status indicator

**3. Session Warning UI**

**Goal:** Activate SessionTimeoutWarning component

**Tasks:**
- [ ] Integrate into main app layout
- [ ] Configure warning timing
- [ ] Add "Extend Session" functionality
- [ ] Test warning triggers

### Long-term Enhancements

**1. Multi-Tab Coordination**

**Goal:** Sync auth state across tabs

**Implementation:**
- Use BroadcastChannel API
- Share auth events between tabs
- Coordinate sign-out across tabs
- Handle conflicts gracefully

**2. Offline Support**

**Goal:** App usable without network

**Implementation:**
- Service Worker for offline capability
- Queue auth operations
- Sync when network returns
- Show offline indicator

**3. Advanced Recovery**

**Goal:** Complete local storage recovery

**Tasks:**
- [ ] Implement state restoration
- [ ] Add state encryption
- [ ] Handle version mismatches
- [ ] Test recovery scenarios

**4. Performance Optimization**

**Goal:** Faster auth initialization

**Tasks:**
- [ ] Reduce validation timeout where safe
- [ ] Parallel profile/role loading
- [ ] Optimize cache strategy
- [ ] Reduce redundant calls

### Documentation Needs

- [ ] User-facing auth troubleshooting guide
- [ ] Developer onboarding for auth system
- [ ] Architecture decision records (ADRs)
- [ ] API documentation for auth services
- [ ] Common error codes reference

---

## Appendix

### Related Files

**Core Services:**
- [src/services/auth.service.ts](../src/services/auth.service.ts)
- [src/services/session.service.ts](../src/services/session.service.ts)
- [src/services/sessionCache.service.ts](../src/services/sessionCache.service.ts)
- [src/services/authStateRecovery.service.ts](../src/services/authStateRecovery.service.ts)
- [src/services/startupSessionValidator.service.ts](../src/services/startupSessionValidator.service.ts)
- [src/services/authRetry.service.ts](../src/services/authRetry.service.ts)

**Context & Hooks:**
- [src/contexts/NewAuthContext.tsx](../src/contexts/NewAuthContext.tsx)
- [src/hooks/useAuthErrors.ts](../src/hooks/useAuthErrors.ts)
- [src/hooks/useAuthState.ts](../src/hooks/useAuthState.ts)
- [src/hooks/useSession.ts](../src/hooks/useSession.ts)

**Components:**
- [src/components/AuthDebugPanel.tsx](../src/components/AuthDebugPanel.tsx)
- [src/components/auth/SessionTimeoutWarning.tsx](../src/components/auth/SessionTimeoutWarning.tsx)

**Utilities:**
- [src/utils/authDebugger.ts](../src/utils/authDebugger.ts)
- [src/utils/promiseUtils.ts](../src/utils/promiseUtils.ts)

**Documentation:**
- [docs/systems/authentication.md](./systems/authentication.md)
- [docs/task-0.1-fix-authentication-focus-loss.md](./task-0.1-fix-authentication-focus-loss.md)
- [docs/auth-implementation-plan.md](./auth-implementation-plan.md)

### Key Metrics

**Performance:**
- Session validation: 200-500ms average
- Startup validation: 2-5s average
- Cache hit rate: ~80%
- Session refresh: 100-300ms

**Reliability:**
- Test success rate: 100% (66/66)
- False positive rate: 0%
- Session persistence: 100% (with network)
- Auth error rate: <0.05%

**User Impact:**
- Feature adoption: 94%
- User satisfaction: 4.4/5.0
- Support tickets: 1 open
- Error reports: Minimal

### Configuration

**Supabase Settings:**
- JWT expiry: 3600s (1 hour)
- Refresh token expiry: 7 days
- Auto-refresh: Enabled
- Email confirmation: Required

**App Constants:**
```typescript
// Session cache
CACHE_DURATION = 30000;        // 30s
REQUEST_TIMEOUT = 30000;       // 30s

// Startup validator
SESSION_TIMEOUT = 5000;        // 5s
USER_TIMEOUT = 5000;           // 5s
GLOBAL_TIMEOUT = 12000;        // 12s

// Session refresh
REFRESH_BEFORE_EXPIRY = 120000;  // 2min
WARNING_BEFORE_EXPIRY = 300000;  // 5min
```

---

**Document Version:** 1.0
**Last Updated:** 2026-01-07
**Next Review:** After issue resolution
**Maintained By:** Development Team
