
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const SpotifyCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Add immediate debug output
  console.log('🟡 CALLBACK COMPONENT MOUNTED - this should appear immediately');
  console.log('🟡 Window location:', window.location.href);
  console.log('🟡 Is popup?', !!window.opener);

  useEffect(() => {
    const processCallback = async () => {
      console.log('🟡 Step 8: SpotifyCallback component loaded - URL:', window.location.href);
      console.log('🟡 Step 8a: Current window is popup?', !!window.opener);
      
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');

      console.log('🟡 Step 8b: URL parameters extracted:', { code: code?.substring(0, 10) + '...', state, error });

      if (error) {
        console.log('❌ Step 8 Failed: Spotify returned error:', error);
        toast({
          title: "Spotify Connection Failed",
          description: `Error: ${error}`,
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      if (!code || !state) {
        console.log('❌ Step 8 Failed: Missing required parameters - code:', !!code, 'state:', !!state);
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
      console.log('🟡 Step 9: Verifying state - received:', state, 'stored:', storedState);
      
      if (state !== storedState) {
        console.log('❌ Step 9 Failed: State mismatch - potential CSRF attack');
        toast({
          title: "Authentication Error",
          description: "Invalid state parameter",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      console.log('✅ Step 9 Complete: State verification successful');

      // Clean up stored state
      localStorage.removeItem('spotify_auth_state');
      console.log('🟡 Step 10: Cleaned up stored state');

      try {
        console.log('🟡 Step 11: Getting current user session...');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.log('❌ Step 11 Failed: No active session found');
          toast({
            title: "Authentication Required",
            description: "Please log in to connect Spotify",
            variant: "destructive",
          });
          navigate('/auth');
          return;
        }

        console.log('✅ Step 11 Complete: Session found for user:', session.user.id);

        // Send the current origin's redirect URI to the edge function
        const redirectUri = `${window.location.origin}/spotify-callback`;
        console.log('🟡 Step 12: Calling spotify-auth edge function with redirect URI:', redirectUri);

        const response = await supabase.functions.invoke('spotify-auth', {
          body: { code, state, redirect_uri: redirectUri },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        console.log('🟡 Step 12a: Edge function response:', response);

        if (response.error) {
          throw new Error(response.error.message);
        }

        console.log('✅ Step 12 Complete: Edge function call successful');

        // Navigate back to main page instead of popup messaging
        console.log('🟡 Step 13: Navigating back to main page');
        navigate('/');
      } catch (error: any) {
        console.error('❌ Step 12 Failed: Spotify auth error:', error);
        
        // Send error message to parent window and close popup
        if (window.opener) {
          console.log('🟡 Step 13 Error: Sending error message to parent window');
          window.opener.postMessage({ 
            type: 'spotify-auth-error', 
            error: error.message 
          }, window.location.origin);
          console.log('🟡 Step 13 Error Complete: Error message sent, closing popup');
          window.close();
        } else {
          console.log('🟡 Step 13 Error Alternative: Not in popup, showing error toast');
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
    <div className="min-h-screen bg-gradient-to-br from-expos-dark via-expos-dark-elevated to-black flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Connecting to Spotify...</h1>
        <p className="text-gray-400">Please wait while we complete your Spotify connection.</p>
      </div>
    </div>
  );
};

export default SpotifyCallback;
