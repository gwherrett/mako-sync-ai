# Project Coding Rules (Non-Obvious Only)

- **Buffer Global Setup**: Must set `window.Buffer = Buffer` globally before using `music-metadata-browser` (see `src/services/metadataExtractor.ts:48-50`)
- **Service Layer Mandatory**: Never query Supabase directly in components - always use `src/services/*.service.ts` files
- **Supabase Client Import**: Always `import { supabase } from '@/integrations/supabase/client'` - never use env vars directly
- **Pagination Critical**: Supabase silently truncates at 1000 rows - use `.range()` or `.limit()` for large datasets
- **SUPER_GENRES Sorting**: UI must use `[...SUPER_GENRES].sort()` - the array itself is intentionally unsorted
- **Edge Function Isolation**: Cannot import from `src/` in edge functions - must duplicate shared code
- **Metadata Validation**: All extracted metadata must pass Zod schema validation before database insertion
- **Batch Size Limits**: File processing batches limited to 5 files, Spotify API to 50 items per request
- **Auth Context Consolidation**: Only `NewAuthProvider` exists - legacy `AuthContext` removed to prevent conflicts and race conditions
- **Auth Context Deferred Loading**: User data loading must be deferred with `setTimeout` to prevent initialization deadlocks
- **Role Storage Security**: Roles stored in separate `user_roles` table, never on user profiles to prevent privilege escalation
- **Password Reset Implementation**: Complete flow with token validation - use `/reset-password` route, not inline forms
- **Auth Import Pattern**: Always `import { useAuth } from '@/contexts/NewAuthContext'` - no legacy auth imports allowed
- **Phase 4 Singleton Pattern**: SpotifyHealthMonitorService, SpotifySecurityValidatorService must use `getInstance()` - never `new`
- **Token Vault Storage**: Spotify tokens stored as vault secret IDs, actual token fields contain `***ENCRYPTED_IN_VAULT***` placeholders
- **Phase 4 Error Handling**: Use Phase4ErrorHandlerService.handleError() with service-specific categorization for all Phase 4 services
- **Edge Function Phase 4 Flags**: Use `refresh_only`, `health_check`, `validate_vault`, `force_token_rotation` flags for targeted operations
- **Security Validation Required**: All token operations must validate through SpotifySecurityValidatorService before execution