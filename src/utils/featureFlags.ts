/**
 * Feature Flags Utility
 *
 * Allows toggling experimental auth service features for testing.
 * Flags can be set via localStorage for runtime testing.
 *
 * Usage:
 *   localStorage.setItem('mako-feature-flags', JSON.stringify({ useStartupValidator: false }))
 *   window.location.reload()
 */

interface FeatureFlags {
  /**
   * Enable startup session validator service.
   * When disabled, skips aggressive token validation on app load.
   * Default: true
   */
  useStartupValidator: boolean;

  /**
   * Enable token persistence gateway service.
   * When disabled, skips waiting for token localStorage persistence.
   * Default: true
   */
  useTokenPersistenceGateway: boolean;
}

const STORAGE_KEY = 'mako-feature-flags';

const DEFAULT_FLAGS: FeatureFlags = {
  useStartupValidator: true,
  useTokenPersistenceGateway: true
};

class FeatureFlagsService {
  private flags: FeatureFlags;

  constructor() {
    this.flags = this.loadFlags();
  }

  private loadFlags(): FeatureFlags {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_FLAGS, ...parsed };
      }
    } catch {
      // Ignore parse errors
    }
    return { ...DEFAULT_FLAGS };
  }

  /**
   * Get current feature flags
   */
  getFlags(): Readonly<FeatureFlags> {
    return this.flags;
  }

  /**
   * Check if startup validator is enabled
   */
  isStartupValidatorEnabled(): boolean {
    return this.flags.useStartupValidator;
  }

  /**
   * Check if token persistence gateway is enabled
   */
  isTokenPersistenceGatewayEnabled(): boolean {
    return this.flags.useTokenPersistenceGateway;
  }

  /**
   * Update feature flags (persists to localStorage)
   */
  setFlags(updates: Partial<FeatureFlags>): void {
    this.flags = { ...this.flags, ...updates };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.flags));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Reset all flags to defaults
   */
  resetFlags(): void {
    this.flags = { ...DEFAULT_FLAGS };
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
}

export const featureFlags = new FeatureFlagsService();
export type { FeatureFlags };
