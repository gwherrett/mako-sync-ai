
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

  const checkConnection = async () => {
    console.log('=== CHECKING SPOTIFY CONNECTION ===');
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('Error getting user:', userError);
        setIsConnected(false);
        setIsLoading(false);
        return;
      }

      if (!user) {
        console.log('No authenticated user found');
        setIsConnected(false);
        setIsLoading(false);
        return;
      }

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
        // If user authenticated via Spotify OAuth but no connection, wait and retry
        if (user.app_metadata?.provider === 'spotify') {
          console.log('User authenticated via Spotify OAuth, waiting for connection...');
          setTimeout(checkConnection, 3000); // Wait 3 seconds and retry
          return;
        }
        setIsConnected(false);
      } else if (error) {
        console.error('Error checking Spotify connection:', error);
        setIsConnected(false);
      } else if (data) {
        console.log('Spotify connection found:', {
          id: data.id,
          expires_at: data.expires_at,
          hasAccessToken: !!data.access_token,
          hasRefreshToken: !!data.refresh_token
        });
        setConnection(data as SpotifyConnection);
        setIsConnected(true);
      } else {
        console.log('No connection data returned');
        setIsConnected(false);
      }
    } catch (error) {
      console.error('Error checking connection:', error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectSpotify = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Since Spotify is now the auth provider, we need to sign out completely
      await supabase.auth.signOut();
      
      toast({
        title: "Signed Out",
        description: "You have been signed out of the application",
      });
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: "Sign Out Failed",
        description: "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  const syncLikedSongs = async () => {
    console.log('=== STARTING SYNC PROCESS ===');
    setIsSyncing(true);
    
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error(`Session error: ${sessionError.message}`);
      }
      
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

  useEffect(() => {
    checkConnection();
  }, []);

  return {
    isConnected,
    isLoading,
    isSyncing,
    connection,
    disconnectSpotify,
    syncLikedSongs,
    checkConnection,
  };
};
