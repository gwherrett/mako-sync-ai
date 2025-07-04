
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

      const { data, error } = await supabase
        .from('spotify_connections')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
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

  const refreshTokens = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Authentication Required",
          description: "Please log in to refresh tokens",
          variant: "destructive",
        });
        return;
      }

      // Call the sync function to trigger token refresh
      const response = await supabase.functions.invoke('spotify-sync-liked', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Refresh the connection state
      await checkConnection();

      toast({
        title: "Tokens Refreshed",
        description: "Spotify tokens have been refreshed successfully",
      });
    } catch (error: any) {
      console.error('Token refresh error:', error);
      toast({
        title: "Refresh Failed",
        description: `Failed to refresh tokens: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const disconnectSpotify = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Sign out completely since Spotify is the auth provider
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

      const response = await supabase.functions.invoke('spotify-sync-liked', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: "Sync Complete",
        description: `${response.data.message}`,
      });
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
    refreshTokens,
  };
};
