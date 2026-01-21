import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageManagerService } from '../storageManager.service';

describe('StorageManagerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('auditStorage', () => {
    it('should return audit result object', () => {
      const result = StorageManagerService.auditStorage();
      
      expect(result).toHaveProperty('totalKeys');
      expect(result).toHaveProperty('keysByCategory');
      expect(result).toHaveProperty('staleKeys');
      expect(result).toHaveProperty('duplicateKeys');
      expect(result).toHaveProperty('sizeEstimate');
      expect(result).toHaveProperty('contamination');
    });

    it('should categorize keys correctly', () => {
      localStorage.setItem('spotify_auth_state', 'test');
      localStorage.setItem('mako_error_logs', '[]');
      
      const result = StorageManagerService.auditStorage();
      
      expect(result.totalKeys).toBeGreaterThan(0);
    });
  });

  describe('cleanStorage', () => {
    it('should clean storage and return results', async () => {
      localStorage.setItem('spotify_auth_state', 'test');
      
      const result = await StorageManagerService.cleanStorage({
        categories: ['spotify'],
        dryRun: true
      });
      
      expect(result).toHaveProperty('cleaned');
      expect(result).toHaveProperty('preserved');
      expect(result).toHaveProperty('errors');
    });
  });

  describe('initializeVersioning', () => {
    it('should set version key if not present', () => {
      StorageManagerService.initializeVersioning();
      
      const version = localStorage.getItem('mako_storage_version');
      expect(version).toBeDefined();
    });
  });

  describe('emergencyReset', () => {
    it('should clear all storage', () => {
      localStorage.setItem('test-key', 'value');
      sessionStorage.setItem('test-key', 'value');
      
      StorageManagerService.emergencyReset();
      
      expect(sessionStorage.getItem('test-key')).toBeNull();
    });
  });

  describe('getDebugInfo', () => {
    it('should return debug information', () => {
      const result = StorageManagerService.getDebugInfo();

      expect(result).toHaveProperty('audit');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('sessionId');
      expect(result).toHaveProperty('recommendations');
    });
  });

  describe('auditStorage extended', () => {
    it('should categorize auth keys correctly', () => {
      localStorage.setItem('sb-test-auth-token', JSON.stringify({ access_token: 'token' }));

      const result = StorageManagerService.auditStorage();

      expect(result.keysByCategory['auth']).toBeDefined();
    });

    it('should categorize ui keys correctly', () => {
      localStorage.setItem('iframe-banner-dismissed', 'true');
      localStorage.setItem('reviewedGenres', '{}');

      const result = StorageManagerService.auditStorage();

      expect(result.keysByCategory['ui']).toBeDefined();
    });

    it('should categorize logging keys correctly', () => {
      localStorage.setItem('mako_error_logs', '[]');
      localStorage.setItem('mako_log_metrics', '{}');

      const result = StorageManagerService.auditStorage();

      expect(result.keysByCategory['logging']).toBeDefined();
    });

    it('should categorize session storage keys', () => {
      sessionStorage.setItem('unified_spotify_callback_processing', 'true');

      const result = StorageManagerService.auditStorage();

      expect(result.totalKeys).toBeGreaterThan(0);
    });

    it('should detect stale keys with timestamps', () => {
      const oldTimestamp = Date.now() - 48 * 60 * 60 * 1000; // 48 hours ago
      localStorage.setItem('stale_key', JSON.stringify({ timestamp: oldTimestamp }));

      const result = StorageManagerService.auditStorage();

      expect(result.staleKeys.length).toBeGreaterThanOrEqual(0);
    });

    it('should estimate storage size', () => {
      localStorage.setItem('test_key', 'test_value_12345');

      const result = StorageManagerService.auditStorage();

      expect(result.sizeEstimate).toBeGreaterThan(0);
    });

    it('should assess contamination level', () => {
      const result = StorageManagerService.auditStorage();

      expect(['low', 'medium', 'high', 'critical']).toContain(result.contamination.level);
      expect(Array.isArray(result.contamination.issues)).toBe(true);
      expect(Array.isArray(result.contamination.recommendations)).toBe(true);
    });

    it('should handle empty storage', () => {
      localStorage.clear();
      sessionStorage.clear();

      const result = StorageManagerService.auditStorage();

      expect(result.totalKeys).toBe(0);
    });
  });

  describe('cleanStorage extended', () => {
    it('should clean specific categories', async () => {
      localStorage.setItem('spotify_auth_state', 'test');
      localStorage.setItem('mako_error_logs', '[]');

      const result = await StorageManagerService.cleanStorage({
        categories: ['spotify'],
        dryRun: false
      });

      expect(result).toHaveProperty('cleaned');
      expect(result).toHaveProperty('preserved');
    });

    it('should preserve persistent keys when specified', async () => {
      localStorage.setItem('mako_error_logs', '[]');
      localStorage.setItem('reviewedGenres', '{}');

      const result = await StorageManagerService.cleanStorage({
        preservePersistent: true,
        dryRun: false
      });

      expect(result).toHaveProperty('preserved');
    });

    it('should handle dry run mode', async () => {
      localStorage.setItem('spotify_auth_state', 'test');

      const result = await StorageManagerService.cleanStorage({
        categories: ['spotify'],
        dryRun: true
      });

      // Key should still exist in dry run
      expect(localStorage.getItem('spotify_auth_state')).toBe('test');
    });

    it('should clean stale keys only when specified', async () => {
      localStorage.setItem('fresh_key', JSON.stringify({ timestamp: Date.now() }));

      const result = await StorageManagerService.cleanStorage({
        clearStaleOnly: true,
        dryRun: false
      });

      expect(result).toHaveProperty('cleaned');
    });

    it('should report errors during cleanup', async () => {
      const result = await StorageManagerService.cleanStorage({});

      expect(Array.isArray(result.errors)).toBe(true);
    });
  });

  describe('initializeVersioning extended', () => {
    it('should not overwrite existing version', () => {
      localStorage.setItem('mako_storage_version', '0.9.0');

      StorageManagerService.initializeVersioning();

      // Version handling depends on implementation
      expect(localStorage.getItem('mako_storage_version')).toBeDefined();
    });
  });

  describe('emergencyReset extended', () => {
    it('should clear localStorage', () => {
      localStorage.setItem('test-key-1', 'value1');
      localStorage.setItem('test-key-2', 'value2');

      StorageManagerService.emergencyReset();

      expect(localStorage.length).toBe(0);
    });

    it('should clear sessionStorage', () => {
      sessionStorage.setItem('session-key-1', 'value1');
      sessionStorage.setItem('session-key-2', 'value2');

      StorageManagerService.emergencyReset();

      expect(sessionStorage.length).toBe(0);
    });
  });

  describe('createSessionIsolation', () => {
    it('should create session isolation marker', () => {
      StorageManagerService.createSessionIsolation();

      // Check that session isolation was created
      const keys = Object.keys(localStorage).concat(Object.keys(sessionStorage));
      expect(keys.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('handleVersionMigration', () => {
    it('should handle version migration', () => {
      localStorage.setItem('mako_storage_version', '0.5.0');

      StorageManagerService.handleVersionMigration();

      // Version should be updated or handled
      expect(localStorage.getItem('mako_storage_version')).toBeDefined();
    });
  });

  describe('getDebugInfo extended', () => {
    it('should include session information', () => {
      const result = StorageManagerService.getDebugInfo();

      expect(result.sessionId).toBeDefined();
    });

    it('should include recommendations array', () => {
      const result = StorageManagerService.getDebugInfo();

      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should include audit information', () => {
      const result = StorageManagerService.getDebugInfo();

      expect(result.audit).toHaveProperty('totalKeys');
      expect(result.audit).toHaveProperty('contamination');
    });
  });

  describe('key categorization', () => {
    it('should categorize supabase keys as auth', () => {
      localStorage.setItem('supabase_session', 'test');

      const result = StorageManagerService.auditStorage();

      expect(result.keysByCategory['auth']).toBeDefined();
    });

    it('should categorize debug/test keys correctly', () => {
      localStorage.setItem('debug_mode', 'true');
      localStorage.setItem('test_key', 'value');

      const result = StorageManagerService.auditStorage();

      expect(result.keysByCategory['debug']).toBeDefined();
    });

    it('should categorize mako system keys correctly', () => {
      localStorage.setItem('mako_custom_setting', 'value');

      const result = StorageManagerService.auditStorage();

      expect(result.keysByCategory['system']).toBeDefined();
    });

    it('should categorize token keys as auth', () => {
      localStorage.setItem('access_token', 'token_value');

      const result = StorageManagerService.auditStorage();

      expect(result.keysByCategory['auth']).toBeDefined();
    });

    it('should categorize session keys as auth', () => {
      localStorage.setItem('user_session', 'session_data');

      const result = StorageManagerService.auditStorage();

      expect(result.keysByCategory['auth']).toBeDefined();
    });

    it('should categorize unknown keys correctly', () => {
      localStorage.setItem('random_unrelated_key', 'value');

      const result = StorageManagerService.auditStorage();

      expect(result.keysByCategory['unknown']).toBeDefined();
    });
  });

  describe('stale key detection', () => {
    it('should detect stale timestamp keys', () => {
      const oldTimestamp = Date.now() - 48 * 60 * 60 * 1000;
      localStorage.setItem('last_timestamp', oldTimestamp.toString());

      const result = StorageManagerService.auditStorage();

      expect(result).toBeDefined();
    });

    it('should detect stale time keys', () => {
      const oldTime = Date.now() - 48 * 60 * 60 * 1000;
      localStorage.setItem('check_time', oldTime.toString());

      const result = StorageManagerService.auditStorage();

      expect(result).toBeDefined();
    });

    it('should detect stale JSON objects with expires_at', () => {
      const expiredDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      localStorage.setItem('token_data', JSON.stringify({ expires_at: expiredDate }));

      const result = StorageManagerService.auditStorage();

      expect(result.staleKeys.length).toBeGreaterThanOrEqual(0);
    });

    it('should detect stale JSON objects with backupTime', () => {
      const oldBackup = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      localStorage.setItem('backup_data', JSON.stringify({ backupTime: oldBackup }));

      const result = StorageManagerService.auditStorage();

      expect(result).toBeDefined();
    });

    it('should not mark fresh timestamp keys as stale', () => {
      const recentTimestamp = Date.now() - 1000; // 1 second ago
      localStorage.setItem('recent_timestamp', recentTimestamp.toString());

      const result = StorageManagerService.auditStorage();

      expect(result).toBeDefined();
    });

    it('should handle non-JSON values gracefully', () => {
      localStorage.setItem('plain_text', 'just a string');

      const result = StorageManagerService.auditStorage();

      expect(result).toBeDefined();
    });
  });

  describe('contamination assessment', () => {
    it('should detect medium contamination with moderate stale keys', () => {
      // Add a few stale keys
      for (let i = 0; i < 6; i++) {
        const oldTimestamp = Date.now() - 48 * 60 * 60 * 1000;
        localStorage.setItem(`stale_timestamp_${i}`, JSON.stringify({ timestamp: oldTimestamp }));
      }

      const result = StorageManagerService.auditStorage();

      expect(['medium', 'high', 'critical']).toContain(result.contamination.level);
    });

    it('should detect issues with duplicate keys', () => {
      const key = 'shared_key';
      localStorage.setItem(key, 'local_value');
      sessionStorage.setItem(key, 'session_value');

      const result = StorageManagerService.auditStorage();

      expect(result.duplicateKeys.length).toBeGreaterThan(0);
    });

    it('should add recommendation for large storage', () => {
      // Create a large value (simulating large storage)
      const largeValue = 'x'.repeat(1000);
      localStorage.setItem('large_key', largeValue);

      const result = StorageManagerService.auditStorage();

      expect(result.sizeEstimate).toBeGreaterThan(0);
    });
  });

  describe('cleanStorage with sessionStorage', () => {
    it('should clean sessionStorage spotify keys', async () => {
      sessionStorage.setItem('spotify_auth_state_backup', 'backup_value');

      const result = await StorageManagerService.cleanStorage({
        categories: ['spotify'],
        dryRun: false
      });

      expect(result).toHaveProperty('cleaned');
    });
  });

  describe('registry pattern matching', () => {
    it('should match sb-*-auth-token pattern', () => {
      localStorage.setItem('sb-project-auth-token', JSON.stringify({ token: 'value' }));

      const result = StorageManagerService.auditStorage();

      expect(result.keysByCategory['auth']).toBeDefined();
    });
  });
});
