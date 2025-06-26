
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
    const scopes = [
      'user-read-private',
      'user-read-email',
      'user-library-read',
      'playlist-read-private',
      'playlist-read-collaborative'
    ].join(' ');

    const authUrl = new URL('https://accounts.spotify.com/authorize');
    authUrl.searchParams.append('client_id', '3bac088a26d64ddfb49d57fb5d451d71');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('redirect_uri', 'https://bzzstdpfmyqttnzhgaoa.supabase.co/functions/v1/spotify-callback');
    authUrl.searchParams.append('scope', scopes);
    authUrl.searchParams.append('state', state);

    const popup = window.open(authUrl.toString(), 'spotify-auth', 'width=600,height=700');

    const handleMessage = async (event: MessageEvent) => {
      if (event.data.type === 'spotify-auth') {
        const { code, state: returnedState } = event.data;
        
        if (returnedState !== state) {
          toast({
            title: "Authentication Error",
            description: "Invalid state parameter",
            variant: "destructive",
          });
          return;
        }

        try {
          const { data: { session } } = await supabase.auth.getSession();
          
          const response = await supabase.functions.invoke('spotify-auth', {
            body: { code, state },
            headers: {
              Authorization: `Bearer ${session?.access_token}`,
            },
          });

          if (response.error) {
            throw new Error(response.error.message);
          }

          toast({
            title: "Spotify Connected",
            description: "Successfully connected to Spotify!",
          });

          await checkConnection();
        } catch (error) {
          console.error('Spotify auth error:', error);
          toast({
            title: "Connection Failed",
            description: "Failed to connect to Spotify. Please try again.",
            variant: "destructive",
          });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    
    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        window.removeEventListener('message', handleMessage);
        clearInterval(checkClosed);
      }
    }, 1000);
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
      
      toast({
        title: "Spotify Disconnected",
        description: "Successfully disconnected from Spotify",
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

  useEffect(() => {
    checkConnection();
  }, []);

  return {
    isConnected,
    isLoading,
    connection,
    connectSpotify,
    disconnectSpotify,
    checkConnection,
  };
};
