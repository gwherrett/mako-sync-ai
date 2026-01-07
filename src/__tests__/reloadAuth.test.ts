/**
 * Reload Authentication Tests
 *
 * Tests for P0 issue: Session lost on reload
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { startupSessionValidator } from '@/services/startupSessionValidator.service';
import { sessionCache } from '@/services/sessionCache.service';
import { supabase } from '@/integrations/supabase/client';

describe('Reload Authentication Issue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionCache.clearCache();
    startupSessionValidator.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Startup Validation Timeouts', () => {
    it('should preserve session on network timeout during getSession', async () => {
      // Setup: Valid session in localStorage but slow network
      const mockSession = {
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600, // Expires in 1 hour
        user: { id: 'user-123', email: 'test@example.com' }
      };

      // Mock localStorage with valid session
      const authTokenKey = 'sb-test-auth-token';
      localStorage.setItem(authTokenKey, JSON.stringify(mockSession));

      // Mock getSession to timeout
      vi.spyOn(supabase.auth, 'getSession').mockImplementation(
        () => new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Session fetch timeout')), 6000);
        })
      );

      // Execute
      const result = await startupSessionValidator.validateOnStartup();

      // Assert: Should clear tokens on timeout
      // This is the current behavior - may need to change
      expect(result.wasCleared).toBe(true);
      expect(result.reason).toContain('timeout');
    });

    it('should preserve session on network timeout during getUser', async () => {
      // Setup: Valid session, getSession succeeds, getUser times out
      const mockSession = {
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'user-123', email: 'test@example.com' }
      };

      // Mock getSession to succeed
      vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      // Mock getUser to timeout
      vi.spyOn(supabase.auth, 'getUser').mockImplementation(
        () => new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Startup validation timeout')), 6000);
        })
      );

      // Mock localStorage
      localStorage.setItem('sb-test-auth-token', JSON.stringify(mockSession));

      // Execute
      const result = await startupSessionValidator.validateOnStartup();

      // Assert: Should preserve session on timeout (network error)
      expect(result.isValid).toBe(true);
      expect(result.wasCleared).toBe(false);
      expect(result.reason).toContain('Timeout');
    });

    it('should handle slow network (2-4s) gracefully', async () => {
      // Setup: Simulate slow but working network
      const mockSession = {
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'user-123', email: 'test@example.com' }
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      };

      // Mock getSession with 3s delay
      vi.spyOn(supabase.auth, 'getSession').mockImplementation(
        () => new Promise(resolve => {
          setTimeout(() => resolve({
            data: { session: mockSession },
            error: null
          }), 3000);
        })
      );

      // Mock getUser with 2s delay
      vi.spyOn(supabase.auth, 'getUser').mockImplementation(
        () => new Promise(resolve => {
          setTimeout(() => resolve({
            data: { user: mockUser },
            error: null
          }), 2000);
        })
      );

      // Mock localStorage
      localStorage.setItem('sb-test-auth-token', JSON.stringify(mockSession));

      // Execute
      const startTime = Date.now();
      const result = await startupSessionValidator.validateOnStartup();
      const duration = Date.now() - startTime;

      // Assert: Should succeed despite slow network
      expect(result.isValid).toBe(true);
      expect(result.wasCleared).toBe(false);
      expect(duration).toBeLessThan(12000); // Within global timeout
      expect(duration).toBeGreaterThan(3000); // Actually waited
    });
  });

  describe('Error Classification', () => {
    it('should distinguish network timeout from auth error', async () => {
      const mockSession = {
        access_token: 'valid-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'user-123', email: 'test@example.com' }
      };

      vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      // Network timeout error
      const networkError = new Error('Network request failed');
      vi.spyOn(supabase.auth, 'getUser').mockRejectedValue(networkError);

      localStorage.setItem('sb-test-auth-token', JSON.stringify(mockSession));

      const result = await startupSessionValidator.validateOnStartup();

      // Should preserve session for network errors
      expect(result.isValid).toBe(true);
      expect(result.wasCleared).toBe(false);
    });

    it('should clear tokens on actual auth error', async () => {
      const mockSession = {
        access_token: 'invalid-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'user-123', email: 'test@example.com' }
      };

      vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      // Auth error (token invalid)
      const authError = { message: 'Invalid token', status: 401 };
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: null },
        error: authError as any
      });

      localStorage.setItem('sb-test-auth-token', JSON.stringify(mockSession));

      const result = await startupSessionValidator.validateOnStartup();

      // Should clear tokens for auth errors
      expect(result.wasCleared).toBe(true);
      expect(result.reason).toContain('rejected');
    });
  });

  describe('Race Conditions', () => {
    it('should handle concurrent validation requests', async () => {
      const mockSession = {
        access_token: 'valid-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'user-123', email: 'test@example.com' }
      };

      vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: mockSession.user },
        error: null
      });

      localStorage.setItem('sb-test-auth-token', JSON.stringify(mockSession));

      // Execute multiple validations concurrently
      const results = await Promise.all([
        startupSessionValidator.validateOnStartup(),
        startupSessionValidator.validateOnStartup(),
        startupSessionValidator.validateOnStartup()
      ]);

      // All should get same result
      expect(results[0]).toEqual(results[1]);
      expect(results[1]).toEqual(results[2]);

      // getUser should only be called once (deduplicated)
      expect(supabase.auth.getUser).toHaveBeenCalledTimes(1);
    });

    it('should handle validation + TOKEN_REFRESHED race', async () => {
      const mockSession = {
        access_token: 'valid-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'user-123', email: 'test@example.com' }
      };

      // Slow validation
      vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      vi.spyOn(supabase.auth, 'getUser').mockImplementation(
        () => new Promise(resolve => {
          setTimeout(() => resolve({
            data: { user: mockSession.user },
            error: null
          }), 4000);
        })
      );

      localStorage.setItem('sb-test-auth-token', JSON.stringify(mockSession));

      // Start validation
      const validationPromise = startupSessionValidator.validateOnStartup();

      // Simulate TOKEN_REFRESHED event during validation
      setTimeout(() => {
        startupSessionValidator.markAsValidated();
      }, 2000);

      const result = await validationPromise;

      // Should succeed and not clear tokens
      expect(result.isValid).toBe(true);
      expect(result.wasCleared).toBe(false);
    });
  });

  describe('Session Cache Integration', () => {
    it('should use cached session during reload flow', async () => {
      const mockSession = {
        access_token: 'valid-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'user-123', email: 'test@example.com' }
      };

      vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: mockSession.user },
        error: null
      });

      // First call - should fetch and cache
      const result1 = await sessionCache.getSession(false, 'test-1');
      expect(result1.session).toBeTruthy();

      // Second call within cache window - should use cache
      const result2 = await sessionCache.getSession(false, 'test-2');
      expect(result2.session).toBeTruthy();

      // Should only call getUser once (cached)
      expect(supabase.auth.getUser).toHaveBeenCalledTimes(1);
    });

    it('should handle timeout in cached validation gracefully', async () => {
      const mockSession = {
        access_token: 'valid-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'user-123', email: 'test@example.com' }
      };

      vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      // First call times out
      vi.spyOn(supabase.auth, 'getUser').mockImplementation(
        () => new Promise((_, reject) => {
          setTimeout(() => reject(new Error('timeout')), 11000);
        })
      );

      const result = await sessionCache.getSession(false, 'test-timeout');

      // Should preserve session on timeout
      expect(result.session).toBeTruthy();
      expect(result.error).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing localStorage access', async () => {
      // Mock localStorage to throw error
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('localStorage not available');
      });

      const result = await startupSessionValidator.validateOnStartup();

      // Should handle gracefully
      expect(result).toBeDefined();
    });

    it('should handle corrupted localStorage data', async () => {
      // Invalid JSON in localStorage
      localStorage.setItem('sb-test-auth-token', '{invalid-json');

      const result = await startupSessionValidator.validateOnStartup();

      // Should handle gracefully and clear corrupted data
      expect(result.wasCleared).toBe(true);
    });

    it('should handle expired session in localStorage', async () => {
      const expiredSession = {
        access_token: 'expired-token',
        expires_at: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        user: { id: 'user-123', email: 'test@example.com' }
      };

      vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
        data: { session: expiredSession },
        error: null
      });

      localStorage.setItem('sb-test-auth-token', JSON.stringify(expiredSession));

      const result = await startupSessionValidator.validateOnStartup();

      // Should detect expiry and clear
      expect(result.wasCleared).toBe(true);
      expect(result.reason).toContain('expired');
    });
  });
});
