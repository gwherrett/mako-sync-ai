
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

      // Use .maybeSingle() instead of .single() to avoid 406 error when no connection exists
      const { data, error } = await supabase
        .from('spotify_connections')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
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

  const connectSpotify = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to connect Spotify",
        variant: "destructive",
      });
      return;
    }

    const state = Math.random().toString(36).substring(7);
    
    // Store state in localStorage for validation after redirect
    localStorage.setItem('spotify_auth_state', state);
    
    const scopes = [
      'user-read-private',
      'user-read-email', 
      'user-library-read',
      'playlist-read-private',
      'playlist-read-collaborative',
      'user-top-read'  // Required for audio features
    ].join(' ');

    // Use current origin for redirect URI
    const redirectUri = `${window.location.origin}/spotify-callback`;
    
    const authUrl = new URL('https://accounts.spotify.com/authorize');
    authUrl.searchParams.append('client_id', '3bac088a26d64ddfb49d57fb5d451d71');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('scope', scopes);
    authUrl.searchParams.append('state', state);

    console.log('=== SPOTIFY AUTH DEBUG ===');
    console.log('Window location origin:', window.location.origin);
    console.log('Window location href:', window.location.href);
    console.log('Redirect URI being used:', redirectUri);
    console.log('Scopes being requested:', scopes);
    console.log('Client ID:', '3bac088a26d64ddfb49d57fb5d451d71');
    console.log('Auth URL params:');
    console.log('  - client_id:', authUrl.searchParams.get('client_id'));
    console.log('  - redirect_uri:', authUrl.searchParams.get('redirect_uri'));
    console.log('  - scope:', authUrl.searchParams.get('scope'));
    console.log('  - response_type:', authUrl.searchParams.get('response_type'));
    console.log('Full auth URL:', authUrl.toString());
    console.log('========================');
    
    // Use window.location.href for full page redirect (not popup) to avoid X-Frame-Options issue
    window.location.href = authUrl.toString();
  };

  const disconnectSpotify = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { error } = await supabase
        .from('spotify_connections')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      setIsConnected(false);
      setConnection(null);
      
      // Clear any stored state
      localStorage.removeItem('spotify_auth_state');
      
      toast({
        title: "Spotify Disconnected",
        description: "Successfully disconnected from Spotify. Please reconnect to get fresh tokens.",
      });
    } catch (error) {
      console.error('Error disconnecting Spotify:', error);
      toast({
        title: "Disconnect Failed",
        description: "Failed to disconnect from Spotify",
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
    connectSpotify,
    disconnectSpotify,
    syncLikedSongs,
    checkConnection,
    refreshTokens,
  };
};
