/**
 * useSlskdConfig Hook
 *
 * Manages slskd configuration stored in browser localStorage.
 * Provides config state, save/test functionality, and cross-tab sync.
 */

import { useState, useEffect, useCallback } from 'react';
import { SlskdStorageService } from '@/services/slskdStorage.service';
import { SlskdClientService } from '@/services/slskdClient.service';
import type { SlskdConfig } from '@/types/slskd';
import { useToast } from '@/hooks/use-toast';

export function useSlskdConfig() {
  const { toast } = useToast();
  const [config, setConfig] = useState<SlskdConfig>(SlskdStorageService.getConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Reload config if localStorage changes (e.g., from another tab)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === SlskdStorageService.getStorageKey()) {
        setConfig(SlskdStorageService.getConfig());
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  /**
   * Save configuration and test connection
   */
  const saveConfig = useCallback(async (
    newConfig: Omit<SlskdConfig, 'connectionStatus' | 'lastConnectionTest'>
  ) => {
    setIsSaving(true);

    try {
      // Test connection before saving
      const testConfig: SlskdConfig = {
        ...newConfig,
        connectionStatus: false,
        lastConnectionTest: undefined,
      };
      const isValid = await SlskdClientService.testConnection(testConfig);

      const updated = SlskdStorageService.saveConfig({
        ...newConfig,
        connectionStatus: isValid,
        lastConnectionTest: new Date().toISOString(),
      });

      setConfig(updated);

      toast({
        title: isValid ? 'Connection Successful' : 'Connection Failed',
        description: isValid
          ? 'slskd configuration saved'
          : 'Could not connect to slskd. Check your endpoint and API key.',
        variant: isValid ? 'default' : 'destructive',
      });

      return isValid;
    } catch (error) {
      console.error('Failed to save slskd config:', error);
      toast({
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [toast]);

  /**
   * Test connection without saving
   */
  const testConnection = useCallback(async (
    testConfig: Pick<SlskdConfig, 'apiEndpoint' | 'apiKey'>
  ) => {
    setIsTesting(true);

    try {
      const fullConfig: SlskdConfig = {
        ...SlskdStorageService.getConfig(),
        ...testConfig,
      };
      const isValid = await SlskdClientService.testConnection(fullConfig);

      toast({
        title: isValid ? 'Connection Successful' : 'Connection Failed',
        description: isValid
          ? 'Successfully connected to slskd'
          : 'Could not connect to slskd. Check your endpoint and API key.',
        variant: isValid ? 'default' : 'destructive',
      });

      return isValid;
    } catch (error) {
      console.error('slskd connection test failed:', error);
      toast({
        title: 'Connection Test Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsTesting(false);
    }
  }, [toast]);

  /**
   * Clear all configuration
   */
  const clearConfig = useCallback(() => {
    SlskdStorageService.clearConfig();
    setConfig(SlskdStorageService.getConfig());
    toast({
      title: 'Configuration Cleared',
      description: 'slskd configuration has been removed',
    });
  }, [toast]);

  return {
    config,
    isConfigured: SlskdStorageService.isConfigured(),
    isLoading: false, // localStorage is synchronous
    error: null,
    saveConfig,
    clearConfig,
    isSaving,
    testConnection,
    isTesting,
  };
}
