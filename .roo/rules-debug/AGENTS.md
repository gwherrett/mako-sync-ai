# Project Debug Rules (Non-Obvious Only)

- **NEVER DECLARE SUCCESS UNTIL USER CONFIRMS**: Do not write success summaries or declare fixes complete until user deploys to production and confirms functionality. Wait for actual test results.
- **File System API Browser Restriction**: Local file scanning fails silently in iframes (Lovable preview) - must test in new tab with Chromium browser
- **Edge Function Logs**: Available at Supabase dashboard under Functions > [function-name] > Logs, not in browser console
- **Metadata Extraction Debugging**: Extensive console logging in `extractMetadata()` - check for parseBlob failures and tag format fallbacks
- **Auth Context Initialization**: Uses `useRef` to prevent double-initialization - check `initializationRef.current` state
- **Auth Context Conflicts**: Only `NewAuthProvider` exists - if seeing auth issues, verify no legacy `AuthContext` imports remain
- **Password Reset Debugging**: Check `/reset-password` route with URL params `access_token`, `refresh_token`, and `type=recovery`
- **Supabase Silent Truncation**: Queries return max 1000 rows without error - use explicit `.limit()` to verify pagination issues
- **Genre Mapping Edge Cases**: Accepts any spotify_genre but validates super_genre enum - check validation vs acceptance logic
- **Token Vault Storage**: Spotify tokens stored as vault secret IDs, not plain text - check `spotify_connections` table for references
- **RLS Policy Testing**: Test with actual user context, not service role - verify `auth.uid() = user_id` patterns
- **Normalization Service**: Complex text processing with multiple fallback strategies - check diacritics, punctuation, and feature extraction
- **Batch Processing Memory**: Files processed in batches of 5 to prevent memory issues - increase batch size may cause crashes
- **Phase 4 Singleton Debugging**: SpotifyHealthMonitorService.getInstance() creates intervals - check for memory leaks if not properly stopped
- **Phase 4 Error Handler Debugging**: Errors logged to Phase4ErrorHandlerService.getRecentErrors() - check for service-specific categorization
- **Token Vault Debugging**: Actual tokens in vault, connection table has `***ENCRYPTED_IN_VAULT***` placeholders - debug vault access, not table values
- **Edge Function Phase 4 Flags**: Use specific flags (`refresh_only`, `health_check`, etc.) to isolate functionality during debugging
- **Security Validation Debugging**: SpotifySecurityValidatorService uses regex patterns to detect token exposure - check SECURITY_PATTERNS constants
- **Unified Auth Manager Debugging**: SpotifyAuthManager.getInstance() has 5-second cooldown - check `state.lastCheck` timestamp for cache behavior
- **Promise Deduplication Debugging**: Multiple connection checks return same promise - check `checkPromise` property for race condition debugging
- **State Subscription Debugging**: Components subscribe to auth changes - check listener count and cleanup in `subscribe()` return function
- **Connection Check Timeout Debugging**: Uses Promise.race with 3-second timeout - check for "timeout" errors vs actual connection failures

## **Test Credentials for Consistent Testing:**

**Email:** `spotify.test.user@makosync.com`
**Password:** `SpotifyTest2024!`

These credentials provide a consistent test account for debugging Spotify Connect functionality and other authentication-related features. Use these for reproducible testing scenarios.