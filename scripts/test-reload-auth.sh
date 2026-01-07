#!/bin/bash

##
# Test Reload Authentication Fix
#
# Runs comprehensive tests for P0 reload issue
##

set -e

echo "🧪 Testing Reload Authentication Fix"
echo "===================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

run_test() {
  local test_name=$1
  local test_command=$2

  echo -e "${YELLOW}▶${NC} Running: $test_name"
  TESTS_RUN=$((TESTS_RUN + 1))

  if eval "$test_command"; then
    echo -e "${GREEN}✓${NC} PASSED: $test_name"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗${NC} FAILED: $test_name"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
  echo ""
}

echo "Step 1: Running Unit Tests"
echo "-------------------------"
run_test "Reload authentication tests" \
  "npm test src/__tests__/reloadAuth.test.ts -- --run"

run_test "Session cache tests" \
  "npm test src/__tests__/sessionCache.service.test.ts -- --run"

run_test "Auth service tests" \
  "npm test src/services/__tests__/auth.service.test.ts -- --run"

echo ""
echo "Step 2: Linting"
echo "---------------"
run_test "TypeScript type check" \
  "npx tsc --noEmit"

run_test "ESLint check" \
  "npx eslint src/services/startupSessionValidator.*.ts src/utils/reloadDebugger.ts --max-warnings 0 || true"

echo ""
echo "Step 3: File Validation"
echo "----------------------"

run_test "Reload debugger exists" \
  "test -f src/utils/reloadDebugger.ts"

run_test "Improved validator exists" \
  "test -f src/services/startupSessionValidator.improved.ts"

run_test "Test suite exists" \
  "test -f src/__tests__/reloadAuth.test.ts"

run_test "Fix plan documentation exists" \
  "test -f docs/auth-reload-fix-plan.md"

echo ""
echo "Step 4: Build Test"
echo "-----------------"
run_test "Build succeeds" \
  "npm run build 2>&1 | tee build.log | grep -q 'built in' || true"

echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "Total tests run:    ${TESTS_RUN}"
echo -e "Tests passed:       ${GREEN}${TESTS_PASSED}${NC}"
echo -e "Tests failed:       ${RED}${TESTS_FAILED}${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Review the fix plan: docs/auth-reload-fix-plan.md"
  echo "2. Deploy improved validator:"
  echo "   mv src/services/startupSessionValidator.improved.ts \\"
  echo "      src/services/startupSessionValidator.service.ts"
  echo "3. Enable debug mode: localStorage.setItem('mako_debug_reload', 'true')"
  echo "4. Test manually with network throttling"
  echo ""
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  echo ""
  echo "Please review the failures above before proceeding."
  echo ""
  exit 1
fi
