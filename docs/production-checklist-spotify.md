# Spotify Integration Production Checklist

**Status**: 🚨 **CRITICAL ISSUES IDENTIFIED** - Not Ready for Production  
**Priority**: P0 (Blocker)  
**Date**: 2025-12-09

---

## 🚨 CRITICAL ISSUES FOUND

### 1. **Environment Variable Mismatch**
- **Issue**: [`VITE_SPOTIFY_CLIENT_ID`](.env:5) is set to a hardcoded development client ID but documentation states this was supposed to be removed
- **Impact**: Using hardcoded development client ID in production
- **Fix Required**: Set proper production Spotify client ID

### 2. **Edge Function Callback Disabled**
- **Issue**: [`spotify-callback/index.ts`](supabase/functions/spotify-callback/index.ts:1-20) is completely disabled
- **Impact**: OAuth callback may fail if React routing doesn't handle all cases
- **Fix Required**: Verify React callback handling is bulletproof or re-enable edge function

### 3. **Missing Environment Variables Validation**
- **Issue**: No validation that all required environment variables are set in production
- **Impact**: Silent failures in production deployment
- **Fix Required**: Add pre-deployment validation script

---

## 📋 PRODUCTION DEPLOYMENT CHECKLIST

### Phase 1: Environment Configuration (CRITICAL)

#### Frontend Environment Variables
- [ ] **VITE_SPOTIFY_CLIENT_ID** - Set to production Spotify app client ID
  - Current: `hardcoded_dev_client_id` (appears to be dev/test ID)
  - Required: Actual production Spotify app client ID
  - Location: Vercel environment variables

- [ ] **VITE_SPOTIFY_REDIRECT_URI** - Set to production domain
  - Current: `https://mako-sync.vercel.app/spotify-callback`
  - Verify: Domain matches actual production deployment
  - Location: Vercel environment variables

- [ ] **VITE_SUPABASE_URL** - Production Supabase URL
  - Current: `https://your-project-id.supabase.co`
  - Status: ✅ Configured

- [ ] **VITE_SUPABASE_ANON_KEY** - Production Supabase anon key
  - Status: ✅ Configured

#### Backend Environment Variables (Supabase Edge Functions)
- [ ] **SPOTIFY_CLIENT_ID** - Must match frontend client ID
  - Location: Supabase Dashboard → Settings → Edge Functions → Environment Variables
  - Validation: Must match `VITE_SPOTIFY_CLIENT_ID`

- [ ] **SPOTIFY_CLIENT_SECRET** - Production Spotify app secret
  - Location: Supabase Dashboard → Settings → Edge Functions → Environment Variables
  - Security: Never expose in frontend code

- [ ] **SUPABASE_DB_URL** - Database connection string
  - Location: Supabase Dashboard → Settings → Database → Connection string (Direct)
  - Required for: Vault operations in [`spotify-auth/index.ts`](supabase/functions/spotify-auth/index.ts:238)

### Phase 2: Spotify Developer Dashboard Configuration

#### Spotify App Settings
- [ ] **App Type**: Web Application
- [ ] **Client ID**: Matches environment variables
- [ ] **Client Secret**: Securely stored in Supabase environment

#### Redirect URI Whitelist
- [ ] `https://mako-sync.vercel.app/spotify-callback` (production)
- [ ] `http://localhost:8080/spotify-callback` (development)
- [ ] `http://localhost:3000/spotify-callback` (development fallback)

#### App Permissions
- [ ] **Scopes Required**:
  - `user-read-private`
  - `user-read-email`
  - `user-library-read`
  - `playlist-read-private`
  - `playlist-read-collaborative`
  - `user-top-read`

### Phase 3: Supabase Configuration

#### Database Setup
- [ ] **Vault Extension Enabled**
  - Location: Supabase Dashboard → Database → Extensions
  - Search: "vault" and enable
  - Test: `SELECT vault.create_secret('test', 'value');`

- [ ] **Database Migrations Applied**
  - [ ] `20251205032300_user_roles_security.sql` (Phase 4 security)
  - [ ] `20251124221124_8c0acd2f-e542-474f-a262-c80cf65030e4.sql` (Cached genres)
  - Command: `supabase db push`

- [ ] **RLS Policies Active**
  - [ ] `spotify_connections` table policies
  - [ ] `user_roles` table policies
  - [ ] `has_role()` security definer function

#### Edge Functions Deployment
- [ ] **spotify-auth function deployed**
  - Command: `supabase functions deploy spotify-auth`
  - Verify: Handles vault token storage correctly

- [ ] **spotify-sync-liked function deployed**
  - Command: `supabase functions deploy spotify-sync-liked`
  - Features: Phase 4 flags (`refresh_only`, `health_check`, etc.)

- [ ] **spotify-callback function status**
  - Current: Disabled (returns 410 Gone)
  - Decision: Keep disabled if React routing handles all cases
  - Alternative: Re-enable with different name to avoid conflicts

### Phase 4: Security Validation

#### Token Storage Security
- [ ] **Vault Storage Verified**
  - Tokens stored as vault secret IDs, not plain text
  - Database shows `***ENCRYPTED_IN_VAULT***` placeholders
  - Test vault access with edge function

- [ ] **No Hardcoded Credentials**
  - [ ] No client secrets in frontend code
  - [ ] No hardcoded redirect URIs in edge functions
  - [ ] All credentials from environment variables

#### Authentication Security
- [ ] **User Role System**
  - Roles in separate `user_roles` table
  - `has_role()` function with SECURITY DEFINER
  - No privilege escalation possible

- [ ] **Session Security**
  - JWT tokens properly validated
  - Session timeout handling
  - Secure token refresh mechanism

### Phase 5: Functional Testing

#### OAuth Flow Testing
- [ ] **Connection Initiation**
  - Click "Connect Spotify" button
  - Redirects to Spotify OAuth (not login page)
  - State parameter properly generated and stored

- [ ] **OAuth Callback Handling**
  - Callback URL processes authorization code
  - State parameter validation works
  - Tokens stored securely in vault
  - User redirected back to app

- [ ] **Connection Status**
  - Shows "Spotify Connected" after successful auth
  - Connection persists across browser sessions
  - Status updates in real-time

#### Sync Operations Testing
- [ ] **Liked Songs Sync**
  - Sync completes without errors
  - Data appears in dashboard
  - Progress tracking works
  - Error handling for API failures

- [ ] **Token Refresh**
  - Automatic token refresh works
  - No user interruption during refresh
  - Failed refresh handled gracefully

### Phase 6: Performance & Monitoring

#### Performance Metrics
- [ ] **Connection Check Performance**
  - Target: < 2 seconds for connection status
  - Timeout: 3 seconds for user fetch, 2 seconds for DB query
  - Cooldown: 5-second limit prevents excessive calls

- [ ] **OAuth Flow Performance**
  - Target: < 10 seconds end-to-end
  - Redirect time: < 2 seconds
  - Token exchange: < 3 seconds

#### Error Monitoring
- [ ] **Edge Function Logs**
  - Location: Supabase Dashboard → Functions → Logs
  - Monitor: Token exchange failures, vault errors
  - Alerts: Set up for error rate > 5%

- [ ] **Client-Side Error Handling**
  - Console errors logged and categorized
  - User-friendly error messages
  - Retry mechanisms available

### Phase 7: User Experience Validation

#### UI/UX Testing
- [ ] **Connection Button**
  - Prominent and clearly labeled
  - Loading state during connection
  - Success state after connection

- [ ] **Error States**
  - Clear error messages (no technical jargon)
  - Actionable retry options
  - Help text for common issues

- [ ] **Mobile Compatibility**
  - OAuth flow works on mobile browsers
  - UI responsive on all screen sizes
  - Touch interactions work properly

---

## 🔧 PRE-DEPLOYMENT VALIDATION SCRIPT

Create this validation script to run before deployment:

```bash
#!/bin/bash
# production-validation.sh

echo "🔍 Validating Production Configuration..."

# Check environment variables
if [ -z "$VITE_SPOTIFY_CLIENT_ID" ]; then
  echo "❌ VITE_SPOTIFY_CLIENT_ID not set"
  exit 1
fi

if [ -z "$VITE_SPOTIFY_REDIRECT_URI" ]; then
  echo "❌ VITE_SPOTIFY_REDIRECT_URI not set"
  exit 1
fi

# Validate redirect URI format
if [[ ! "$VITE_SPOTIFY_REDIRECT_URI" =~ ^https:// ]]; then
  echo "❌ VITE_SPOTIFY_REDIRECT_URI must use HTTPS in production"
  exit 1
fi

# Check Supabase configuration
if [ -z "$VITE_SUPABASE_URL" ]; then
  echo "❌ VITE_SUPABASE_URL not set"
  exit 1
fi

# Build test
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Build failed"
  exit 1
fi

echo "✅ All validation checks passed"
```

---

## 🚨 DEPLOYMENT BLOCKERS

**These issues MUST be resolved before production deployment:**

1. **Fix Environment Variables**
   - Replace hardcoded client ID with production value
   - Verify all Supabase edge function environment variables are set

2. **Validate OAuth Callback Handling**
   - Test that React routing handles all OAuth callback scenarios
   - Consider re-enabling edge function callback as fallback

3. **Test Vault Integration**
   - Verify vault extension is enabled and working
   - Test token storage and retrieval in production environment

4. **Security Audit**
   - Ensure no credentials are exposed in client-side code
   - Verify RLS policies prevent unauthorized access

---

## 🎯 SUCCESS CRITERIA

### Functional Requirements
- [ ] OAuth success rate: 99%+
- [ ] Connection check: < 2 seconds average
- [ ] Token refresh: 99.9% success rate
- [ ] Sync operations: < 1% error rate

### Security Requirements
- [ ] 100% vault token storage (no plain text)
- [ ] No credential exposure in logs or client code
- [ ] Proper access control validation
- [ ] Secure session management

### User Experience Requirements
- [ ] Connection time: < 10 seconds
- [ ] Clear error messages with recovery options
- [ ] No technical jargon in user-facing messages
- [ ] Smooth loading states and transitions

---

## 📞 ROLLBACK PLAN

If critical issues are discovered:

### Immediate Actions (< 5 minutes)
1. **Disable Spotify Features**
   - Hide "Connect Spotify" buttons
   - Show maintenance message
   - Prevent new OAuth attempts

2. **Revert Environment Variables**
   - Restore previous working configuration
   - Redeploy with safe settings

### Full Rollback (< 15 minutes)
1. **Revert Code Changes**
   - Roll back to last known good commit
   - Redeploy application
   - Verify basic functionality

2. **Database Rollback**
   - Revert problematic migrations if needed
   - Restore from backup if necessary

---

**Next Action**: Address critical environment variable issues before proceeding with deployment.

**Estimated Fix Time**: 2-4 hours for complete resolution and validation.