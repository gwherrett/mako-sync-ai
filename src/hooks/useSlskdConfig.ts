/**
 * useSlskdConfig Hook
 *
 * Manages slskd configuration state - loading, saving, and testing connection.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SlskdClientService } from '@/services/slskdClient.service';
import type { SlskdConfig } from '@/types/slskd';
import { useToast } from '@/hooks/use-toast';

export function useSlskdConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current config from database
  const {
    data: config,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['slskd-config'],
    queryFn: async (): Promise<SlskdConfig | null> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_preferences')
        .select(
          'slskd_api_endpoint, slskd_api_key, slskd_connection_status, slskd_last_connection_test'
        )
        .eq('user_id', user.id)
        .single();

      // No row yet is fine - return empty config
      if (error?.code === 'PGRST116') {
        return {
          apiEndpoint: '',
          apiKey: '',
          connectionStatus: false,
          lastConnectionTest: undefined,
        };
      }

      if (error) {
        console.error('Error fetching slskd config:', error);
        throw error;
      }

      return {
        apiEndpoint: data?.slskd_api_endpoint || '',
        apiKey: data?.slskd_api_key || '',
        connectionStatus: data?.slskd_connection_status || false,
        lastConnectionTest: data?.slskd_last_connection_test || undefined,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Save config mutation
  const saveMutation = useMutation({
    mutationFn: async (
      newConfig: Pick<SlskdConfig, 'apiEndpoint' | 'apiKey'>
    ): Promise<boolean> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Test connection first
      const testConfig: SlskdConfig = {
        ...newConfig,
        connectionStatus: false,
      };
      const isValid = await SlskdClientService.testConnection(testConfig);

      // Save to database (upsert)
      const { error } = await supabase.from('user_preferences').upsert(
        {
          user_id: user.id,
          slskd_api_endpoint: newConfig.apiEndpoint,
          slskd_api_key: newConfig.apiKey,
          slskd_connection_status: isValid,
          slskd_last_connection_test: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      );

      if (error) throw error;

      return isValid;
    },
    onSuccess: (isValid) => {
      toast({
        title: isValid ? 'Connection Successful' : 'Connection Failed',
        description: isValid
          ? 'slskd configuration saved and connected'
          : 'Could not connect to slskd. Check your endpoint and API key.',
        variant: isValid ? 'default' : 'destructive',
      });
      queryClient.invalidateQueries({ queryKey: ['slskd-config'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Save Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Test connection mutation (without saving)
  const testMutation = useMutation({
    mutationFn: async (
      testConfig: Pick<SlskdConfig, 'apiEndpoint' | 'apiKey'>
    ): Promise<boolean> => {
      return SlskdClientService.testConnection({
        ...testConfig,
        connectionStatus: false,
      });
    },
    onSuccess: (isValid) => {
      toast({
        title: isValid ? 'Connection Successful' : 'Connection Failed',
        description: isValid
          ? 'Successfully connected to slskd'
          : 'Could not connect. Check your endpoint and API key.',
        variant: isValid ? 'default' : 'destructive',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Connection Test Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    config,
    isLoading,
    error,
    saveConfig: saveMutation.mutate,
    isSaving: saveMutation.isPending,
    testConnection: testMutation.mutate,
    isTesting: testMutation.isPending,
  };
}
