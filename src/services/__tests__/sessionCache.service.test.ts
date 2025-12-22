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
  });
});
