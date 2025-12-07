#!/bin/bash

# Authentication Test Runner for Mako Sync
# Provides easy access to all authentication flow tests

echo "🚀 Mako Sync Authentication Test Runner"
echo "======================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print menu options
print_menu() {
    echo ""
    echo -e "${CYAN}Available Test Suites:${NC}"
    echo "1. Quick Connectivity Check (~10 seconds)"
    echo "2. Basic Connectivity Tests (~30 seconds)"
    echo "3. Debug Auth Endpoints (requires credentials, ~60 seconds)"
    echo "4. Session Management Tests (requires credentials, ~90 seconds)"
    echo "5. Comprehensive Integration Tests (requires credentials, ~120 seconds)"
    echo "6. Run All Non-Interactive Tests (~40 seconds)"
    echo "7. Run All Tests (requires credentials, ~300 seconds)"
    echo "8. View Test Documentation"
    echo "9. Exit"
    echo ""
}

# Function to run a test with error handling
run_test() {
    local script_name="$1"
    local test_description="$2"
    
    echo -e "\n${BLUE}Running: $test_description${NC}"
    echo "Script: $script_name"
    echo "----------------------------------------"
    
    if [ ! -f "$script_name" ]; then
        echo -e "${RED}❌ Error: Script not found: $script_name${NC}"
        return 1
    fi
    
    if [ ! -x "$script_name" ]; then
        echo -e "${YELLOW}⚠️  Making script executable...${NC}"
        chmod +x "$script_name"
    fi
    
    if ./"$script_name"; then
        echo -e "\n${GREEN}✅ $test_description completed successfully${NC}"
        return 0
    else
        echo -e "\n${RED}❌ $test_description failed${NC}"
        return 1
    fi
}

# Function to check prerequisites
check_prerequisites() {
    echo -e "${BLUE}Checking prerequisites...${NC}"
    
    # Check .env file
    if [ ! -f .env ]; then
        echo -e "${RED}❌ .env file not found${NC}"
        echo "Please create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY"
        return 1
    fi
    
    # Check environment variables
    source .env
    if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
        echo -e "${RED}❌ Missing required environment variables${NC}"
        echo "Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env"
        return 1
    fi
    
    # Check required commands
    for cmd in curl bash; do
        if ! command -v $cmd &> /dev/null; then
            echo -e "${RED}❌ Required command not found: $cmd${NC}"
            return 1
        fi
    done
    
    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
    return 0
}

# Function to run all non-interactive tests
run_non_interactive() {
    echo -e "\n${CYAN}Running All Non-Interactive Tests${NC}"
    echo "=================================="
    
    local failed_tests=0
    
    run_test "scripts/quick-connectivity-check.sh" "Quick Connectivity Check" || ((failed_tests++))
    run_test "scripts/basic-connectivity-tests.sh" "Basic Connectivity Tests" || ((failed_tests++))
    
    echo ""
    echo "=================================="
    if [ $failed_tests -eq 0 ]; then
        echo -e "${GREEN}🎉 All non-interactive tests passed!${NC}"
    else
        echo -e "${RED}❌ $failed_tests test(s) failed${NC}"
    fi
    
    return $failed_tests
}

# Function to run all tests
run_all_tests() {
    echo -e "\n${CYAN}Running All Authentication Tests${NC}"
    echo "================================="
    
    local failed_tests=0
    
    run_test "scripts/quick-connectivity-check.sh" "Quick Connectivity Check" || ((failed_tests++))
    run_test "scripts/basic-connectivity-tests.sh" "Basic Connectivity Tests" || ((failed_tests++))
    run_test "scripts/debug-auth-endpoints.sh" "Debug Auth Endpoints" || ((failed_tests++))
    run_test "scripts/session-management-tests.sh" "Session Management Tests" || ((failed_tests++))
    run_test "scripts/auth-integration-tests.sh" "Comprehensive Integration Tests" || ((failed_tests++))
    
    echo ""
    echo "================================="
    if [ $failed_tests -eq 0 ]; then
        echo -e "${GREEN}🎉 ALL AUTHENTICATION TESTS PASSED!${NC}"
        echo -e "${GREEN}✅ Complete authentication flow is working properly${NC}"
    else
        echo -e "${RED}❌ $failed_tests test suite(s) failed${NC}"
        echo -e "${YELLOW}⚠️  Please review the failed tests above${NC}"
    fi
    
    return $failed_tests
}

# Function to show documentation
show_documentation() {
    echo -e "\n${CYAN}Authentication Flow Testing Documentation${NC}"
    echo "========================================"
    
    if [ -f "docs/auth-flow-testing-guide.md" ]; then
        echo "Opening documentation..."
        if command -v less &> /dev/null; then
            less docs/auth-flow-testing-guide.md
        elif command -v more &> /dev/null; then
            more docs/auth-flow-testing-guide.md
        else
            cat docs/auth-flow-testing-guide.md
        fi
    else
        echo -e "${RED}❌ Documentation file not found: docs/auth-flow-testing-guide.md${NC}"
    fi
}

# Main execution
main() {
    # Check prerequisites first
    if ! check_prerequisites; then
        echo -e "\n${RED}❌ Prerequisites check failed. Please fix the issues above.${NC}"
        exit 1
    fi
    
    # Interactive menu
    while true; do
        print_menu
        read -p "Select an option (1-9): " choice
        
        case $choice in
            1)
                run_test "scripts/quick-connectivity-check.sh" "Quick Connectivity Check"
                ;;
            2)
                run_test "scripts/basic-connectivity-tests.sh" "Basic Connectivity Tests"
                ;;
            3)
                run_test "scripts/debug-auth-endpoints.sh" "Debug Auth Endpoints"
                ;;
            4)
                run_test "scripts/session-management-tests.sh" "Session Management Tests"
                ;;
            5)
                run_test "scripts/auth-integration-tests.sh" "Comprehensive Integration Tests"
                ;;
            6)
                run_non_interactive
                ;;
            7)
                run_all_tests
                ;;
            8)
                show_documentation
                ;;
            9)
                echo -e "\n${GREEN}Thank you for using the Authentication Test Runner!${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}❌ Invalid option. Please select 1-9.${NC}"
                ;;
        esac
        
        echo ""
        read -p "Press Enter to continue..."
    done
}

# Handle command line arguments
if [ $# -gt 0 ]; then
    case $1 in
        --quick)
            check_prerequisites && run_test "scripts/quick-connectivity-check.sh" "Quick Connectivity Check"
            ;;
        --basic)
            check_prerequisites && run_test "scripts/basic-connectivity-tests.sh" "Basic Connectivity Tests"
            ;;
        --debug)
            check_prerequisites && run_test "scripts/debug-auth-endpoints.sh" "Debug Auth Endpoints"
            ;;
        --session)
            check_prerequisites && run_test "scripts/session-management-tests.sh" "Session Management Tests"
            ;;
        --integration)
            check_prerequisites && run_test "scripts/auth-integration-tests.sh" "Comprehensive Integration Tests"
            ;;
        --non-interactive)
            check_prerequisites && run_non_interactive
            ;;
        --all)
            check_prerequisites && run_all_tests
            ;;
        --help)
            echo "Mako Sync Authentication Test Runner"
            echo ""
            echo "Usage: $0 [option]"
            echo ""
            echo "Options:"
            echo "  --quick           Run quick connectivity check"
            echo "  --basic           Run basic connectivity tests"
            echo "  --debug           Run debug auth endpoints test"
            echo "  --session         Run session management tests"
            echo "  --integration     Run comprehensive integration tests"
            echo "  --non-interactive Run all non-interactive tests"
            echo "  --all             Run all tests"
            echo "  --help            Show this help message"
            echo ""
            echo "If no option is provided, interactive menu will be shown."
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            echo "Use --help for available options"
            exit 1
            ;;
    esac
else
    # Run interactive menu
    main
fi