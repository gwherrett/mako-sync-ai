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
});
