
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
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('No authenticated user found');
        setIsConnected(false);
        setIsLoading(false);
        return;
      }

      console.log('Checking connection for user:', user.id);

      // Check if connection exists in database
      const { data, error } = await supabase
        .from('spotify_connections')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        console.log('No Spotify connection found in database');
        // Connection should be created by the oauth handler, let's wait a moment and check again
        if (user.app_metadata?.provider === 'spotify') {
          console.log('User authenticated via Spotify OAuth, retrying connection check...');
          setTimeout(checkConnection, 2000);
          return;
        }
        setIsConnected(false);
      } else if (error) {
        console.error('Error checking Spotify connection:', error);
        setIsConnected(false);
      } else if (data) {
        console.log('Spotify connection found:', data.id);
        setConnection(data as SpotifyConnection);
        setIsConnected(true);
      } else {
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
    setIsSyncing(true);
    try {
      console.log('=== STARTING SYNC PROCESS ===');
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No session found');
        toast({
          title: "Authentication Required",
          description: "Please log in to sync liked songs",
          variant: "destructive",
        });
        return;
      }

      console.log('Session found, user ID:', session.user?.id);
      console.log('Session access token present:', !!session.access_token);

      // Check if we have a connection in the database
      if (!connection) {
        console.log('No connection found, checking database...');
        const { data: connData, error: connError } = await supabase
          .from('spotify_connections')
          .select('*')
          .eq('user_id', session.user.id)
          .single();

        if (connError || !connData) {
          console.error('No Spotify connection found in database:', connError);
          toast({
            title: "Connection Error",
            description: "Spotify connection not found. Please sign out and sign back in.",
            variant: "destructive",
          });
          return;
        }
        
        console.log('Connection found in database:', connData.id);
        setConnection(connData as SpotifyConnection);
      }

      console.log('Calling spotify-sync-liked function...');

      const response = await supabase.functions.invoke('spotify-sync-liked', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log('Sync response received:', response);

      if (response.error) {
        console.error('Sync error response:', response.error);
        throw new Error(response.error.message || 'Sync failed');
      }

      if (response.data?.error) {
        console.error('Sync data error:', response.data.error);
        throw new Error(response.data.error);
      }

      console.log('Sync completed successfully:', response.data);

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
