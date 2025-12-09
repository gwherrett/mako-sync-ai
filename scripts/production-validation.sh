#!/bin/bash

# Production Validation Script for Spotify Integration
# This script validates the production readiness of the Spotify authentication system

set -e

echo "🚀 SPOTIFY INTEGRATION PRODUCTION VALIDATION"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Helper functions
pass() {
    echo -e "${GREEN}✅ PASS:${NC} $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}❌ FAIL:${NC} $1"
    ((FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠️  WARN:${NC} $1"
    ((WARNINGS++))
}

info() {
    echo -e "${BLUE}ℹ️  INFO:${NC} $1"
}

# Load environment variables from .env file
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    info "Loaded environment variables from .env file"
else
    warn ".env file not found - using system environment variables only"
fi

echo ""
echo "📋 PHASE 1: ENVIRONMENT VARIABLE VALIDATION"
echo "============================================"

# Frontend Environment Variables
echo ""
echo "🖥️  Frontend Environment Variables:"

if [ -n "$VITE_SPOTIFY_CLIENT_ID" ]; then
    pass "VITE_SPOTIFY_CLIENT_ID is set to production value"
    info "Client ID: ${VITE_SPOTIFY_CLIENT_ID:0:8}..."
    
    # Validate it's the expected production client ID
    if [ "$VITE_SPOTIFY_CLIENT_ID" = "3bac088a26d64ddfb49d57fb5d451d71" ]; then
        pass "VITE_SPOTIFY_CLIENT_ID matches expected production client ID"
    else
        warn "VITE_SPOTIFY_CLIENT_ID differs from expected production value"
        echo "   Current: $VITE_SPOTIFY_CLIENT_ID"
        echo "   Expected: 3bac088a26d64ddfb49d57fb5d451d71"
    fi
else
    fail "VITE_SPOTIFY_CLIENT_ID is not set"
fi

if [ -n "$VITE_SPOTIFY_REDIRECT_URI" ]; then
    if [[ "$VITE_SPOTIFY_REDIRECT_URI" =~ ^https:// ]]; then
        pass "VITE_SPOTIFY_REDIRECT_URI uses HTTPS"
        info "Redirect URI: $VITE_SPOTIFY_REDIRECT_URI"
    else
        fail "VITE_SPOTIFY_REDIRECT_URI must use HTTPS in production"
        echo "   Current: $VITE_SPOTIFY_REDIRECT_URI"
    fi
else
    fail "VITE_SPOTIFY_REDIRECT_URI is not set"
fi

if [ -n "$VITE_SUPABASE_URL" ]; then
    if [[ "$VITE_SUPABASE_URL" =~ ^https://.*\.supabase\.co$ ]]; then
        pass "VITE_SUPABASE_URL is properly formatted"
        info "Supabase URL: $VITE_SUPABASE_URL"
    else
        warn "VITE_SUPABASE_URL format may be incorrect"
        echo "   Expected: https://[project-id].supabase.co"
        echo "   Current:  $VITE_SUPABASE_URL"
    fi
else
    fail "VITE_SUPABASE_URL is not set"
fi

if [ -n "$VITE_SUPABASE_ANON_KEY" ]; then
    if [ ${#VITE_SUPABASE_ANON_KEY} -gt 100 ]; then
        pass "VITE_SUPABASE_ANON_KEY appears to be valid JWT"
    else
        warn "VITE_SUPABASE_ANON_KEY may be too short for a valid JWT"
    fi
else
    fail "VITE_SUPABASE_ANON_KEY is not set"
fi

# Backend Environment Variables (Note: These won't be available locally)
echo ""
echo "🔧 Backend Environment Variables (Supabase Edge Functions):"
info "These must be configured in Supabase Dashboard → Settings → Edge Functions → Environment Variables"

echo "   Required variables:"
echo "   - SPOTIFY_CLIENT_ID (must match VITE_SPOTIFY_CLIENT_ID)"
echo "   - SPOTIFY_CLIENT_SECRET (from Spotify Developer Dashboard)"
echo "   - SUPABASE_DB_URL (from Supabase Dashboard → Settings → Database)"

echo ""
echo "📋 PHASE 2: FILE STRUCTURE VALIDATION"
echo "====================================="

# Check critical files exist
echo ""
echo "📁 Critical Files:"

critical_files=(
    "src/services/spotify.service.ts"
    "src/services/spotifyAuthManager.service.ts"
    "src/hooks/useUnifiedSpotifyAuth.ts"
    "src/components/spotify/UnifiedSpotifyCallback.tsx"
    "src/pages/SpotifyCallback.tsx"
    "supabase/functions/spotify-auth/index.ts"
    "supabase/functions/spotify-sync-liked/index.ts"
)

for file in "${critical_files[@]}"; do
    if [ -f "$file" ]; then
        pass "Found $file"
    else
        fail "Missing critical file: $file"
    fi
done

echo ""
echo "📋 PHASE 3: CODE VALIDATION"
echo "=========================="

# Check for hardcoded values in critical files
echo ""
echo "🔍 Hardcoded Value Detection:"

# Check spotify.service.ts for hardcoded client ID
if grep -q "3bac088a26d64ddfb49d57fb5d451d71" src/services/spotify.service.ts 2>/dev/null; then
    fail "Found hardcoded client ID in spotify.service.ts"
else
    pass "No hardcoded client ID found in spotify.service.ts"
fi

# Check edge function for hardcoded redirect URI
if grep -q "https://mako-sync.vercel.app" supabase/functions/spotify-auth/index.ts 2>/dev/null; then
    warn "Found hardcoded redirect URI in spotify-auth edge function"
    echo "   This may be acceptable if it's used as fallback only"
else
    pass "No hardcoded redirect URI found in spotify-auth edge function"
fi

# Check for proper environment variable usage
if grep -q "import.meta.env.VITE_SPOTIFY_CLIENT_ID" src/services/spotify.service.ts 2>/dev/null; then
    pass "spotify.service.ts uses environment variable for client ID"
else
    fail "spotify.service.ts does not use environment variable for client ID"
fi

echo ""
echo "📋 PHASE 4: BUILD VALIDATION"
echo "=========================="

echo ""
echo "🏗️  Build Test:"

# Test build
if npm run build > /dev/null 2>&1; then
    pass "Build completed successfully"
else
    fail "Build failed - check TypeScript errors"
    echo "   Run 'npm run build' for detailed error information"
fi

# Test TypeScript compilation
if npx tsc --noEmit > /dev/null 2>&1; then
    pass "TypeScript compilation successful"
else
    warn "TypeScript compilation has warnings/errors"
    echo "   Run 'npx tsc --noEmit' for detailed information"
fi

echo ""
echo "📋 PHASE 5: SECURITY VALIDATION"
echo "=============================="

echo ""
echo "🔐 Security Checks:"

# Check for exposed secrets in code
secret_patterns=("client_secret" "CLIENT_SECRET" "password" "token" "key")
found_secrets=false

for pattern in "${secret_patterns[@]}"; do
    if grep -r "$pattern" src/ --include="*.ts" --include="*.tsx" | grep -v "// " | grep -v "console.log" > /dev/null 2>&1; then
        warn "Found potential secret pattern '$pattern' in source code"
        found_secrets=true
    fi
done

if [ "$found_secrets" = false ]; then
    pass "No obvious secret patterns found in source code"
fi

# Check for console.log statements that might leak sensitive data
if grep -r "console.log.*token\|console.log.*secret\|console.log.*password" src/ --include="*.ts" --include="*.tsx" > /dev/null 2>&1; then
    warn "Found console.log statements that might expose sensitive data"
    echo "   Review and remove before production deployment"
else
    pass "No sensitive console.log statements found"
fi

echo ""
echo "📋 PHASE 6: SPOTIFY CONFIGURATION VALIDATION"
echo "==========================================="

echo ""
echo "🎵 Spotify App Configuration:"
info "Manual verification required in Spotify Developer Dashboard:"
echo "   1. App Type: Web Application"
echo "   2. Redirect URIs must include:"
echo "      - $VITE_SPOTIFY_REDIRECT_URI (production)"
echo "      - http://localhost:8080/spotify-callback (development)"
echo "      - http://localhost:3000/spotify-callback (development fallback)"
echo "   3. Client ID matches VITE_SPOTIFY_CLIENT_ID"
echo "   4. Client Secret is configured in Supabase edge function environment"

echo ""
echo "📋 PHASE 7: DEPLOYMENT READINESS ASSESSMENT"
echo "=========================================="

echo ""
echo "📊 SUMMARY:"
echo "==========="
echo -e "✅ Passed:   ${GREEN}$PASSED${NC}"
echo -e "❌ Failed:   ${RED}$FAILED${NC}"
echo -e "⚠️  Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}🎉 PRODUCTION READY!${NC}"
        echo "All validation checks passed. The Spotify integration is ready for production deployment."
        exit 0
    else
        echo -e "${YELLOW}⚠️  PRODUCTION READY WITH WARNINGS${NC}"
        echo "All critical checks passed, but there are $WARNINGS warnings to review."
        echo "Consider addressing warnings before production deployment."
        exit 0
    fi
else
    echo -e "${RED}🚨 NOT PRODUCTION READY${NC}"
    echo "There are $FAILED critical issues that must be resolved before production deployment."
    echo ""
    echo "Next steps:"
    echo "1. Fix all failed validation checks"
    echo "2. Address warnings if possible"
    echo "3. Re-run this validation script"
    echo "4. Proceed with production deployment only after all checks pass"
    exit 1
fi