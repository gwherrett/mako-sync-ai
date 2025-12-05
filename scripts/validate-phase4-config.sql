-- Phase 4 Configuration Validation Script
-- Run this in Supabase SQL Editor to verify Phase 4 setup

-- ==============================================
-- PHASE 4 CONFIGURATION VALIDATION
-- ==============================================

\echo '🔍 PHASE 4 CONFIGURATION VALIDATION'
\echo '===================================='

-- Check 1: Verify user_roles table exists
\echo ''
\echo '1. Checking user_roles table...'
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_roles') 
        THEN '✅ user_roles table exists'
        ELSE '❌ user_roles table missing'
    END as status;

-- Check 2: Verify app_role enum exists
\echo ''
\echo '2. Checking app_role enum...'
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') 
        THEN '✅ app_role enum exists'
        ELSE '❌ app_role enum missing'
    END as status;

-- Check 3: Verify has_role function exists
\echo ''
\echo '3. Checking has_role security function...'
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'has_role') 
        THEN '✅ has_role function exists'
        ELSE '❌ has_role function missing'
    END as status;

-- Check 4: Verify handle_new_user function exists
\echo ''
\echo '4. Checking handle_new_user trigger function...'
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'handle_new_user') 
        THEN '✅ handle_new_user function exists'
        ELSE '❌ handle_new_user function missing'
    END as status;

-- Check 5: Verify cached_genres column in sync_progress
\echo ''
\echo '5. Checking cached_genres column...'
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'sync_progress' AND column_name = 'cached_genres'
        ) 
        THEN '✅ cached_genres column exists'
        ELSE '❌ cached_genres column missing'
    END as status;

-- Check 6: Verify RLS is enabled on user_roles
\echo ''
\echo '6. Checking Row Level Security on user_roles...'
SELECT 
    CASE 
        WHEN relrowsecurity = true 
        THEN '✅ RLS enabled on user_roles'
        ELSE '❌ RLS not enabled on user_roles'
    END as status
FROM pg_class 
WHERE relname = 'user_roles';

-- Check 7: Count RLS policies on user_roles
\echo ''
\echo '7. Checking RLS policies on user_roles...'
SELECT 
    COUNT(*) as policy_count,
    CASE 
        WHEN COUNT(*) >= 5 
        THEN '✅ Expected RLS policies found'
        ELSE '⚠️  Missing some RLS policies'
    END as status
FROM pg_policies 
WHERE tablename = 'user_roles';

-- Check 8: Verify vault extension
\echo ''
\echo '8. Checking Vault extension...'
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vault') 
        THEN '✅ Vault extension enabled'
        ELSE '❌ Vault extension not enabled'
    END as status;

-- Check 9: Test vault functionality (if enabled)
\echo ''
\echo '9. Testing Vault functionality...'
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vault') THEN
        BEGIN
            -- Try to create and read a test secret
            PERFORM vault.create_secret('phase4-test-secret', 'test-value');
            IF vault.read_secret('phase4-test-secret') = 'test-value' THEN
                RAISE NOTICE '✅ Vault functionality working';
            ELSE
                RAISE NOTICE '❌ Vault read/write failed';
            END IF;
            -- Clean up test secret
            PERFORM vault.delete_secret('phase4-test-secret');
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '⚠️  Vault test failed: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE '❌ Vault extension not available for testing';
    END IF;
END $$;

-- Check 10: Verify spotify_connections table structure
\echo ''
\echo '10. Checking spotify_connections table...'
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'spotify_connections') 
        THEN '✅ spotify_connections table exists'
        ELSE '❌ spotify_connections table missing'
    END as status;

-- Check 11: Verify sync_progress table structure
\echo ''
\echo '11. Checking sync_progress table...'
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sync_progress') 
        THEN '✅ sync_progress table exists'
        ELSE '❌ sync_progress table missing'
    END as status;

-- Check 12: Show current user's role (if any)
\echo ''
\echo '12. Checking current user role...'
SELECT 
    COALESCE(
        (SELECT role::text FROM user_roles WHERE user_id = auth.uid()),
        'No role assigned'
    ) as current_user_role;

-- Summary Report
\echo ''
\echo '📊 PHASE 4 VALIDATION SUMMARY'
\echo '============================='

WITH validation_results AS (
    SELECT 
        -- Count successful checks
        (CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_roles') THEN 1 ELSE 0 END) +
        (CASE WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN 1 ELSE 0 END) +
        (CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'has_role') THEN 1 ELSE 0 END) +
        (CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'handle_new_user') THEN 1 ELSE 0 END) +
        (CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sync_progress' AND column_name = 'cached_genres') THEN 1 ELSE 0 END) +
        (CASE WHEN EXISTS (SELECT 1 FROM pg_class WHERE relname = 'user_roles' AND relrowsecurity = true) THEN 1 ELSE 0 END) +
        (CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vault') THEN 1 ELSE 0 END) +
        (CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'spotify_connections') THEN 1 ELSE 0 END) +
        (CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sync_progress') THEN 1 ELSE 0 END)
        as passed_checks,
        9 as total_checks
)
SELECT 
    passed_checks,
    total_checks,
    ROUND((passed_checks::decimal / total_checks) * 100, 1) as success_percentage,
    CASE 
        WHEN passed_checks = total_checks THEN '🎉 All Phase 4 checks passed!'
        WHEN passed_checks >= 7 THEN '⚠️  Most checks passed, review warnings above'
        ELSE '❌ Multiple issues found, Phase 4 not ready'
    END as overall_status
FROM validation_results;

\echo ''
\echo '🔗 Next Steps:'
\echo '- If any checks failed, review docs/supabase-phase4-configuration.md'
\echo '- Set environment variables in Supabase Dashboard'
\echo '- Test Phase 4 API endpoints'
\echo '- Deploy edge functions if not already done'