# Auth Reload Issue - Fix Implementation Plan

**Issue:** P0 - Session Lost on Reload
**Created:** 2026-01-07
**Status:** Ready for Implementation

---

## Executive Summary

### Root Cause Identified

The session lost on reload issue has **three contributing factors**:

1. **Aggressive Timeouts** (Primary)
   - `getSession()` timeout: 5 seconds
   - `getUser()` timeout: 5 seconds
   - Global timeout: 12 seconds
   - On slow networks (3-6s responses), timeouts trigger
   - Timeouts cause token clearing → user logged out

2. **No Retry Logic** (Secondary)
   - Single validation attempt
   - Transient network issues cause permanent logout
   - No distinction between "slow" and "broken"

3. **Conservative Error Handling** (Tertiary)
   - On timeout → clear tokens (overly cautious)
   - Should: On timeout → preserve session, retry
   - Real auth errors mixed with network errors

### Proposed Solution

**3-Phase Fix:**

1. **Phase 1:** Enhanced logging and monitoring (✅ Complete)
2. **Phase 2:** Improved timeout handling with retries (Ready to implement)
3. **Phase 3:** Global auth error interceptor (Future enhancement)

---

## Phase 1: Enhanced Logging (✅ Complete)

### Files Created

1. **[src/utils/reloadDebugger.ts](../src/utils/reloadDebugger.ts)**
   - Tracks reload events
   - Captures localStorage state pre/post reload
   - Identifies when tokens are cleared
   - Exports detailed reports

2. **[src/__tests__/reloadAuth.test.ts](../src/__tests__/reloadAuth.test.ts)**
   - Test suite for reload scenarios
   - Timeout simulation tests
   - Error classification tests
   - Race condition tests

3. **[src/main.tsx](../src/main.tsx)** (Modified)
   - Initialize ReloadDebugger on startup
   - Active in dev mode or when `localStorage.mako_debug_reload=true`

### How to Use

```typescript
// In browser console after reload issue:
window.ReloadDebugger.printReport();
window.ReloadDebugger.exportReport(); // Copy as JSON
```

Expected output shows:
- Pre-reload auth state
- Post-reload auth state
- Whether tokens were cleared
- Timing information
- Potential issues identified

---

## Phase 2: Improved Validator (Ready to Implement)

### Changes Summary

| Aspect | Current | Proposed | Rationale |
|--------|---------|----------|-----------|
| `getSession` timeout | 5s | 8s | Accommodate slower networks |
| `getUser` timeout | 5s | 8s | Accommodate slower networks |
| Global timeout | 12s | 20s | Allow for retries |
| Retry logic | None | 2 retries | Handle transient issues |
| Retry delay | N/A | 1s | Allow network recovery |
| Timeout behavior | Clear tokens | Preserve session | User-friendly |
| Error classification | Basic | Enhanced | Better network detection |

### Key Improvements

**1. Retry Logic**
```typescript
// Before: Single attempt
const result = await performValidation();

// After: 3 attempts total (1 + 2 retries)
for (let attempt = 0; attempt <= maxRetries; attempt++) {
  try {
    return await performValidation();
  } catch (error) {
    if (attempt < maxRetries && isRetryable(error)) {
      await sleep(1000);
      continue;
    }
    // Preserve session if all retries exhausted
    return { isValid: true, wasCleared: false };
  }
}
```

**2. Adaptive Timeouts**
```typescript
// Before: Fixed 5s timeout
await withTimeout(operation, 5000);

// After: Increased to 8s, allows retries
await withTimeout(operation, 8000);
```

**3. Better Error Handling**
```typescript
// Before: Timeout → Clear tokens
if (isTimeout) {
  clearStaleTokens();
  return { wasCleared: true };
}

// After: Timeout → Preserve, retry
if (isTimeout) {
  throw error; // Trigger retry
}

// After all retries: Still preserve
return { isValid: true, wasCleared: false };
```

**4. Enhanced Network Detection**
```typescript
// Before: Simple string matching
error.message.includes('timeout')

// After: Comprehensive detection
isNetworkError(error) {
  return (
    message.includes('network') ||
    message.includes('offline') ||
    message.includes('unreachable') ||
    error.status === 0 ||
    error.status === 408 ||
    error.status === 504
  );
}
```

### Files to Modify

**1. Replace startupSessionValidator.service.ts**
```bash
# Backup current version
cp src/services/startupSessionValidator.service.ts \
   src/services/startupSessionValidator.service.backup.ts

# Replace with improved version
cp src/services/startupSessionValidator.improved.ts \
   src/services/startupSessionValidator.service.ts
```

**2. Update imports (no changes needed)**
- All imports remain the same
- Drop-in replacement

### Testing Plan

**1. Run Unit Tests**
```bash
npm run test src/__tests__/reloadAuth.test.ts
```

Expected: All tests pass

**2. Manual Testing - Slow Network**

```javascript
// In browser DevTools:
// 1. Go to Network tab
// 2. Set throttling to "Slow 3G"
// 3. Sign in
// 4. Reload page (F5)
// Expected: User remains logged in
```

**3. Manual Testing - Very Slow Network**

```javascript
// 1. Network tab → "Offline"
// 2. Wait 2 seconds
// 3. Enable "Slow 3G"
// 4. Reload page
// Expected: User remains logged in after ~8-10s
```

**4. Manual Testing - Actual Auth Error**

```javascript
// 1. Sign in
// 2. Manually expire token:
localStorage.setItem('sb-xxx-auth-token', JSON.stringify({
  ...currentToken,
  expires_at: Math.floor(Date.now() / 1000) - 3600
}));
// 3. Reload
// Expected: User logged out (tokens cleared)
```

**5. Reload Debugger Verification**

```javascript
// After each test:
window.ReloadDebugger.printReport();

// Check:
// - Was reload detected?
// - Were tokens present pre-reload?
// - Were tokens preserved post-reload?
// - Any issues identified?
```

---

## Phase 3: Global Error Interceptor (Future)

### Purpose
Handle session expiration during app usage (not just reload)

### Implementation (Future)

```typescript
// New file: src/services/authErrorInterceptor.service.ts

export class AuthErrorInterceptor {
  static setupGlobalHandler() {
    // Intercept Supabase errors
    // Detect auth failures
    // Show re-auth modal
    // Retry original request
  }
}
```

### Integration Points
- Supabase client wrapper
- API error handling
- Component error boundaries

---

## Implementation Steps

### Step 1: Backup and Prepare

```bash
# Backup current validator
cp src/services/startupSessionValidator.service.ts \
   src/services/startupSessionValidator.service.backup.ts

# Verify tests run
npm test src/__tests__/auth.service.test.ts
```

### Step 2: Deploy Improved Validator

```bash
# Replace validator
mv src/services/startupSessionValidator.improved.ts \
   src/services/startupSessionValidator.service.ts

# Restart dev server
npm run dev
```

### Step 3: Enable Debug Mode

```javascript
// In browser console:
localStorage.setItem('mako_debug_reload', 'true');

// Reload to activate
window.location.reload();
```

### Step 4: Test Scenarios

**Scenario A: Normal Network**
1. Sign in
2. Reload page
3. Verify: User stays logged in
4. Check: `window.ReloadDebugger.printReport()`
5. Expected: `validationTime` < 2000ms

**Scenario B: Slow Network**
1. Network throttling: Slow 3G
2. Sign in
3. Reload page
4. Verify: User stays logged in (after delay)
5. Check: Report shows `validationTime` 3000-8000ms

**Scenario C: Very Slow Network**
1. Network throttling: Slow 3G
2. Add extra delay with DevTools
3. Reload page
4. Verify: User stays logged in after 10-15s
5. Check: Report shows retries used

**Scenario D: Intermittent Network**
1. Sign in
2. Network: Offline for 2s
3. Network: Online
4. Reload immediately
5. Verify: User stays logged in after retry

**Scenario E: Expired Session**
1. Sign in
2. Manually expire token
3. Reload
4. Verify: User logged out cleanly
5. Check: Report shows "Session expired"

### Step 5: Monitor Production

**Metrics to Track:**
- Reload success rate
- Average validation time
- Retry usage rate
- Token clear rate
- User complaints

**Log Analysis:**
```bash
# Filter for validation logs
grep "IMPROVED VALIDATOR" logs.txt

# Count retries
grep "Retrying after" logs.txt | wc -l

# Check for token clears
grep "Clearing stale tokens" logs.txt
```

---

## Rollback Plan

If issues arise:

```bash
# Restore backup
cp src/services/startupSessionValidator.service.backup.ts \
   src/services/startupSessionValidator.service.ts

# Restart dev server
npm run dev

# Clear debug mode
localStorage.removeItem('mako_debug_reload');
```

---

## Success Criteria

**Primary:**
- [ ] User reload on slow network (3-6s) → stays logged in
- [ ] User reload on very slow network (6-10s) → stays logged in
- [ ] Actual expired session → logged out cleanly

**Secondary:**
- [ ] Average validation time < 3s on normal network
- [ ] Retry usage < 10% of validations
- [ ] Zero false-positive logouts
- [ ] User complaints reduced to 0

**Monitoring:**
- [ ] ReloadDebugger reports collected for 7 days
- [ ] No increase in auth errors
- [ ] Positive user feedback

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Increased validation time | Medium | Low | Acceptable for reliability |
| Hiding real auth errors | Low | High | Enhanced error classification |
| Memory leaks from retries | Low | Medium | Proper promise cleanup |
| Backwards compatibility | Low | Low | Drop-in replacement |

---

## Timeline

**Day 1:** (Today)
- ✅ Create enhanced logging
- ✅ Create improved validator
- ✅ Create test suite

**Day 2-3:**
- [ ] Deploy to dev environment
- [ ] Run manual test scenarios
- [ ] Collect reload debugger reports
- [ ] Verify no regressions

**Day 4-5:**
- [ ] Deploy to staging
- [ ] Beta user testing
- [ ] Monitor metrics

**Day 6-7:**
- [ ] Production deployment
- [ ] Monitor user feedback
- [ ] Adjust timeouts if needed

---

## Configuration Options

The improved validator supports runtime configuration:

```typescript
import { improvedStartupValidator } from '@/services/startupSessionValidator';

// Increase timeouts for very slow networks
improvedStartupValidator.updateConfig({
  getSessionTimeout: 10000,  // 10s
  getUserTimeout: 10000,     // 10s
  globalTimeout: 25000,      // 25s
  maxRetries: 3              // 3 retries
});

// Decrease for faster networks
improvedStartupValidator.updateConfig({
  getSessionTimeout: 5000,   // 5s
  getUserTimeout: 5000,      // 5s
  globalTimeout: 15000,      // 15s
  maxRetries: 1              // 1 retry
});
```

This allows environment-specific tuning without code changes.

---

## Related Issues

**Addressed by this fix:**
- Session lost on reload (Primary)
- False "expired session" messages
- Slow network timeouts

**Not addressed (future work):**
- Session expired during usage → Need Phase 3
- Multiple tab synchronization → Need BroadcastChannel
- Offline mode → Need Service Worker

---

## Appendix A: Comparison

### Before (Current Behavior)

```
User on slow network:
1. Sign in successfully
2. Reload page (F5)
3. startupValidator: getSession() → 3s
4. startupValidator: getUser() → 4s
5. Total: 7s > 5s timeout per operation
6. Timeout detected → clearStaleTokens()
7. User sees login screen ❌
```

### After (With Fix)

```
User on slow network:
1. Sign in successfully
2. Reload page (F5)
3. startupValidator: getSession() → 3s (within 8s timeout)
4. startupValidator: getUser() → 4s (within 8s timeout)
5. Total: 7s < 20s global timeout
6. Validation succeeds ✅
7. User stays logged in ✅
```

### After (Very Slow Network)

```
User on very slow network:
1. Sign in successfully
2. Reload page (F5)
3. Attempt 1: getUser() → timeout after 8s
4. Retry delay: 1s
5. Attempt 2: getUser() → timeout after 8s
6. Retry delay: 1s
7. Attempt 3: getUser() → success after 6s
8. Total: 24s but user stays logged in ✅
9. Alternative: If all fail → preserve session ✅
```

---

## Appendix B: Code Diff

### Key Changes

**1. Timeout Values**
```diff
- const timeout = 5000;
+ const timeout = 8000;
```

**2. Retry Loop**
```diff
+ for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await performValidation();
+     if (result.isValid) return result;
+   } catch (error) {
+     if (attempt < maxRetries) {
+       await sleep(retryDelay);
+       continue;
+     }
+   }
+ }
+ // Preserve session if all retries fail
+ return { isValid: true, wasCleared: false };
```

**3. Timeout Handling**
```diff
  } catch (timeoutError) {
-   await clearStaleTokens();
-   return { wasCleared: true };
+   throw timeoutError; // Trigger retry
  }
```

---

**Document Version:** 1.0
**Last Updated:** 2026-01-07
**Owner:** Development Team
**Status:** Ready for Implementation
