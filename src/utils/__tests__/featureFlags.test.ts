import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test the actual module, not the singleton
// So we'll re-import after clearing the module cache

const STORAGE_KEY = 'mako-feature-flags';

describe('featureFlags', () => {
  // Store original localStorage methods
  let originalGetItem: typeof localStorage.getItem;
  let originalSetItem: typeof localStorage.setItem;
  let originalRemoveItem: typeof localStorage.removeItem;
  let mockStore: Record<string, string>;

  beforeEach(() => {
    // Reset the mock store
    mockStore = {};

    // Save original methods
    originalGetItem = localStorage.getItem;
    originalSetItem = localStorage.setItem;
    originalRemoveItem = localStorage.removeItem;

    // Override with our tracking mock
    vi.spyOn(localStorage, 'getItem').mockImplementation((key: string) => mockStore[key] || null);
    vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => { mockStore[key] = value; });
    vi.spyOn(localStorage, 'removeItem').mockImplementation((key: string) => { delete mockStore[key]; });

    // Clear module cache to get fresh instance
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should return default flags when no localStorage data', async () => {
      const { featureFlags } = await import('../featureFlags');

      const flags = featureFlags.getFlags();

      expect(flags.useStartupValidator).toBe(true);
      expect(flags.useTokenPersistenceGateway).toBe(true);
    });

    it('should load flags from localStorage', async () => {
      mockStore[STORAGE_KEY] = JSON.stringify({ useStartupValidator: false });

      const { featureFlags } = await import('../featureFlags');

      const flags = featureFlags.getFlags();
      expect(flags.useStartupValidator).toBe(false);
      expect(flags.useTokenPersistenceGateway).toBe(true); // Default preserved
    });

    it('should merge partial flags with defaults', async () => {
      mockStore[STORAGE_KEY] = JSON.stringify({ useTokenPersistenceGateway: false });

      const { featureFlags } = await import('../featureFlags');

      const flags = featureFlags.getFlags();
      expect(flags.useStartupValidator).toBe(true); // Default
      expect(flags.useTokenPersistenceGateway).toBe(false); // From storage
    });

    it('should handle invalid JSON gracefully', async () => {
      mockStore[STORAGE_KEY] = 'not valid json';

      const { featureFlags } = await import('../featureFlags');

      const flags = featureFlags.getFlags();
      expect(flags.useStartupValidator).toBe(true);
      expect(flags.useTokenPersistenceGateway).toBe(true);
    });

    it('should handle empty string in localStorage', async () => {
      mockStore[STORAGE_KEY] = '';

      const { featureFlags } = await import('../featureFlags');

      const flags = featureFlags.getFlags();
      expect(flags.useStartupValidator).toBe(true);
      expect(flags.useTokenPersistenceGateway).toBe(true);
    });
  });

  describe('isStartupValidatorEnabled', () => {
    it('should return true by default', async () => {
      const { featureFlags } = await import('../featureFlags');

      expect(featureFlags.isStartupValidatorEnabled()).toBe(true);
    });

    it('should return false when disabled', async () => {
      mockStore[STORAGE_KEY] = JSON.stringify({ useStartupValidator: false });

      const { featureFlags } = await import('../featureFlags');

      expect(featureFlags.isStartupValidatorEnabled()).toBe(false);
    });
  });

  describe('isTokenPersistenceGatewayEnabled', () => {
    it('should return true by default', async () => {
      const { featureFlags } = await import('../featureFlags');

      expect(featureFlags.isTokenPersistenceGatewayEnabled()).toBe(true);
    });

    it('should return false when disabled', async () => {
      mockStore[STORAGE_KEY] = JSON.stringify({ useTokenPersistenceGateway: false });

      const { featureFlags } = await import('../featureFlags');

      expect(featureFlags.isTokenPersistenceGatewayEnabled()).toBe(false);
    });
  });

  describe('setFlags', () => {
    it('should update flags in memory', async () => {
      const { featureFlags } = await import('../featureFlags');

      featureFlags.setFlags({ useStartupValidator: false });

      expect(featureFlags.isStartupValidatorEnabled()).toBe(false);
    });

    it('should persist flags to localStorage', async () => {
      const { featureFlags } = await import('../featureFlags');

      featureFlags.setFlags({ useStartupValidator: false });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        expect.stringContaining('"useStartupValidator":false')
      );
    });

    it('should merge updates with existing flags', async () => {
      const { featureFlags } = await import('../featureFlags');

      featureFlags.setFlags({ useStartupValidator: false });
      featureFlags.setFlags({ useTokenPersistenceGateway: false });

      const flags = featureFlags.getFlags();
      expect(flags.useStartupValidator).toBe(false);
      expect(flags.useTokenPersistenceGateway).toBe(false);
    });

    it('should handle localStorage errors gracefully', async () => {
      const { featureFlags } = await import('../featureFlags');

      vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new Error('Storage full');
      });

      // Should not throw
      expect(() => featureFlags.setFlags({ useStartupValidator: false })).not.toThrow();

      // In-memory flag should still be updated
      expect(featureFlags.isStartupValidatorEnabled()).toBe(false);
    });
  });

  describe('resetFlags', () => {
    it('should reset all flags to defaults', async () => {
      mockStore[STORAGE_KEY] = JSON.stringify({
        useStartupValidator: false,
        useTokenPersistenceGateway: false
      });

      const { featureFlags } = await import('../featureFlags');

      // Verify loaded state
      expect(featureFlags.isStartupValidatorEnabled()).toBe(false);

      // Reset
      featureFlags.resetFlags();

      // Should be back to defaults
      expect(featureFlags.isStartupValidatorEnabled()).toBe(true);
      expect(featureFlags.isTokenPersistenceGatewayEnabled()).toBe(true);
    });

    it('should remove localStorage key on reset', async () => {
      const { featureFlags } = await import('../featureFlags');

      featureFlags.resetFlags();

      expect(localStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it('should handle localStorage errors gracefully on reset', async () => {
      const { featureFlags } = await import('../featureFlags');

      vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
        throw new Error('Storage error');
      });

      // Should not throw
      expect(() => featureFlags.resetFlags()).not.toThrow();

      // Flags should still be reset in memory
      expect(featureFlags.isStartupValidatorEnabled()).toBe(true);
    });
  });

  describe('getFlags', () => {
    it('should return readonly flags object', async () => {
      const { featureFlags } = await import('../featureFlags');

      const flags = featureFlags.getFlags();

      expect(flags).toEqual({
        useStartupValidator: true,
        useTokenPersistenceGateway: true
      });
    });

    it('should reflect current flag values after updates', async () => {
      const { featureFlags } = await import('../featureFlags');

      featureFlags.setFlags({ useStartupValidator: false });

      const flags = featureFlags.getFlags();
      expect(flags.useStartupValidator).toBe(false);
    });
  });
});
