
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
        setIsConnected(false);
        setIsLoading(false);
        return;
      }

      // For OAuth users, we should always have a connection
      // Let's check if it exists, and if not, try to create it from the session
      const { data, error } = await supabase
        .from('spotify_connections')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // No connection found, but user is authenticated via Spotify OAuth
        // This means we need to create the connection from the session data
        console.log('No Spotify connection found, checking session for OAuth data...');
        
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.app_metadata?.provider === 'spotify') {
          console.log('User authenticated via Spotify OAuth, connection should be created by edge function');
          // Connection should be created by the oauth handler, let's wait a moment and check again
          setTimeout(checkConnection, 1000);
          return;
        }
        
        setIsConnected(false);
      } else if (error) {
        console.error('Error checking Spotify connection:', error);
        setIsConnected(false);
      } else if (data) {
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
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Authentication Required",
          description: "Please log in to sync liked songs",
          variant: "destructive",
        });
        return;
      }

      console.log('Starting sync with session:', session.user?.id);

      const response = await supabase.functions.invoke('spotify-sync-liked', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log('Sync response:', response);

      if (response.error) {
        console.error('Sync error:', response.error);
        throw new Error(response.error.message || 'Sync failed');
      }

      toast({
        title: "Sync Complete",
        description: response.data?.message || "Successfully synced your liked songs",
      });

      // Refresh connection status after successful sync
      await checkConnection();
    } catch (error: any) {
      console.error('Sync error:', error);
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
