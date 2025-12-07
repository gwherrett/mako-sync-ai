# Authentication Flow Testing Guide

## Overview

This guide provides comprehensive instructions for testing the Mako Sync authentication system using command-line tools. The testing suite covers all aspects of authentication flow as outlined in the command-line testing tasks.

## Test Scripts Available

### 1. Quick Connectivity Check
**Script:** `scripts/quick-connectivity-check.sh`
**Purpose:** Fast verification of basic connectivity and environment setup
**Duration:** ~10 seconds

```bash
./scripts/quick-connectivity-check.sh
```

**Tests Performed:**
- Environment variables check
- Basic Supabase connectivity
- Auth endpoint accessibility

### 2. Basic Connectivity Tests
**Script:** `scripts/basic-connectivity-tests.sh`
**Purpose:** Comprehensive connectivity and error handling tests
**Duration:** ~30 seconds

```bash
./scripts/basic-connectivity-tests.sh
```

**Tests Performed:**
- Environment variables validation
- Script permissions check
- Supabase health check
- Auth endpoint accessibility
- Invalid credentials handling
- Network error handling
- Invalid API key handling
- Response time performance

### 3. Debug Auth Endpoints
**Script:** `scripts/debug-auth-endpoints.sh`
**Purpose:** Interactive authentication flow testing with real credentials
**Duration:** ~60 seconds (requires user input)

```bash
./scripts/debug-auth-endpoints.sh
```

**Tests Performed:**
- Supabase health check
- Auth session endpoint test
- Sign in with user credentials
- Authenticated request test
- Session refresh test
- Sign out test

### 4. Session Management Tests
**Script:** `scripts/session-management-tests.sh`
**Purpose:** Comprehensive session lifecycle and token management testing
**Duration:** ~90 seconds (requires user input)

```bash
./scripts/session-management-tests.sh
```

**Tests Performed:**
- Initial sign in
- Token extraction
- Session persistence (multiple requests)
- Token refresh
- New token validation
- Concurrent session requests
- Session logout
- Post-logout token validation

### 5. Comprehensive Integration Tests
**Script:** `scripts/auth-integration-tests.sh`
**Purpose:** Complete end-to-end authentication flow testing
**Duration:** ~120 seconds (requires user input)

```bash
./scripts/auth-integration-tests.sh
```

**Tests Performed:**
- Environment setup verification
- Basic connectivity tests
- Authentication flow tests
- Session management tests
- Error handling tests
- Performance tests
- Session cleanup tests

## Test Execution Order

### For Quick Verification
```bash
# 1. Quick check (essential tests only)
./scripts/quick-connectivity-check.sh

# 2. If quick check passes, run basic tests
./scripts/basic-connectivity-tests.sh
```

### For Complete Testing
```bash
# 1. Start with basic connectivity
./scripts/basic-connectivity-tests.sh

# 2. Test authentication endpoints
./scripts/debug-auth-endpoints.sh

# 3. Test session management
./scripts/session-management-tests.sh

# 4. Run comprehensive integration tests
./scripts/auth-integration-tests.sh
```

### For Automated CI/CD
```bash
# Run non-interactive tests only
./scripts/quick-connectivity-check.sh && ./scripts/basic-connectivity-tests.sh
```

## Test Requirements

### Environment Setup
1. **Environment File:** `.env` file must exist with required variables
2. **Required Variables:**
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

### Test Credentials
For interactive tests, you'll need:
- Valid test email address
- Corresponding password
- User must exist in Supabase Auth

### System Requirements
- `curl` command available
- `bash` shell
- `bc` calculator (for some performance tests)
- Internet connectivity to Supabase

## Expected Results

### Success Indicators
```
✅ All environment variables present
✅ Health check: 200 OK
✅ Auth endpoints: 200/401/403 OK (endpoint accessible)
✅ Sign in: 200 OK with tokens
✅ Authenticated requests: 200 OK
✅ Token refresh: 200 OK
✅ Sign out: 200 OK
✅ Post-logout token invalidation: 401/403 OK
```

### Common Failure Patterns
```
❌ Missing environment variables → Check .env file
❌ Health check fails → Network/Supabase connectivity issue
❌ Auth endpoints 404 → Incorrect Supabase URL
❌ Sign in fails → Invalid credentials or auth configuration
❌ Token refresh fails → Session/token management issue
❌ Performance issues → Network latency or server problems
```

## Troubleshooting

### Environment Issues
```bash
# Check environment variables
cat .env | grep -E "(VITE_SUPABASE_URL|VITE_SUPABASE_ANON_KEY)"

# Verify script permissions
ls -la scripts/*.sh
```

### Connectivity Issues
```bash
# Test basic network connectivity
ping supabase.com

# Test Supabase URL directly
curl -I "$VITE_SUPABASE_URL"
```

### Authentication Issues
```bash
# Test with curl directly
curl -X POST \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email","password":"your-password"}' \
  "$VITE_SUPABASE_URL/auth/v1/token?grant_type=password"
```

## Test Coverage Matrix

| Test Category | Quick Check | Basic Tests | Debug Auth | Session Mgmt | Integration |
|---------------|-------------|-------------|------------|--------------|-------------|
| Environment Setup | ✅ | ✅ | ✅ | ✅ | ✅ |
| Basic Connectivity | ✅ | ✅ | ✅ | ✅ | ✅ |
| Auth Endpoints | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sign In Flow | ❌ | ❌ | ✅ | ✅ | ✅ |
| Token Management | ❌ | ❌ | ✅ | ✅ | ✅ |
| Session Persistence | ❌ | ❌ | ❌ | ✅ | ✅ |
| Error Handling | ❌ | ✅ | ❌ | ❌ | ✅ |
| Performance Tests | ❌ | ✅ | ❌ | ❌ | ✅ |
| Concurrent Requests | ❌ | ❌ | ❌ | ✅ | ✅ |
| Session Cleanup | ❌ | ❌ | ✅ | ✅ | ✅ |

## Integration with CI/CD

### GitHub Actions Example
```yaml
name: Auth Flow Tests
on: [push, pull_request]

jobs:
  auth-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup environment
        run: |
          echo "VITE_SUPABASE_URL=${{ secrets.SUPABASE_URL }}" >> .env
          echo "VITE_SUPABASE_ANON_KEY=${{ secrets.SUPABASE_ANON_KEY }}" >> .env
      - name: Run connectivity tests
        run: |
          chmod +x scripts/*.sh
          ./scripts/basic-connectivity-tests.sh
```

### Docker Testing
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY scripts/ ./scripts/
COPY .env ./
RUN apk add --no-cache curl bash bc
CMD ["./scripts/basic-connectivity-tests.sh"]
```

## Performance Benchmarks

### Expected Response Times
- Health check: < 500ms
- Auth endpoint check: < 500ms
- Sign in: < 1000ms
- Token refresh: < 500ms
- Authenticated requests: < 500ms

### Concurrent Request Handling
- Should handle 3+ concurrent requests without errors
- No 500 errors under normal load
- Consistent response times

## Security Considerations

### Test Data
- Use dedicated test accounts
- Avoid production credentials
- Rotate test passwords regularly

### Network Security
- Tests validate SSL/TLS connectivity
- API key validation
- Proper error responses for invalid credentials

## Reporting Issues

When reporting authentication test failures, include:

1. **Test Script Used:** Which specific script failed
2. **Error Output:** Complete error messages and status codes
3. **Environment Details:** OS, network setup, Supabase project
4. **Reproduction Steps:** Exact commands run
5. **Expected vs Actual:** What should have happened vs what did happen

### Log Collection
```bash
# Run tests with verbose output
./scripts/auth-integration-tests.sh 2>&1 | tee auth-test-results.log

# Check environment
env | grep VITE_ > environment.log

# Network diagnostics
curl -v "$VITE_SUPABASE_URL/rest/v1/" > network-test.log 2>&1
```

## Maintenance

### Regular Testing Schedule
- **Daily:** Quick connectivity check
- **Weekly:** Basic connectivity tests
- **Monthly:** Full integration tests
- **Before Releases:** Complete test suite

### Script Updates
- Keep scripts in sync with API changes
- Update test credentials as needed
- Review and update expected response codes
- Add new test cases for new features

This comprehensive testing approach ensures reliable authentication functionality and provides clear diagnostic information for troubleshooting issues.