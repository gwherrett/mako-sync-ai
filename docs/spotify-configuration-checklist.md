# Spotify App Configuration Verification Checklist

## Critical Configuration Items to Verify in Spotify Developer Dashboard

### 1. App Basic Information
- **Client ID**: Must exactly match `3bac088a26d64ddfb49d57fb5d451d71`
- **App Name**: Verify this is the correct production app
- **App Description**: Confirm this is the intended app

### 2. Redirect URIs (MOST CRITICAL)
**Must be EXACTLY registered (case-sensitive, character-perfect):**
```
https://mako-sync.vercel.app/spotify-callback
```

**Common Configuration Errors:**
- ❌ `https://mako-sync.vercel.app/spotify-callback/` (trailing slash)
- ❌ `https://www.mako-sync.vercel.app/spotify-callback` (www subdomain)
- ❌ `http://mako-sync.vercel.app/spotify-callback` (HTTP instead of HTTPS)
- ❌ `https://mako-sync.vercel.app/callback` (wrong path)

### 3. App Settings & Status
- **App Mode**: 
  - Development Mode: Only works for users explicitly added to the app
  - Extended Quota Mode: Works for 25 users
  - Production Mode: Works for all users (requires Spotify approval)
- **Current Status**: Check if app is active and not suspended

### 4. API Scopes
**Required scopes (verify these are enabled):**
```
user-read-private
user-read-email
user-library-read
playlist-read-private
playlist-read-collaborative
user-top-read
```

### 5. Client Secret
- **Exists**: Verify client secret is generated and active
- **Not Regenerated**: If recently regenerated, edge function needs update
- **Secure Storage**: Confirm it's properly set in Supabase edge function environment

### 6. Usage & Quotas
- **API Calls**: Check if daily/monthly limits are exceeded
- **Rate Limits**: Verify no rate limiting issues
- **User Limits**: If in Development mode, check user count limits

## Verification Steps

### Step 1: Basic App Info
1. Log into [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Navigate to your app
3. Verify Client ID matches: `3bac088a26d64ddfb49d57fb5d451d71`

### Step 2: Redirect URI Check
1. Go to "Edit Settings"
2. Check "Redirect URIs" section
3. Verify EXACT match: `https://mako-sync.vercel.app/spotify-callback`
4. No extra entries that might cause conflicts

### Step 3: App Mode Verification
1. Check app status (Development/Production)
2. If Development mode:
   - Add test users to "Users and Access" section
   - Use test credentials: `spotify.test.user@makosync.com`

### Step 4: Client Secret
1. Note if "Show Client Secret" reveals an active secret
2. If recently changed, this needs to be updated in Supabase

## Quick Test After Verification

### Manual OAuth URL Test
```
https://accounts.spotify.com/authorize?client_id=3bac088a26d64ddfb49d57fb5d451d71&response_type=code&redirect_uri=https%3A%2F%2Fmako-sync.vercel.app%2Fspotify-callback&scope=user-read-private%20user-read-email%20user-library-read%20playlist-read-private%20playlist-read-collaborative%20user-top-read&state=test-12345
```

**Expected Results:**
- ✅ Redirects to Spotify login
- ✅ Shows correct app name and permissions
- ✅ After authorization, redirects to callback URL
- ❌ Shows "Invalid redirect URI" = Configuration issue
- ❌ Shows "Invalid client" = Client ID mismatch

## Common Issues & Solutions

### Issue: "Invalid redirect URI"
**Solution**: Redirect URI not exactly registered in Spotify app settings

### Issue: "Invalid client"
**Solution**: Client ID mismatch between app and configuration

### Issue: "Access denied"
**Solution**: App in Development mode, user not added to app

### Issue: "Invalid scope"
**Solution**: Requested scopes not enabled in app settings

## Next Steps After Verification

1. **If Configuration Issues Found**: Fix in Spotify Dashboard, test again
2. **If Configuration Correct**: Move to edge function environment validation
3. **If Still Failing**: Add diagnostic logging to edge function

## Environment Variables to Cross-Check

**Frontend (.env):**
```
VITE_SPOTIFY_CLIENT_ID="3bac088a26d64ddfb49d57fb5d451d71"
VITE_SPOTIFY_REDIRECT_URI="https://mako-sync.vercel.app/spotify-callback"
```

**Edge Function Environment:**
```
SPOTIFY_CLIENT_ID=3bac088a26d64ddfb49d57fb5d451d71
SPOTIFY_CLIENT_SECRET=[from Spotify Dashboard]
```

**Critical**: Client ID must match exactly between all three locations:
1. Spotify Developer Dashboard
2. Frontend environment variables
3. Edge function environment variables