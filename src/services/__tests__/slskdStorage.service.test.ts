import { describe, it, expect, beforeEach } from 'vitest';
import { SlskdStorageService } from '../slskdStorage.service';

describe('SlskdStorageService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getConfig', () => {
    it('returns default config when nothing stored', () => {
      const config = SlskdStorageService.getConfig();
      expect(config.apiEndpoint).toBe('');
      expect(config.apiKey).toBe('');
      expect(config.downloadsFolder).toBe('');
      expect(config.searchFormat).toBe('primary');
      expect(config.connectionStatus).toBe(false);
    });

    it('returns stored config merged with defaults', () => {
      localStorage.setItem(
        'mako-sync:slskd-config',
        JSON.stringify({ apiEndpoint: 'http://test:5030' })
      );
      const config = SlskdStorageService.getConfig();
      expect(config.apiEndpoint).toBe('http://test:5030');
      expect(config.searchFormat).toBe('primary'); // default
    });

    it('handles invalid JSON gracefully', () => {
      localStorage.setItem('mako-sync:slskd-config', 'invalid json');
      const config = SlskdStorageService.getConfig();
      expect(config.apiEndpoint).toBe('');
    });
  });

  describe('saveConfig', () => {
    it('saves and retrieves config', () => {
      SlskdStorageService.saveConfig({ apiEndpoint: 'http://test:5030' });
      const config = SlskdStorageService.getConfig();
      expect(config.apiEndpoint).toBe('http://test:5030');
    });

    it('merges with existing config', () => {
      SlskdStorageService.saveConfig({ apiEndpoint: 'http://test:5030' });
      SlskdStorageService.saveConfig({ apiKey: 'test-key' });
      const config = SlskdStorageService.getConfig();
      expect(config.apiEndpoint).toBe('http://test:5030');
      expect(config.apiKey).toBe('test-key');
    });

    it('returns updated config', () => {
      const result = SlskdStorageService.saveConfig({
        apiEndpoint: 'http://test:5030',
        apiKey: 'test-key',
      });
      expect(result.apiEndpoint).toBe('http://test:5030');
      expect(result.apiKey).toBe('test-key');
    });
  });

  describe('clearConfig', () => {
    it('clears stored config', () => {
      SlskdStorageService.saveConfig({ apiEndpoint: 'http://test:5030' });
      SlskdStorageService.clearConfig();
      expect(SlskdStorageService.isConfigured()).toBe(false);
    });
  });

  describe('isConfigured', () => {
    it('returns false when not configured', () => {
      expect(SlskdStorageService.isConfigured()).toBe(false);
    });

    it('returns false when only endpoint is set', () => {
      SlskdStorageService.saveConfig({ apiEndpoint: 'http://test:5030' });
      expect(SlskdStorageService.isConfigured()).toBe(false);
    });

    it('returns false when only apiKey is set', () => {
      SlskdStorageService.saveConfig({ apiKey: 'test-key' });
      expect(SlskdStorageService.isConfigured()).toBe(false);
    });

    it('returns true when both endpoint and apiKey are set', () => {
      SlskdStorageService.saveConfig({
        apiEndpoint: 'http://test:5030',
        apiKey: 'test-key',
      });
      expect(SlskdStorageService.isConfigured()).toBe(true);
    });
  });

  describe('getStorageKey', () => {
    it('returns the storage key', () => {
      expect(SlskdStorageService.getStorageKey()).toBe('mako-sync:slskd-config');
    });
  });
});
