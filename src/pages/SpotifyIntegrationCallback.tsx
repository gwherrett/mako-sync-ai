import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/**
 * SPOTIFY INTEGRATION CALLBACK HANDLER
 * 
 * IMPORTANT: This callback handles SPOTIFY OAuth, but requires 
 * a valid SUPABASE session for the user to be logged into the app.
 * 
 * DUAL AUTHENTICATION ARCHITECTURE:
 * 1. User must first be authenticated with Supabase (app login)
 * 2. Then they can connect their Spotify account (OAuth integration)
 * 3. This callback processes the Spotify OAuth response
 * 4. Requires both systems to work together for full functionality
 * 
 * Flow:
 * - User clicks "Connect Spotify" (requires Supabase session)
 * - Redirected to Spotify OAuth
 * - Spotify redirects back here with auth code
 * - We exchange code for tokens via edge function
 * - Tokens are stored securely in Supabase
 */
const SpotifyIntegrationCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const processCallback = async () => {
      console.log('🟡 SPOTIFY INTEGRATION: Processing OAuth callback');
      
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

        // Verify state parameter for security
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

        // CRITICAL: Check for valid Supabase session
        // This is the app authentication - user must be logged into Mako Sync
        const { data: { session } } = await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Session fetch timeout')), 10000)
          )
        ]) as any;
        
        // Separate error path for missing session
        if (!session) {
          console.error('❌ NO SUPABASE SESSION - User not logged into app');
          toast({
            title: "Application Session Required",
            description: "You must be logged into Mako Sync to connect Spotify",
            variant: "destructive",
          });
          navigate('/'); // Main page, not auth page
          return;
        }

        console.log('✅ SUPABASE SESSION VALID - User is signed into the application');

        // Exchange Spotify code for tokens via edge function
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

        console.log('✅ SPOTIFY INTEGRATION COMPLETED SUCCESSFULLY');
        
        // Show success and redirect
        toast({
          title: "Spotify Connected!",
          description: "Your Spotify account has been successfully integrated with Mako Sync.",
        });
        
        navigate('/');
        
      } catch (error: any) {
        console.error('❌ SPOTIFY INTEGRATION ERROR:', error);
        
        toast({
          title: "Integration Failed",
          description: error.message || "Failed to integrate with Spotify",
          variant: "destructive",
        });
        
        navigate('/');
      }
    };

    processCallback();
  }, [navigate, toast]);

  // Show loading state with clear messaging about dual authentication
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <div className="space-y-2">
          <p className="text-lg font-medium">Connecting to Spotify...</p>
          <p className="text-sm text-muted-foreground">
            Integrating your Spotify account with Mako Sync
          </p>
          <p className="text-xs text-muted-foreground">
            You are signed into the application ✓
          </p>
        </div>
      </div>
    </div>
  );
};

export default SpotifyIntegrationCallback;