/**
 * slskd Storage Service
 *
 * Handles localStorage operations for slskd configuration.
 * Configuration is stored locally in the browser, not in Supabase.
 */

import type { SlskdConfig } from '@/types/slskd';

const STORAGE_KEY = 'mako-sync:slskd-config';

const DEFAULT_CONFIG: SlskdConfig = {
  apiEndpoint: '',
  apiKey: '',
  downloadsFolder: '',
  searchFormat: 'primary',
  connectionStatus: false,
};

export class SlskdStorageService {
  /**
   * Get slskd configuration from localStorage
   */
  static getConfig(): SlskdConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return DEFAULT_CONFIG;
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  /**
   * Save slskd configuration to localStorage
   */
  static saveConfig(config: Partial<SlskdConfig>): SlskdConfig {
    const current = this.getConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  }

  /**
   * Clear slskd configuration
   */
  static clearConfig(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Check if slskd is configured (has endpoint and API key)
   */
  static isConfigured(): boolean {
    const config = this.getConfig();
    return Boolean(config.apiEndpoint && config.apiKey);
  }

  /**
   * Get the localStorage key (for storage event listeners)
   */
  static getStorageKey(): string {
    return STORAGE_KEY;
  }
}
