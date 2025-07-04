
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface SpotifyConnection {
  id: string;
  user_id: string;
  spotify_user_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
  scope: string | null;
  token_type: string | null;
  display_name: string | null;
  email: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export const useSpotifyAuth = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [connection, setConnection] = useState<SpotifyConnection | null>(null);
  const { toast } = useToast();
  const { user, session, loading: authLoading } = useAuth();

  const checkConnection = async () => {
    console.log('=== CHECKING SPOTIFY CONNECTION ===');
    
    // Don't check connection if auth is still loading or no user
    if (authLoading || !user) {
      console.log('Auth still loading or no user, skipping connection check');
      setIsLoading(false);
      setIsConnected(false);
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('Checking connection for user:', user.id);
      console.log('User provider:', user.app_metadata?.provider);

      // Check if connection exists in database
      const { data, error } = await supabase
        .from('spotify_connections')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        console.log('No Spotify connection found in database');
        
        if (user.app_metadata?.provider === 'spotify') {
          console.log('User authenticated via Spotify OAuth but no connection found');
          // Wait a bit longer for the OAuth handler to process
          setTimeout(() => {
            console.log('Retrying connection check after OAuth handler delay...');
            checkConnection();
          }, 2000);
          return;
        }
        
        setIsConnected(false);
        setConnection(null);
      } else if (error) {
        console.error('Error checking Spotify connection:', error);
        setIsConnected(false);
        setConnection(null);
      } else if (data) {
        console.log('Spotify connection found:', {
          id: data.id,
          expires_at: data.expires_at,
          hasAccessToken: !!data.access_token,
          hasRefreshToken: !!data.refresh_token,
          created_at: data.created_at,
          updated_at: data.updated_at
        });
        setConnection(data as SpotifyConnection);
        setIsConnected(true);
      } else {
        console.log('No connection data returned');
        setIsConnected(false);
        setConnection(null);
      }
    } catch (error) {
      console.error('Error checking connection:', error);
      setIsConnected(false);
      setConnection(null);
    } finally {
      setIsLoading(false);
    }
  };

  const syncLikedSongs = async () => {
    console.log('=== STARTING SYNC PROCESS ===');
    setIsSyncing(true);
    
    try {
      if (!session) {
        console.error('No session found');
        toast({
          title: "Authentication Required",
          description: "Please log in to sync liked songs",
          variant: "destructive",
        });
        return;
      }

      console.log('Session found:', {
        userId: session.user?.id,
        hasAccessToken: !!session.access_token,
        provider: session.user?.app_metadata?.provider
      });

      // Double-check we have a connection
      if (!connection) {
        console.log('No connection in state, checking database...');
        await checkConnection();
        // Give it a moment to update state
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (!connection) {
          console.error('Still no connection found');
          toast({
            title: "Connection Error",
            description: "Spotify connection not found. Please sign out and sign back in.",
            variant: "destructive",
          });
          return;
        }
      }

      console.log('Calling spotify-sync-liked function...');

      const response = await supabase.functions.invoke('spotify-sync-liked', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log('Sync response:', response);

      if (response.error) {
        console.error('Sync error response:', response.error);
        throw new Error(response.error.message || 'Sync failed');
      }

      if (response.data?.error) {
        console.error('Sync data error:', response.data.error);
        throw new Error(response.data.error);
      }

      console.log('Sync completed successfully');

      toast({
        title: "Sync Complete",
        description: response.data?.message || "Successfully synced your liked songs",
      });

      // Refresh connection status after successful sync
      await checkConnection();
    } catch (error: any) {
      console.error('=== SYNC ERROR ===', error);
      toast({
        title: "Sync Failed",
        description: `Failed to sync liked songs: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Check connection when auth state changes
  useEffect(() => {
    if (!authLoading) {
      checkConnection();
    }
  }, [user, authLoading]);

  return {
    isConnected,
    isLoading,
    isSyncing,
    connection,
    syncLikedSongs,
    checkConnection,
  };
};
