# Spotify Authentication Integration Tests

This document contains the comprehensive test steps that were previously available through the `spotify-auth-test` UI component. These tests validate the unified Spotify authentication system.

## Overview

The Spotify Authentication Integration Tests provide comprehensive validation of the unified Spotify authentication system, covering connection management, OAuth flow, token handling, state management, error scenarios, and security checks.

## Test Environment

- Tests cover connection management, OAuth flow, token handling, and error scenarios
- Some tests are mocked for safety and to avoid actual API calls during testing
- Real authentication flows can be tested through the main application interface
- Results show detailed information about each test component

## Test Suites

### 1. Connection Management Tests

**Purpose**: Validate basic connection state and object structure

**Tests**:
1. **Check initial connection state**
   - Validates `isConnected` is boolean
   - Validates `isLoading` is boolean
   - Returns current connection state

2. **Validate connection object structure**
   - Checks required fields: `id`, `user_id`, `spotify_user_id`, `expires_at`
   - Ensures all required fields are present when connected

3. **Test connection status consistency**
   - Verifies connection status remains consistent over time
   - Checks for state stability

4. **Verify loading states**
   - Ensures loading state is not true when connected
   - Validates loading state logic

### 2. Authentication Flow Tests

**Purpose**: Validate OAuth implementation and security measures

**Tests**:
1. **Test OAuth initiation**
   - Validates `connectSpotify` function exists
   - Ensures OAuth flow can be initiated

2. **Validate state parameter generation**
   - Checks state parameter length (minimum 10 characters)
   - Ensures proper randomization

3. **Check redirect URL construction**
   - Validates redirect URL includes `/spotify-callback`
   - Ensures proper URL formation

4. **Verify PKCE implementation**
   - Validates code verifier length (minimum 43 characters)
   - Ensures PKCE security measures

### 3. Token Management Tests

**Purpose**: Validate token handling, refresh, and vault storage

**Tests**:
1. **Test token refresh mechanism**
   - Validates `refreshTokens` function exists
   - Ensures refresh capability is available

2. **Validate token expiry handling**
   - Checks token expiration time calculation
   - Returns time until expiry in minutes

3. **Check vault storage integration**
   - Validates tokens are encrypted: `***ENCRYPTED_IN_VAULT***`
   - Ensures vault secret IDs are present
   - Prevents token exposure in plain text

4. **Verify automatic refresh triggers**
   - Tests refresh logic when tokens expire within 5 minutes
   - Validates automatic refresh timing

### 4. State Management Tests

**Purpose**: Validate state synchronization and subscription patterns

**Tests**:
1. **Test state synchronization**
   - Compares initial and later states for consistency
   - Validates state stability over time

2. **Validate subscription pattern**
   - Tests callback mechanism for state changes
   - Ensures subscription notifications work

3. **Check race condition prevention**
   - Tests concurrent operations handling
   - Validates promise deduplication

4. **Verify cleanup on unmount**
   - Ensures proper cleanup when components unmount
   - Prevents memory leaks

### 5. Error Handling Tests

**Purpose**: Validate error scenarios and recovery mechanisms

**Tests**:
1. **Test network error scenarios**
   - Simulates network timeout errors
   - Validates error handling for network issues

2. **Validate API error responses**
   - Tests API error structure validation
   - Ensures proper error response handling

3. **Check timeout handling**
   - Tests timeout scenarios (100ms timeout)
   - Validates timeout error handling

4. **Verify error recovery mechanisms**
   - Tests error recovery after temporary failures
   - Validates resilience mechanisms

### 6. Security & Health Tests

**Purpose**: Validate security measures and health monitoring

**Tests**:
1. **Test health monitoring**
   - Validates health status values: `healthy`, `warning`, `error`, `unknown`
   - Ensures health monitoring functionality

2. **Validate security checks**
   - Tests `validateSecurity()` function
   - Ensures security validation works

3. **Check token exposure prevention**
   - Validates tokens are stored as `***ENCRYPTED_IN_VAULT***`
   - Prevents plain text token exposure
   - Ensures vault integration

4. **Verify audit trail logging**
   - Tests audit trail functionality
   - Ensures security logging is active

## Test Execution Flow

The tests run in the following sequence:

1. **Connection Management** (16.67% progress)
2. **Authentication Flow** (33.33% progress)
3. **Token Management** (50% progress)
4. **State Management** (66.67% progress)
5. **Error Handling** (83.33% progress)
6. **Security & Health** (100% progress)

## Test Results Format

Each test provides:
- **Status**: `pending`, `running`, `passed`, `failed`
- **Duration**: Execution time in milliseconds
- **Message**: Success/failure message
- **Details**: Additional test-specific data

## Manual Testing Guidelines

For manual testing of the authentication system:

1. **Connection Testing**:
   - Navigate to the main application
   - Test Spotify connection/disconnection
   - Verify connection status updates

2. **OAuth Flow Testing**:
   - Initiate Spotify authentication
   - Complete OAuth flow in browser
   - Verify successful callback handling

3. **Token Management Testing**:
   - Check token refresh functionality
   - Verify vault storage (tokens should show as encrypted)
   - Test automatic refresh near expiry

4. **Error Scenario Testing**:
   - Test with invalid credentials
   - Test network disconnection scenarios
   - Verify error recovery mechanisms

## Implementation Notes

- Tests use the `useUnifiedSpotifyAuth` hook
- Some tests are mocked to prevent actual API calls
- Real authentication can be tested through the main UI
- Tests validate the SpotifyAuthManager singleton pattern
- Token vault storage is verified for security compliance

## Related Documentation

- [Spotify Authentication Migration Guide](./spotify-authentication-migration-guide.md)
- [Authentication System Documentation](./systems/authentication.md)
- [Spotify Integration Documentation](./systems/spotify-integration.md)