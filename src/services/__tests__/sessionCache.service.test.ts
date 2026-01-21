import { describe, it, expect, vi, beforeEach } from 'vitest';
import SessionCacheService from '../sessionCache.service';

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

describe('SessionCacheService', () => {
  let cacheService: SessionCacheService;

  beforeEach(() => {
    vi.clearAllMocks();
    cacheService = SessionCacheService.getInstance();
    cacheService.clearCache();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = SessionCacheService.getInstance();
      const instance2 = SessionCacheService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getCacheStatus', () => {
    it('should return cache status object', () => {
      const status = cacheService.getCacheStatus();
      
      expect(status).toHaveProperty('hasCached');
      expect(status).toHaveProperty('cacheAge');
      expect(status).toHaveProperty('isValid');
      expect(status).toHaveProperty('hasPending');
      expect(status).toHaveProperty('activeContexts');
      expect(status).toHaveProperty('validationInProgress');
      expect(status).toHaveProperty('concurrentValidations');
    });

    it('should report no cache initially', () => {
      const status = cacheService.getCacheStatus();
      expect(status.hasCached).toBe(false);
      expect(status.isValid).toBe(false);
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', () => {
      cacheService.clearCache();
      const status = cacheService.getCacheStatus();
      expect(status.hasCached).toBe(false);
    });
  });

  describe('isAuthStable', () => {
    it('should return true when no validations in progress', () => {
      const isStable = cacheService.isAuthStable();
      expect(isStable).toBe(true);
    });
  });

  describe('getSession', () => {
    it('should return session result', async () => {
      const result = await cacheService.getSession();

      expect(result).toHaveProperty('session');
      expect(result).toHaveProperty('error');
    });

    it('should return cached session when valid', async () => {
      // First call to populate cache
      await cacheService.getSession();

      // Second call should return cached
      const result = await cacheService.getSession();

      expect(result).toHaveProperty('session');
      expect(result).toHaveProperty('error');
    });

    it('should handle force refresh', async () => {
      const result = await cacheService.getSession(true);

      expect(result).toHaveProperty('session');
      expect(result).toHaveProperty('error');
    });

    it('should handle context parameter', async () => {
      const result = await cacheService.getSession(false, 'test-context');

      expect(result).toHaveProperty('session');
      expect(result).toHaveProperty('error');
    });

    it('should handle initialization priority', async () => {
      const result = await cacheService.getSession(false, 'init', 'initialization');

      expect(result).toHaveProperty('session');
      expect(result).toHaveProperty('error');
    });

    it('should handle background priority', async () => {
      const result = await cacheService.getSession(false, undefined, 'background');

      expect(result).toHaveProperty('session');
      expect(result).toHaveProperty('error');
    });
  });

  describe('setSessionFromAuthContext', () => {
    it('should pre-populate cache with valid session', () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'token-123',
        expires_at: Date.now() + 3600
      };

      cacheService.setSessionFromAuthContext(mockSession as any);

      const status = cacheService.getCacheStatus();
      expect(status.hasCached).toBe(true);
      expect(status.isValid).toBe(true);
    });

    it('should not set cache with null session', () => {
      cacheService.setSessionFromAuthContext(null);

      const status = cacheService.getCacheStatus();
      expect(status.hasCached).toBe(false);
    });

    it('should use pre-populated session for subsequent getSession calls', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'token-123',
        expires_at: Date.now() + 3600
      };

      cacheService.setSessionFromAuthContext(mockSession as any);

      const result = await cacheService.getSession();

      expect(result.session).toEqual(mockSession);
      expect(result.error).toBeNull();
    });
  });

  describe('forceRefresh', () => {
    it('should clear cache and return new session', async () => {
      const result = await cacheService.forceRefresh();

      expect(result).toHaveProperty('session');
      expect(result).toHaveProperty('error');
    });
  });

  describe('getCacheStatus extended', () => {
    it('should return validation status fields', () => {
      const status = cacheService.getCacheStatus();

      expect(typeof status.validationInProgress).toBe('boolean');
      expect(typeof status.concurrentValidations).toBe('number');
    });

    it('should return correct cache age when cache exists', () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'token-123',
        expires_at: Date.now() + 3600
      };

      cacheService.setSessionFromAuthContext(mockSession as any);

      const status = cacheService.getCacheStatus();

      expect(status.cacheAge).not.toBeNull();
      expect(typeof status.cacheAge).toBe('number');
    });
  });
});
