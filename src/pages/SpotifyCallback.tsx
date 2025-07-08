
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const SpotifyCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const processCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');

      if (error) {
        toast({
          title: "Spotify Connection Failed",
          description: `Error: ${error}`,
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      if (!code || !state) {
        toast({
          title: "Authentication Error",
          description: "Missing authorization code or state",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      // Verify state matches what we stored
      const storedState = localStorage.getItem('spotify_auth_state');
      if (state !== storedState) {
        toast({
          title: "Authentication Error",
          description: "Invalid state parameter",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      // Clean up stored state
      localStorage.removeItem('spotify_auth_state');

      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          toast({
            title: "Authentication Required",
            description: "Please log in to connect Spotify",
            variant: "destructive",
          });
          navigate('/auth');
          return;
        }

        // Send the current origin's redirect URI to the edge function
        const redirectUri = `${window.location.origin}/spotify-callback`;

        const response = await supabase.functions.invoke('spotify-auth', {
          body: { code, state, redirect_uri: redirectUri },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        // Send success message to parent window and close popup
        if (window.opener) {
          window.opener.postMessage({ type: 'spotify-auth-success' }, window.location.origin);
          window.close();
        } else {
          // Fallback: navigate normally if not in popup
          navigate('/');
        }
      } catch (error: any) {
        console.error('Spotify auth error:', error);
        
        // Send error message to parent window and close popup
        if (window.opener) {
          window.opener.postMessage({ 
            type: 'spotify-auth-error', 
            error: error.message 
          }, window.location.origin);
          window.close();
        } else {
          // Fallback: show toast and navigate if not in popup
          toast({
            title: "Connection Failed",
            description: `Failed to connect to Spotify: ${error.message}`,
            variant: "destructive",
          });
          navigate('/');
        }
      }
    };

    processCallback();
  }, [navigate, toast]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-serato-dark via-serato-dark-elevated to-black flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Connecting to Spotify...</h1>
        <p className="text-gray-400">Please wait while we complete your Spotify connection.</p>
      </div>
    </div>
  );
};

export default SpotifyCallback;
