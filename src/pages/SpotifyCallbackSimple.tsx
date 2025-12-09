import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const SpotifyCallbackSimple = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const processCallback = async () => {
      console.log('🟡 SIMPLE CALLBACK: Processing OAuth callback');
      
      try {
        // Extract URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        // Handle Spotify errors
        if (error) {
          console.error('❌ SPOTIFY ERROR:', error);
          toast({
            title: "Spotify Connection Failed",
            description: `Error: ${error}`,
            variant: "destructive",
          });
          navigate('/');
          return;
        }

        // Validate required parameters
        if (!code || !state) {
          console.error('❌ MISSING PARAMETERS:', { code: !!code, state: !!state });
          toast({
            title: "Authentication Error",
            description: "Missing authorization parameters",
            variant: "destructive",
          });
          navigate('/');
          return;
        }

        // Verify state parameter
        const storedState = localStorage.getItem('spotify_auth_state') || 
                           sessionStorage.getItem('spotify_auth_state_backup');
        
        if (state !== storedState) {
          console.error('❌ STATE MISMATCH:', { received: state, stored: storedState });
          toast({
            title: "Security Error",
            description: "Invalid state parameter - please try again",
            variant: "destructive",
          });
          
          // Clean up
          localStorage.removeItem('spotify_auth_state');
          sessionStorage.removeItem('spotify_auth_state_backup');
          navigate('/');
          return;
        }

        // Get current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.error('❌ NO SESSION');
          toast({
            title: "Authentication Required",
            description: "Please log in to connect Spotify",
            variant: "destructive",
          });
          navigate('/auth');
          return;
        }

        // Exchange code for tokens via edge function
        const redirectUri = `${window.location.origin}/spotify-callback`;
        
        console.log('🟡 CALLING EDGE FUNCTION:', { 
          code: code.substring(0, 10) + '...', 
          redirectUri 
        });

        const response = await supabase.functions.invoke('spotify-auth', {
          body: { code, state, redirect_uri: redirectUri },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        // Clean up stored state
        localStorage.removeItem('spotify_auth_state');
        sessionStorage.removeItem('spotify_auth_state_backup');

        console.log('✅ SPOTIFY CONNECTED SUCCESSFULLY');
        
        // Show success and redirect
        toast({
          title: "Spotify Connected!",
          description: "Your account has been successfully connected.",
        });
        
        navigate('/');
        
      } catch (error: any) {
        console.error('❌ CALLBACK ERROR:', error);
        
        toast({
          title: "Connection Failed",
          description: error.message || "Failed to connect to Spotify",
          variant: "destructive",
        });
        
        navigate('/');
      }
    };

    processCallback();
  }, [navigate, toast]);

  // Show minimal loading state
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground">Connecting to Spotify...</p>
      </div>
    </div>
  );
};

export default SpotifyCallbackSimple;