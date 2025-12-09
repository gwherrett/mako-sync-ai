# Spotify OAuth Production Configuration

## Issues Fixed

### 1. Removed Hardcoded Fallbacks
- **File**: `src/services/spotify.service.ts`
- **Change**: Removed hardcoded client ID fallback `3bac088a26d64ddfb49d57fb5d451d71`
- **Impact**: Forces proper environment variable configuration

### 2. Removed Hardcoded Redirect URI in Edge Function
- **File**: `supabase/functions/spotify-auth/index.ts`
- **Change**: Removed hardcoded fallback `https://mako-sync.vercel.app/spotify-callback`
- **Impact**: Ensures client and server use matching redirect URIs

### 3. Updated Environment Configuration
- **File**: `.env`
- **Change**: Added explicit `VITE_SPOTIFY_REDIRECT_URI` for production
- **Impact**: Consistent redirect URI across environments

## Production Environment Variables Required

### Frontend (Vercel)
```bash
VITE_SPOTIFY_CLIENT_ID="your-production-spotify-client-id"
VITE_SPOTIFY_REDIRECT_URI="https://mako-sync.vercel.app/spotify-callback"
```

### Backend (Supabase Edge Functions)
```bash
SPOTIFY_CLIENT_ID="your-production-spotify-client-id"
SPOTIFY_CLIENT_SECRET="your-production-spotify-client-secret"
```

## Spotify Developer Dashboard Configuration

### Required Redirect URIs
Add these to your Spotify app's redirect URI whitelist:
- `https://mako-sync.vercel.app/spotify-callback` (production)
- `http://localhost:8080/spotify-callback` (development)
- `http://localhost:3000/spotify-callback` (development fallback)

### App Settings
- **App Type**: Web Application
- **Bundle IDs**: Not required for web apps
- **Android Package**: Not required for web apps

## Testing Checklist

### Before Production Deployment
- [ ] Verify `VITE_SPOTIFY_CLIENT_ID` matches Spotify app client ID
- [ ] Verify `VITE_SPOTIFY_REDIRECT_URI` is set to production URL
- [ ] Verify Supabase edge function has `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`
- [ ] Verify Spotify app has production redirect URI whitelisted

### After Production Deployment
- [ ] Test Spotify connection redirects to OAuth consent (not login)
- [ ] Test successful OAuth callback returns to app dashboard
- [ ] Test sync operations populate dashboard counts
- [ ] Verify no console errors during OAuth flow

## Common Issues

### "Invalid redirect URI" Error
- Check Spotify app redirect URI whitelist
- Verify `VITE_SPOTIFY_REDIRECT_URI` matches exactly (including protocol)

### "Invalid client" Error
- Verify `SPOTIFY_CLIENT_ID` in edge function matches frontend
- Check client secret is correct in edge function

### Redirects to Spotify Login Instead of OAuth
- Usually indicates client ID or redirect URI mismatch
- Check environment variables are deployed correctly

## Deployment Notes

1. **Environment Variables**: Ensure all variables are set in both Vercel and Supabase
2. **Case Sensitivity**: Environment variable names are case-sensitive
3. **URL Format**: Redirect URIs must include protocol (`https://`)
4. **No Trailing Slashes**: Avoid trailing slashes in redirect URIs