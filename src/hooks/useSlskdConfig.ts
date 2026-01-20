/**
 * useSlskdConfig Hook
 *
 * TEMPORARILY DISABLED: The user_preferences table was removed from the schema.
 * This hook is stubbed out until slskd configuration is re-implemented.
 */

import type { SlskdConfig } from '@/types/slskd';

export function useSlskdConfig() {
  return {
    config: null as SlskdConfig | null,
    isLoading: false,
    error: null as Error | null,
    saveConfig: (_config: Pick<SlskdConfig, 'apiEndpoint' | 'apiKey'>) => {
      console.warn('useSlskdConfig: user_preferences table not available');
    },
    isSaving: false,
    testConnection: (_config: Pick<SlskdConfig, 'apiEndpoint' | 'apiKey'>) => {
      console.warn('useSlskdConfig: user_preferences table not available');
    },
    isTesting: false,
  };
}
