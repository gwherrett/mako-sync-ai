# 🚀 Phase 4 Supabase Configuration Setup

## Quick Start Guide

This guide provides everything you need to configure Supabase for Phase 4 implementation of Mako Sync.

## 📋 Prerequisites

- Supabase CLI installed (`npm install -g supabase`)
- Access to Supabase project: `bzzstdpfmyqttnzhgaoa`
- Spotify Developer App credentials

## 🎯 One-Command Setup

```bash
# Run the automated deployment script
./scripts/deploy-phase4.sh
```

## 📚 Detailed Documentation

| Document | Purpose |
|----------|---------|
| [`docs/supabase-phase4-configuration.md`](docs/supabase-phase4-configuration.md) | Complete configuration guide |
| [`scripts/env-variables-template.md`](scripts/env-variables-template.md) | Environment variables setup |
| [`scripts/validate-phase4-config.sql`](scripts/validate-phase4-config.sql) | Database validation script |
| [`scripts/test-phase4-endpoints.sh`](scripts/test-phase4-endpoints.sh) | API endpoints testing |

## 🔧 Manual Setup Steps

### 1. Authentication
```bash
supabase login
supabase link --project-ref bzzstdpfmyqttnzhgaoa
```

### 2. Deploy Database & Functions
```bash
supabase db push
supabase functions deploy spotify-sync-liked
```

### 3. Configure Environment Variables
Set these in **Supabase Dashboard → Settings → Edge Functions → Environment Variables**:
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SUPABASE_DB_URL`

### 4. Enable Vault Extension
**Supabase Dashboard → Database → Extensions** → Enable "vault"

## 🧪 Testing & Validation

### Validate Database Setup
```bash
# Run in Supabase SQL Editor
\i scripts/validate-phase4-config.sql
```

### Test API Endpoints
```bash
# Set your JWT token and test
JWT_TOKEN='your_jwt_token' ./scripts/test-phase4-endpoints.sh
```

## 🔍 Phase 4 Features

### New API Endpoints
- `{"refresh_only": true}` - Token refresh only
- `{"health_check": true}` - API connectivity test
- `{"validate_vault": true}` - Vault integrity check
- `{"force_token_rotation": true}` - Security token rotation

### Security Enhancements
- ✅ User roles system with RLS policies
- ✅ Secure token storage in Supabase Vault
- ✅ Security definer functions prevent privilege escalation
- ✅ Enhanced error handling and monitoring

### Sync Improvements
- ✅ Cached genres support for resume functionality
- ✅ Improved error recovery
- ✅ Health monitoring capabilities

## 🚨 Critical Configuration Items

### ✅ Must-Have Configurations

1. **Database Migrations Applied**
   - `20251205032300_user_roles_security.sql` ✅
   - `20251124221124_8c0acd2f-e542-474f-a262-c80cf65030e4.sql` ✅

2. **Environment Variables Set**
   - `SPOTIFY_CLIENT_ID` ✅
   - `SPOTIFY_CLIENT_SECRET` ✅
   - `SUPABASE_DB_URL` ✅

3. **Extensions Enabled**
   - Vault extension ✅

4. **Edge Functions Deployed**
   - `spotify-sync-liked` with Phase 4 support ✅

## 🔗 Quick Links

- [Supabase Dashboard](https://supabase.com/dashboard/project/bzzstdpfmyqttnzhgaoa)
- [Edge Functions](https://supabase.com/dashboard/project/bzzstdpfmyqttnzhgaoa/functions)
- [Database Editor](https://supabase.com/dashboard/project/bzzstdpfmyqttnzhgaoa/editor)
- [Environment Variables](https://supabase.com/dashboard/project/bzzstdpfmyqttnzhgaoa/settings/functions)

## 🆘 Troubleshooting

### Common Issues

1. **"Access token not provided"**
   ```bash
   supabase login
   ```

2. **"Environment variable not found"**
   - Set variables in Supabase Dashboard
   - Redeploy functions: `supabase functions deploy spotify-sync-liked`

3. **"Vault not enabled"**
   - Enable vault extension in Database → Extensions

4. **"Migration failed"**
   - Check migration order
   - Apply manually if needed

### Get Help

- Check function logs: `supabase functions logs spotify-sync-liked`
- Validate config: Run `scripts/validate-phase4-config.sql`
- Test endpoints: Run `scripts/test-phase4-endpoints.sh`

## 📊 Verification Checklist

Run this checklist after setup:

- [ ] Supabase CLI authenticated
- [ ] Project linked successfully
- [ ] All migrations applied
- [ ] Environment variables configured
- [ ] Vault extension enabled
- [ ] Edge functions deployed
- [ ] Database validation passed
- [ ] API endpoints tested
- [ ] User roles system working
- [ ] Phase 4 features functional

## 🎉 Success Indicators

When Phase 4 is properly configured, you should see:

✅ All validation checks pass in `validate-phase4-config.sql`
✅ API endpoints respond correctly in `test-phase4-endpoints.sh`
✅ No errors in edge function logs
✅ User roles system functioning
✅ Vault storing tokens securely

---

**Need help?** Check the detailed documentation in [`docs/supabase-phase4-configuration.md`](docs/supabase-phase4-configuration.md)