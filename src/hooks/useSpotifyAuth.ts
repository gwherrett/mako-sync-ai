
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
  const { user, session } = useAuth();

  const checkConnection = async () => {
    console.log('=== CHECKING SPOTIFY CONNECTION ===');
    
    if (!user) {
      console.log('No user, skipping connection check');
      setIsLoading(false);
      setIsConnected(false);
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('Checking connection for user:', user.id);

      const { data, error } = await supabase
        .from('spotify_connections')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        console.log('No Spotify connection found in database');
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

  const connectSpotify = async () => {
    console.log('=== CONNECTING TO SPOTIFY ===');
    
    if (!session || !user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to connect Spotify",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get the auth URL from the edge function (no auth header needed)
      const { data, error } = await supabase.functions.invoke('spotify-auth', {
        body: {
          user_id: user.id,
          action: 'get_auth_url'
        }
      });
      
      if (error) {
        console.error('Spotify auth error:', error);
        toast({
          title: "Connection Failed",
          description: "Failed to connect to Spotify. Please try again.",
          variant: "destructive",
        });
        return;
      }

      if (data?.authUrl) {
        // Store user ID in localStorage for the callback
        localStorage.setItem('spotify_auth_user_id', user.id);
        localStorage.setItem('spotify_auth_token', session.access_token);
        
        // Open popup window for Spotify auth
        const popup = window.open(
          data.authUrl,
          'spotify-auth',
          'width=600,height=700,scrollbars=yes,resizable=yes'
        );

        // Listen for messages from the popup
        const messageListener = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          
          if (event.data.success) {
            console.log('Spotify connection successful');
            toast({
              title: "Connection Successful",
              description: "Spotify account connected successfully",
            });
            checkConnection();
            popup?.close();
            // Clean up
            localStorage.removeItem('spotify_auth_user_id');
            localStorage.removeItem('spotify_auth_token');
          } else if (event.data.error) {
            console.error('Spotify connection error:', event.data.error);
            toast({
              title: "Connection Failed",
              description: event.data.error,
              variant: "destructive",
            });
            popup?.close();
            // Clean up
            localStorage.removeItem('spotify_auth_user_id');
            localStorage.removeItem('spotify_auth_token');
          }
        };

        window.addEventListener('message', messageListener);

        // Clean up listener when popup closes
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            window.removeEventListener('message', messageListener);
            clearInterval(checkClosed);
          }
        }, 1000);
      }
    } catch (error: any) {
      console.error('Error connecting to Spotify:', error);
      toast({
        title: "Connection Error",
        description: `Failed to connect: ${error.message}`,
        variant: "destructive",
      });
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

      console.log('Session found, calling spotify-sync-liked function...');

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
    if (user) {
      checkConnection();
    }
  }, [user]);

  return {
    isConnected,
    isLoading,
    isSyncing,
    connection,
    syncLikedSongs,
    connectSpotify,
    checkConnection,
  };
};
