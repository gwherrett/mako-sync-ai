# Project Architecture Rules (Non-Obvious Only)

- **Service Layer Abstraction**: All Supabase operations must go through service layer - components never query database directly
- **Edge Function Isolation**: Functions cannot import from `src/` directory - must be self-contained with duplicated shared code
- **Authentication Context Pattern**: NewAuthProvider uses `useRef` initialization guard and deferred data loading to prevent deadlocks
- **Authentication Context Consolidation**: Only `NewAuthProvider` exists - legacy `AuthContext` removed to prevent conflicts and race conditions
- **Role Security Architecture**: Roles stored in separate `user_roles` table (never on profiles) with security definer functions for privilege checks
- **Password Reset Architecture**: Complete implementation with token validation using dedicated `/reset-password` route and page component
- **Token Vault Architecture**: Spotify tokens stored in Supabase Vault, connection table stores vault secret IDs, not plain text
- **Pagination Architecture**: Supabase has 1000-row limit with silent truncation - all large dataset queries must use `.range()` or explicit `.limit()`
- **Genre System Design**: SUPER_GENRES array intentionally unsorted, UI components must sort alphabetically, database enum updates require separate transactions
- **File Processing Pipeline**: Metadata extraction uses batched processing (5 files) with extensive ID3 tag fallback logic and normalization service
- **Database Security Model**: RLS policies use `auth.uid() = user_id` for user data, `has_role(auth.uid(), 'admin')` for admin access
- **Build System Architecture**: Supports development builds via `npm run build:dev` with different mode configuration
- **Testing Architecture**: No test runner configured - uses acceptance test documentation pattern in `src/__tests__/`