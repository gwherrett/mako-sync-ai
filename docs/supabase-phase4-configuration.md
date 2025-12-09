# Supabase Configuration Guide for Phase 4 Implementation

## Overview
This guide provides step-by-step instructions for configuring your Supabase project to support Phase 4 features including enhanced security, token management, and health monitoring.

## 🚨 CRITICAL CONFIGURATION STEPS

### 1. Authentication & Project Setup

First, authenticate with Supabase CLI:
```bash
# Login to Supabase
supabase login

# Link to your existing project
supabase link --project-ref your-project-id
```

### 2. Database Migrations

Ensure all migrations are applied, especially the Phase 4 security migration:

```bash
# Apply all pending migrations
supabase db push

# Verify the critical Phase 4 migrations are applied:
# - 20251205032300_user_roles_security.sql (NEW Phase 4 security system)
# - 20251124221124_8c0acd2f-e542-474f-a262-c80cf65030e4.sql (Cached genres support)
```

**Critical Migrations for Phase 4:**
- `20251205032300_user_roles_security.sql` - User roles security system
- `20251124221124_8c0acd2f-e542-474f-a262-c80cf65030e4.sql` - Cached genres for sync resume

### 3. Environment Variables Configuration

**Required Environment Variables in Supabase Dashboard:**

Navigate to: **Supabase Dashboard → Settings → Edge Functions → Environment Variables**

Set these variables:
```
SPOTIFY_CLIENT_ID=your_spotify_app_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_app_client_secret
SUPABASE_DB_URL=your_database_connection_string
```

**How to get these values:**
- `SPOTIFY_CLIENT_ID` & `SPOTIFY_CLIENT_SECRET`: From your Spotify Developer Dashboard
- `SUPABASE_DB_URL`: From Supabase Dashboard → Settings → Database → Connection string (Direct connection)

### 4. Supabase Vault Setup

**CRITICAL: Phase 4 uses Supabase Vault for secure token storage**

1. **Enable Vault Extension:**
   - Go to: **Supabase Dashboard → Database → Extensions**
   - Search for "vault" and enable it

2. **Verify Vault Permissions:**
   ```sql
   -- Run this in SQL Editor to verify vault is working
   SELECT vault.create_secret('test-secret', 'test-value');
   SELECT vault.read_secret('test-secret');
   ```

### 5. Edge Functions Deployment

Deploy the updated edge function with Phase 4 support:

```bash
# Deploy the spotify-sync-liked function with Phase 4 features
supabase functions deploy spotify-sync-liked

# Verify deployment
supabase functions list
```

**Phase 4 Edge Function Features:**
- `refresh_only` - Token refresh only mode
- `health_check` - API connectivity testing
- `validate_vault` - Vault storage integrity check
- `force_token_rotation` - Security token rotation

### 6. Row Level Security (RLS) Policies

**Verify Phase 4 RLS Policies are Active:**

Navigate to: **Supabase Dashboard → Authentication → Policies**

**Required Policies from Phase 4:**
- `user_roles` table policies for role-based access
- Security definer function `has_role()` for safe role checking
- Admin-only policies for role management

**Key Security Features:**
- Roles stored in separate `user_roles` table (not on profiles)
- `SECURITY DEFINER` function prevents privilege escalation
- Admin role required for role management operations

### 7. Database Schema Verification

**Verify these Phase 4 tables/functions exist:**

```sql
-- Check user_roles table exists
SELECT * FROM information_schema.tables WHERE table_name = 'user_roles';

-- Check has_role function exists
SELECT * FROM information_schema.routines WHERE routine_name = 'has_role';

-- Check sync_progress has cached_genres column
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'sync_progress' AND column_name = 'cached_genres';
```

## 🔧 CONFIGURATION VERIFICATION

### Test Phase 4 Features

1. **Test Token Refresh:**
   ```bash
   curl -X POST "https://your-project.supabase.co/functions/v1/spotify-sync-liked" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"refresh_only": true}'
   ```

2. **Test Health Check:**
   ```bash
   curl -X POST "https://your-project.supabase.co/functions/v1/spotify-sync-liked" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"health_check": true}'
   ```

3. **Test Vault Validation:**
   ```bash
   curl -X POST "https://your-project.supabase.co/functions/v1/spotify-sync-liked" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"validate_vault": true}'
   ```

### Verify Security Features

1. **Check User Roles System:**
   ```sql
   -- Verify your user has a role assigned
   SELECT * FROM user_roles WHERE user_id = auth.uid();
   
   -- Test role checking function
   SELECT has_role(auth.uid(), 'user');
   ```

2. **Test RLS Policies:**
   ```sql
   -- Should only return your own roles
   SELECT * FROM user_roles;
   ```

## 🚨 TROUBLESHOOTING

### Common Issues:

1. **"Vault not enabled" Error:**
   - Enable vault extension in Database → Extensions
   - Restart edge functions: `supabase functions deploy spotify-sync-liked`

2. **"Environment variables not set" Error:**
   - Verify all three env vars are set in Supabase Dashboard
   - Redeploy functions after setting variables

3. **"Migration failed" Error:**
   - Check migration order - security migration must be last
   - Manually apply migrations in correct order

4. **"RLS policy violation" Error:**
   - Verify user_roles table has correct policies
   - Check has_role function is created with SECURITY DEFINER

### Verification Commands:

```bash
# Check function deployment status
supabase functions list

# Check migration status
supabase migration list

# Test database connection
supabase db ping
```

## 📋 PHASE 4 FEATURE CHECKLIST

- [ ] Supabase CLI authenticated and project linked
- [ ] All migrations applied (especially security migration)
- [ ] Environment variables configured in Supabase Dashboard
- [ ] Vault extension enabled and tested
- [ ] Edge functions deployed with Phase 4 support
- [ ] RLS policies active for user_roles table
- [ ] Security definer function `has_role()` created
- [ ] Phase 4 API endpoints tested (refresh_only, health_check, etc.)
- [ ] User roles system verified
- [ ] Cached genres support confirmed

## 🔐 SECURITY NOTES

**Phase 4 Security Enhancements:**
- Tokens stored in Supabase Vault (encrypted)
- Roles in separate table to prevent privilege escalation
- Security definer functions for safe role checking
- Enhanced error handling and monitoring
- Token rotation capabilities for security incidents

**Important:** Never store sensitive tokens in plain text. Always use Supabase Vault for token storage in production.