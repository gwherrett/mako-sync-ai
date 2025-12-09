# Spotify Connection Root Cause Analysis

## Status: Configuration Verified ✅

### Confirmed Working Components:
1. ✅ **Client ID**: `3bac088a26d64ddfb49d57fb5d451d71` matches Spotify Dashboard
2. ✅ **Redirect URI**: `https://mako-sync.vercel.app/spotify-callback` (no trailing slash)
3. ✅ **Frontend Environment**: `.env` variables correctly configured
4. ✅ **React Routing**: `/spotify-callback` route properly defined
5. ✅ **OAuth Flow Logic**: Code structure is sound

## Most Likely Root Cause: Edge Function Environment Variables

Since Spotify app configuration is correct, the issue is almost certainly in the **Supabase Edge Function environment**. The edge function requires these variables that are **separate** from the frontend environment:

### Required Edge Function Environment Variables:
```bash
SPOTIFY_CLIENT_ID=3bac088a26d64ddfb49d57fb5d451d71
SPOTIFY_CLIENT_SECRET=[from Spotify Dashboard]
SUPABASE_DB_URL=[postgres connection string]
SUPABASE_SERVICE_ROLE_KEY=[service role key]
```

### Critical Issue: Environment Variable Mismatch
- **Frontend**: Uses `VITE_SPOTIFY_CLIENT_ID` (for browser)
- **Edge Function**: Expects `SPOTIFY_CLIENT_ID` (server-side)

## Diagnostic Steps

### Step 1: Test OAuth URL Manually
```
https://accounts.spotify.com/authorize?client_id=3bac088a26d64ddfb49d57fb5d451d71&response_type=code&redirect_uri=https%3A%2F%2Fmako-sync.vercel.app%2Fspotify-callback&scope=user-read-private%20user-read-email%20user-library-read%20playlist-read-private%20playlist-read-collaborative%20user-top-read&state=test-12345
```

**Expected Result**: Should redirect to Spotify login, then back to callback with `code` parameter.

### Step 2: Check Edge Function Logs
1. Go to Supabase Dashboard → Functions → spotify-auth → Logs
2. Look for specific error messages when callback executes

### Step 3: Verify Edge Function Environment
The edge function will fail at one of these points:

#### Point A: Missing SPOTIFY_CLIENT_SECRET
```javascript
const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET')
if (!clientSecret) {
  // Returns: "Spotify credentials not configured"
}
```

#### Point B: Missing SUPABASE_DB_URL
```javascript
const dbUrl = Deno.env.get('SUPABASE_DB_URL')
if (!dbUrl) {
  // Returns: "Database connection not configured"
}
```

#### Point C: Vault Access Issues
```javascript
// Fails during token storage in vault
const accessTokenResult = await connection.queryObject`
  SELECT vault.create_secret(...)
`
```

## Immediate Action Plan

### 1. Test OAuth Flow (5 minutes)
- Click the OAuth URL above
- Check if it redirects to Spotify correctly
- Note any error messages

### 2. Check Edge Function Logs (5 minutes)
- Attempt Spotify connection in app
- Check Supabase Function logs for specific errors
- Look for environment variable error messages

### 3. Verify Edge Function Environment (10 minutes)
- Ensure all 4 required environment variables are set
- Verify SPOTIFY_CLIENT_SECRET matches Dashboard
- Check SUPABASE_DB_URL format is correct

## Expected Findings

### If OAuth URL Test Fails:
- **Unlikely** (since config is verified)
- Would indicate Spotify app issue

### If OAuth URL Works But Callback Fails:
- **Most Likely** - Edge function environment issue
- Check logs for specific missing variables

### If Edge Function Environment is Correct:
- **Less Likely** - Vault permissions or database connectivity
- Would require deeper investigation

## Next Steps Based on Results

### Scenario A: Missing Environment Variables
1. Set missing variables in Supabase Edge Function environment
2. Redeploy edge function
3. Test connection

### Scenario B: All Variables Present
1. Add enhanced logging to edge function
2. Test with detailed error reporting
3. Check vault permissions and database connectivity

### Scenario C: Vault/Database Issues
1. Test database connectivity from edge function
2. Verify vault.create_secret permissions
3. Check service role key permissions

## Success Criteria

Connection will work when:
1. ✅ OAuth redirects to Spotify successfully
2. ✅ User authorizes and redirects back with code
3. ✅ Edge function exchanges code for tokens
4. ✅ Tokens stored successfully in vault
5. ✅ Connection record created in database
6. ✅ User sees "Spotify Connected!" message

## Risk Assessment

**Low Risk**: Configuration changes (environment variables)
**Medium Risk**: Code changes (enhanced logging)
**High Risk**: Database/vault permission changes

Recommendation: Start with environment variable verification as it's the most likely cause and lowest risk.