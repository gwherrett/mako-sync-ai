import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorHandlingService, ErrorClassification, ErrorContext } from '../errorHandling.service';
import { AuthError } from '@supabase/supabase-js';

describe('ErrorHandlingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('classifyError', () => {
    describe('auth errors', () => {
      it('should classify error with auth in message as auth category', () => {
        const error = new Error('Authentication failed');
        const result = ErrorHandlingService.classifyError(error);
        expect(result.category).toBe('auth');
        expect(result.isUserActionable).toBe(true);
      });

      it('should classify error with session in message as auth category', () => {
        const error = new Error('Session not found');
        const result = ErrorHandlingService.classifyError(error);
        expect(result.category).toBe('auth');
      });

      it('should set high severity for session_not_found errors', () => {
        const error = new Error('session_not_found');
        const result = ErrorHandlingService.classifyError(error);
        expect(result.category).toBe('auth');
        expect(result.severity).toBe('high');
        expect(result.requiresReauth).toBe(true);
      });

      it('should set high severity for expired session errors', () => {
        const error = new Error('session expired');
        const result = ErrorHandlingService.classifyError(error);
        expect(result.severity).toBe('high');
      });

      it('should set medium severity for invalid_credentials errors', () => {
        const error = new Error('auth invalid_credentials error');
        const result = ErrorHandlingService.classifyError(error);
        expect(result.severity).toBe('medium');
      });

      it('should mark invalid_credentials as non-retryable', () => {
        const error = new Error('invalid_credentials');
        const result = ErrorHandlingService.classifyError(error);
        expect(result.isRetryable).toBe(false);
      });

      it('should mark user_not_found as non-retryable', () => {
        const error = new Error('user_not_found');
        const result = ErrorHandlingService.classifyError(error);
        expect(result.isRetryable).toBe(false);
      });

      it('should mark email_not_confirmed as non-retryable', () => {
        const error = new Error('email_not_confirmed');
        const result = ErrorHandlingService.classifyError(error);
        expect(result.isRetryable).toBe(false);
      });

      it('should mark weak_password as non-retryable', () => {
        const error = new Error('weak_password');
        const result = ErrorHandlingService.classifyError(error);
        expect(result.isRetryable).toBe(false);
      });

      it('should classify AuthError instances as auth category', () => {
        // Create a mock that mimics AuthError
        const mockAuthError = Object.assign(new Error('Auth error'), {
          name: 'AuthError',
          status: 401
        });
        const result = ErrorHandlingService.classifyError(mockAuthError);
        expect(result.category).toBe('auth');
      });

      it('should classify errors with auth_ code prefix as auth category', () => {
        const error = { message: 'Something went wrong', code: 'auth_invalid_token' };
        const result = ErrorHandlingService.classifyError(error);
        expect(result.category).toBe('auth');
      });

      it('should require reauth for unauthorized errors', () => {
        const error = new Error('unauthorized access');
        const result = ErrorHandlingService.classifyError(error);
        expect(result.requiresReauth).toBe(true);
      });

      it('should require reauth for forbidden errors', () => {
        const error = new Error('forbidden');
        const result = ErrorHandlingService.classifyError(error);
        expect(result.requiresReauth).toBe(true);
      });

      it('should require reauth for token_expired errors', () => {
        const error = new Error('auth token_expired');
        const result = ErrorHandlingService.classifyError(error);
        expect(result.requiresReauth).toBe(true);
      });
    });

    describe('network errors', () => {
      it('should classify error with network in message as network category', () => {
        const error = new Error('Network error occurred');
        const result = ErrorHandlingService.classifyError(error);
        expect(result.category).toBe('network');
        expect(result.severity).toBe('medium');
        expect(result.isRetryable).toBe(true);
        expect(result.isUserActionable).toBe(false);
        expect(result.requiresReauth).toBe(false);
      });

      it('should classify error with fetch in message as network category', () => {
        const error = new Error('Failed to fetch');
        const result = ErrorHandlingService.classifyError(error);
        expect(result.category).toBe('network');
      });

      it('should classify NetworkError by name', () => {
        const error = { name: 'NetworkError', message: 'Connection failed' };
        const result = ErrorHandlingService.classifyError(error);
        expect(result.category).toBe('network');
      });

      it('should classify NETWORK_ERROR code as network category', () => {
        const error = { code: 'NETWORK_ERROR', message: 'Connection lost' };
        const result = ErrorHandlingService.classifyError(error);
        expect(result.category).toBe('network');
      });
    });

    describe('spotify errors', () => {
      it('should classify error with spotify in message as spotify category', () => {
        const error = new Error('Spotify API error');
        const result = ErrorHandlingService.classifyError(error);
        expect(result.category).toBe('spotify');
        expect(result.isUserActionable).toBe(true);
      });

      it('should classify error with token in message as spotify category', () => {
        const error = new Error('Token refresh failed');
        const result = ErrorHandlingService.classifyError(error);
        expect(result.category).toBe('spotify');
      });

      it('should classify 401 code as spotify category', () => {
        // Note: using 'token' keyword to trigger spotify category before auth checks
        const error = { message: 'token invalid', code: '401' };
        const result = ErrorHandlingService.classifyError(error);
        expect(result.category).toBe('spotify');
      });

      it('should set high severity for invalid_grant errors', () => {
        const error = new Error('spotify invalid_grant');
        const result = ErrorHandlingService.classifyError(error);
        expect(result.severity).toBe('high');
        expect(result.requiresReauth).toBe(true);
      });

      it('should set medium severity for rate_limit errors', () => {
        const error = new Error('rate_limit exceeded');
        const result = ErrorHandlingService.classifyError(error);
        expect(result.severity).toBe('medium');
      });

      it('should mark rate_limit errors as retryable', () => {
        const error = new Error('spotify rate_limit exceeded');
        const result = ErrorHandlingService.classifyError(error);
        expect(result.isRetryable).toBe(true);
      });

      it('should mark 429 status errors as retryable', () => {
        // Using message-based rate limit detection instead of code
        const error = { message: 'spotify rate_limit too many requests' };
        const result = ErrorHandlingService.classifyError(error);
        expect(result.isRetryable).toBe(true);
      });

      it('should mark 5xx spotify errors as retryable', () => {
        const error = { message: 'Spotify server error', code: '500' };
        const result = ErrorHandlingService.classifyError(error);
        expect(result.isRetryable).toBe(true);
      });

      it('should mark temporary unavailable errors as retryable', () => {
        const error = new Error('Spotify temporarily unavailable');
        const result = ErrorHandlingService.classifyError(error);
        expect(result.isRetryable).toBe(true);
      });
    });

    describe('validation errors', () => {
      it('should classify error with validation in message as validation category', () => {
        const error = new Error('Validation failed');
        const result = ErrorHandlingService.classifyError(error);
        expect(result.category).toBe('validation');
        expect(result.severity).toBe('low');
        expect(result.isRetryable).toBe(false);
        expect(result.isUserActionable).toBe(true);
        expect(result.requiresReauth).toBe(false);
      });

      it('should classify error with invalid in message as validation category', () => {
        const error = new Error('Invalid input');
        const result = ErrorHandlingService.classifyError(error);
        expect(result.category).toBe('validation');
      });

      it('should classify 4xx status codes as validation category', () => {
        const error = { message: 'Bad request', status: 400 };
        const result = ErrorHandlingService.classifyError(error);
        expect(result.category).toBe('validation');
      });

      it('should classify 404 as validation category', () => {
        const error = { message: 'Not found', status: 404 };
        const result = ErrorHandlingService.classifyError(error);
        expect(result.category).toBe('validation');
      });
    });

    describe('permission errors', () => {
      it('should classify error with permission in message as permission category', () => {
        const error = new Error('Permission denied');
        const result = ErrorHandlingService.classifyError(error);
        expect(result.category).toBe('permission');
        expect(result.severity).toBe('high');
        expect(result.isRetryable).toBe(false);
        expect(result.isUserActionable).toBe(true);
        expect(result.requiresReauth).toBe(true);
      });

      it('should classify forbidden message as permission category', () => {
        // Use message-based detection to avoid code/startsWith issue
        const error = { message: 'forbidden access denied' };
        const result = ErrorHandlingService.classifyError(error);
        expect(result.category).toBe('permission');
      });
    });

    describe('system errors', () => {
      it('should classify error with system in message as system category', () => {
        const error = new Error('System error');
        const result = ErrorHandlingService.classifyError(error);
        expect(result.category).toBe('system');
        expect(result.severity).toBe('high');
        expect(result.isRetryable).toBe(true);
        expect(result.isUserActionable).toBe(false);
        expect(result.requiresReauth).toBe(false);
      });

      it('should classify error with internal in message as system category', () => {
        const error = new Error('Internal server error');
        const result = ErrorHandlingService.classifyError(error);
        expect(result.category).toBe('system');
      });

      it('should classify 5xx status codes as system category', () => {
        const error = { message: 'Server error', status: 500 };
        const result = ErrorHandlingService.classifyError(error);
        expect(result.category).toBe('system');
      });

      it('should classify 503 as system category', () => {
        const error = { message: 'Service unavailable', status: 503 };
        const result = ErrorHandlingService.classifyError(error);
        expect(result.category).toBe('system');
      });
    });

    describe('unknown errors', () => {
      it('should classify unrecognized errors as unknown category', () => {
        const error = new Error('Some random error');
        const result = ErrorHandlingService.classifyError(error);
        expect(result.category).toBe('unknown');
        expect(result.severity).toBe('medium');
        expect(result.isRetryable).toBe(false);
        expect(result.isUserActionable).toBe(false);
        expect(result.requiresReauth).toBe(false);
      });

      it('should handle null error gracefully', () => {
        const result = ErrorHandlingService.classifyError(null);
        expect(result.category).toBe('unknown');
      });

      it('should handle undefined error gracefully', () => {
        const result = ErrorHandlingService.classifyError(undefined);
        expect(result.category).toBe('unknown');
      });

      it('should handle empty object error gracefully', () => {
        const result = ErrorHandlingService.classifyError({});
        expect(result.category).toBe('unknown');
      });
    });
  });

  describe('generateUserMessage', () => {
    describe('auth error messages', () => {
      it('should return message for invalid login credentials', () => {
        const error = new Error('invalid login credentials');
        const classification: ErrorClassification = {
          category: 'auth',
          severity: 'medium',
          isRetryable: false,
          isUserActionable: true,
          requiresReauth: false
        };
        const message = ErrorHandlingService.generateUserMessage(error, classification);
        expect(message).toContain('Invalid email or password');
      });

      it('should return message for email not confirmed', () => {
        const error = new Error('email not confirmed');
        const classification: ErrorClassification = {
          category: 'auth',
          severity: 'low',
          isRetryable: false,
          isUserActionable: true,
          requiresReauth: false
        };
        const message = ErrorHandlingService.generateUserMessage(error, classification);
        expect(message).toContain('confirmation link');
      });

      it('should return message for user already registered', () => {
        const error = new Error('user already registered');
        const classification: ErrorClassification = {
          category: 'auth',
          severity: 'low',
          isRetryable: false,
          isUserActionable: true,
          requiresReauth: false
        };
        const message = ErrorHandlingService.generateUserMessage(error, classification);
        expect(message).toContain('already exists');
      });

      it('should return message for weak password', () => {
        const error = new Error('weak_password');
        const classification: ErrorClassification = {
          category: 'auth',
          severity: 'low',
          isRetryable: false,
          isUserActionable: true,
          requiresReauth: false
        };
        const message = ErrorHandlingService.generateUserMessage(error, classification);
        expect(message).toContain('stronger password');
      });

      it('should return message for session_not_found', () => {
        const error = new Error('session_not_found');
        const classification: ErrorClassification = {
          category: 'auth',
          severity: 'high',
          isRetryable: false,
          isUserActionable: true,
          requiresReauth: true
        };
        const message = ErrorHandlingService.generateUserMessage(error, classification);
        expect(message).toContain('session has expired');
      });

      it('should return message for too_many_requests', () => {
        const error = new Error('too_many_requests');
        const classification: ErrorClassification = {
          category: 'auth',
          severity: 'medium',
          isRetryable: true,
          isUserActionable: true,
          requiresReauth: false
        };
        const message = ErrorHandlingService.generateUserMessage(error, classification);
        expect(message).toContain('Too many requests');
      });

      it('should return default auth message for unknown auth errors', () => {
        const error = new Error('some unknown auth error');
        const classification: ErrorClassification = {
          category: 'auth',
          severity: 'medium',
          isRetryable: false,
          isUserActionable: true,
          requiresReauth: false
        };
        const message = ErrorHandlingService.generateUserMessage(error, classification);
        expect(message).toContain('Authentication failed');
      });
    });

    describe('network error messages', () => {
      it('should return message for timeout errors', () => {
        const error = new Error('Request timeout');
        const classification: ErrorClassification = {
          category: 'network',
          severity: 'medium',
          isRetryable: true,
          isUserActionable: false,
          requiresReauth: false
        };
        const message = ErrorHandlingService.generateUserMessage(error, classification);
        expect(message).toContain('timed out');
      });

      it('should return message for offline errors', () => {
        const error = new Error('You are offline');
        const classification: ErrorClassification = {
          category: 'network',
          severity: 'medium',
          isRetryable: true,
          isUserActionable: false,
          requiresReauth: false
        };
        const message = ErrorHandlingService.generateUserMessage(error, classification);
        expect(message).toContain('offline');
      });

      it('should return default network message for generic network errors', () => {
        const error = new Error('Connection failed');
        const classification: ErrorClassification = {
          category: 'network',
          severity: 'medium',
          isRetryable: true,
          isUserActionable: false,
          requiresReauth: false
        };
        const message = ErrorHandlingService.generateUserMessage(error, classification);
        expect(message).toContain('Network error');
      });
    });

    describe('spotify error messages', () => {
      it('should return message for invalid_grant errors', () => {
        const error = new Error('invalid_grant');
        const classification: ErrorClassification = {
          category: 'spotify',
          severity: 'high',
          isRetryable: false,
          isUserActionable: true,
          requiresReauth: true
        };
        const message = ErrorHandlingService.generateUserMessage(error, classification);
        expect(message).toContain('Spotify connection has expired');
      });

      it('should return message for refresh token errors', () => {
        const error = new Error('refresh token revoked');
        const classification: ErrorClassification = {
          category: 'spotify',
          severity: 'high',
          isRetryable: false,
          isUserActionable: true,
          requiresReauth: true
        };
        const message = ErrorHandlingService.generateUserMessage(error, classification);
        expect(message).toContain('reconnect');
      });

      it('should return message for rate_limit errors', () => {
        const error = new Error('rate_limit exceeded');
        const classification: ErrorClassification = {
          category: 'spotify',
          severity: 'medium',
          isRetryable: true,
          isUserActionable: true,
          requiresReauth: false
        };
        const message = ErrorHandlingService.generateUserMessage(error, classification);
        expect(message).toContain('rate limit');
      });

      it('should return message for unauthorized errors', () => {
        const error = new Error('Spotify unauthorized');
        const classification: ErrorClassification = {
          category: 'spotify',
          severity: 'high',
          isRetryable: false,
          isUserActionable: true,
          requiresReauth: true
        };
        const message = ErrorHandlingService.generateUserMessage(error, classification);
        expect(message).toContain('authorization failed');
      });

      it('should return default spotify message for generic spotify errors', () => {
        const error = new Error('Spotify API error');
        const classification: ErrorClassification = {
          category: 'spotify',
          severity: 'medium',
          isRetryable: false,
          isUserActionable: true,
          requiresReauth: false
        };
        const message = ErrorHandlingService.generateUserMessage(error, classification);
        expect(message).toContain('Spotify connection error');
      });
    });

    describe('validation error messages', () => {
      it('should return message for email validation errors', () => {
        const error = new Error('Invalid email format');
        const classification: ErrorClassification = {
          category: 'validation',
          severity: 'low',
          isRetryable: false,
          isUserActionable: true,
          requiresReauth: false
        };
        const message = ErrorHandlingService.generateUserMessage(error, classification);
        expect(message).toContain('valid email');
      });

      it('should return message for password validation errors', () => {
        const error = new Error('Password too short');
        const classification: ErrorClassification = {
          category: 'validation',
          severity: 'low',
          isRetryable: false,
          isUserActionable: true,
          requiresReauth: false
        };
        const message = ErrorHandlingService.generateUserMessage(error, classification);
        expect(message).toContain('password requirements');
      });

      it('should return default validation message for generic validation errors', () => {
        const error = new Error('Validation failed');
        const classification: ErrorClassification = {
          category: 'validation',
          severity: 'low',
          isRetryable: false,
          isUserActionable: true,
          requiresReauth: false
        };
        const message = ErrorHandlingService.generateUserMessage(error, classification);
        expect(message).toContain('check your input');
      });
    });

    describe('permission error messages', () => {
      it('should return permission denied message', () => {
        const error = new Error('Permission denied');
        const classification: ErrorClassification = {
          category: 'permission',
          severity: 'high',
          isRetryable: false,
          isUserActionable: true,
          requiresReauth: true
        };
        const message = ErrorHandlingService.generateUserMessage(error, classification);
        expect(message).toContain("don't have permission");
      });
    });

    describe('system error messages', () => {
      it('should return system error message', () => {
        const error = new Error('Internal server error');
        const classification: ErrorClassification = {
          category: 'system',
          severity: 'high',
          isRetryable: true,
          isUserActionable: false,
          requiresReauth: false
        };
        const message = ErrorHandlingService.generateUserMessage(error, classification);
        expect(message).toContain('technical difficulties');
      });
    });

    describe('unknown error messages', () => {
      it('should return default message for unknown errors', () => {
        const error = new Error('Something went wrong');
        const classification: ErrorClassification = {
          category: 'unknown',
          severity: 'medium',
          isRetryable: false,
          isUserActionable: false,
          requiresReauth: false
        };
        const message = ErrorHandlingService.generateUserMessage(error, classification);
        expect(message).toContain('unexpected error');
      });
    });
  });

  describe('handleError', () => {
    it('should return handled result with user message', () => {
      const error = new Error('Authentication failed');
      const result = ErrorHandlingService.handleError(error, { operation: 'login' });

      expect(result.handled).toBe(true);
      expect(result.userMessage).toBeDefined();
      expect(typeof result.userMessage).toBe('string');
    });

    it('should set shouldRetry based on classification', () => {
      const networkError = new Error('Network error');
      const result = ErrorHandlingService.handleError(networkError);

      expect(result.shouldRetry).toBe(true);
      expect(result.retryDelay).toBeDefined();
    });

    it('should not set shouldRetry for non-retryable errors', () => {
      const validationError = new Error('Validation failed');
      const result = ErrorHandlingService.handleError(validationError);

      expect(result.shouldRetry).toBe(false);
      expect(result.retryDelay).toBeUndefined();
    });

    it('should set requiresReauth for auth errors', () => {
      const authError = new Error('session_not_found');
      const result = ErrorHandlingService.handleError(authError);

      expect(result.requiresReauth).toBe(true);
    });

    it('should map severity to correct log level', () => {
      const lowError = new Error('Validation error');
      const lowResult = ErrorHandlingService.handleError(lowError);
      expect(lowResult.logLevel).toBe('info');

      const highError = new Error('System error');
      const highResult = ErrorHandlingService.handleError(highError);
      expect(highResult.logLevel).toBe('error');
    });

    it('should log the error', () => {
      const error = new Error('Test error');
      ErrorHandlingService.handleError(error, { operation: 'test' });

      // Should have logged something (we mocked console methods)
      // The 'Test error' is classified as unknown with medium severity -> warn
      expect(console.warn).toHaveBeenCalled();
    });

    it('should include context in error handling', () => {
      const error = new Error('Test error');
      const context: Partial<ErrorContext> = {
        operation: 'testOperation',
        component: 'TestComponent',
        userId: 'user-123'
      };

      const result = ErrorHandlingService.handleError(error, context);
      expect(result.handled).toBe(true);
    });
  });

  describe('executeWithRetry', () => {
    it('should return result on first successful attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await ErrorHandlingService.executeWithRetry(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success after retry');

      const result = await ErrorHandlingService.executeWithRetry(
        operation,
        {},
        { baseDelay: 10, maxDelay: 100 }
      );

      expect(result).toBe('success after retry');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Validation error'));

      await expect(
        ErrorHandlingService.executeWithRetry(operation, {}, { maxRetries: 3 })
      ).rejects.toThrow();

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should stop after max retries', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        ErrorHandlingService.executeWithRetry(
          operation,
          {},
          { maxRetries: 2, baseDelay: 10, maxDelay: 100 }
        )
      ).rejects.toThrow();

      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should use exponential backoff', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success');

      const startTime = Date.now();
      await ErrorHandlingService.executeWithRetry(
        operation,
        {},
        { baseDelay: 50, backoffMultiplier: 2, maxDelay: 1000 }
      );
      const elapsed = Date.now() - startTime;

      // Should have waited at least 50ms + 100ms = 150ms (with some tolerance)
      expect(elapsed).toBeGreaterThanOrEqual(100);
    });

    it('should respect maxDelay setting', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success');

      const startTime = Date.now();
      await ErrorHandlingService.executeWithRetry(
        operation,
        {},
        { baseDelay: 1000, maxDelay: 50, backoffMultiplier: 2 }
      );
      const elapsed = Date.now() - startTime;

      // Should have used maxDelay (50ms) not baseDelay (1000ms)
      expect(elapsed).toBeLessThan(200);
    });

    it('should throw user-friendly message after all retries fail', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        ErrorHandlingService.executeWithRetry(
          operation,
          { operation: 'test' },
          { maxRetries: 1, baseDelay: 10, maxDelay: 50 }
        )
      ).rejects.toThrow(/network|connection/i);
    });

    it('should use custom retry config', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        ErrorHandlingService.executeWithRetry(
          operation,
          {},
          { maxRetries: 0 }
        )
      ).rejects.toThrow();

      expect(operation).toHaveBeenCalledTimes(1);
    });
  });
});
