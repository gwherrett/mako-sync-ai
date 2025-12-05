# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Critical Non-Obvious Patterns

- **File System Access API Required**: Local file scanning only works in Chromium browsers and fails in iframes (like Lovable preview). Must open deployed app in new tab for testing.
- **Buffer Global Required**: `music-metadata-browser` needs `window.Buffer = Buffer` set globally for MP3 parsing to work.
- **Supabase Client Import**: Always use `import { supabase } from '@/integrations/supabase/client'` - never use env vars directly.
- **TypeScript Strict Mode Disabled**: `tsconfig.app.json` has `strict: false` and disabled linting rules - project allows loose typing.
- **Service Layer Pattern**: All Supabase operations must go through `src/services/*.service.ts` files, never direct queries in components.

## Database & Edge Functions

- **No Raw SQL**: Edge functions must use Supabase client methods only, never raw SQL execution.
- **Pagination Required**: Supabase has 1000 row limit with silent truncation - use `.range()` or explicit `.limit()` for large datasets.
- **Token Storage**: Spotify tokens stored in Supabase Vault, not plain text. Connection table stores vault secret IDs.
- **RLS Patterns**: User data uses `auth.uid() = user_id`, admin access uses `has_role(auth.uid(), 'admin')` security definer function.

## Genre System Architecture

- **SUPER_GENRES Ordering**: Must be alphabetical in UI using `[...SUPER_GENRES].sort()` - array itself is not sorted.
- **Genre Mapping Validation**: Edge function accepts any spotify_genre (no strict validation), but super_genre must be valid enum.
- **Database Enum Updates**: Require separate transactions - update enum type first, then migrate data, never together.

## File Processing

- **Metadata Extraction**: Uses `music-metadata-browser` with extensive fallback logic across ID3v2.4/2.3/1.1 and vorbis tags.
- **Normalization Service**: Complex text processing for track matching - handles diacritics, punctuation, featuring artists, and mix extraction.
- **Hash Generation**: Files hashed with SHA-256 for duplicate detection using Web Crypto API.
- **Batch Processing**: Files processed in batches of 5 for metadata extraction to prevent memory issues.

## Authentication Context

- **Single Auth Context**: Only `NewAuthProvider` exists - legacy `AuthContext` removed to prevent conflicts and race conditions.
- **NewAuthProvider**: Uses complex initialization with `useRef` to prevent double-initialization and deferred data loading to avoid deadlocks.
- **Role Security**: Roles stored in separate `user_roles` table (never on profiles) to prevent privilege escalation.
- **Password Reset Flow**: Complete implementation with token validation in dedicated `/reset-password` route.
- **Auth Context Consolidation**: All components must use `@/contexts/NewAuthContext` - no legacy auth imports allowed.

## Build Commands

- `npm run build:dev` - Development build with different mode
- No test runner configured - only acceptance test documentation in `src/__tests__/`