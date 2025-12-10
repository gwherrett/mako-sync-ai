import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SpotifyAuthManager } from '@/services/spotifyAuthManager.service';
import { Loader2, Music } from 'lucide-react';

export const UnifiedSpotifyCallback: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    // Prevent multiple executions
    const executionFlag = 'unified_spotify_callback_processing';
    if (sessionStorage.getItem(executionFlag)) {
      console.log('🟡 UNIFIED CALLBACK: Already processing, skipping duplicate execution');
      return;
    }
    
    sessionStorage.setItem(executionFlag, 'true');
    
    const processCallback = async () => {
      console.log('🟡 UNIFIED CALLBACK: Starting callback processing');
      
      // Show initial processing toast
      toast({
        title: "Connecting to Spotify",
        description: "Processing your Spotify authorization...",
      });
      
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        console.log('🟡 UNIFIED CALLBACK: URL parameters:', {
          hasCode: !!code,
          hasState: !!state,
          error
        });

        if (error) {
          console.log('❌ UNIFIED CALLBACK: Spotify returned error:', error);
          toast({
            title: "Spotify Connection Failed",
            description: `Error: ${error}`,
            variant: "destructive",
          });
          setTimeout(() => navigate('/'), 2000);
          return;
        }

        if (!code || !state) {
          console.log('❌ UNIFIED CALLBACK: Missing required parameters');
          toast({
            title: "Authentication Error",
            description: "Missing authorization code or state",
            variant: "destructive",
          });
          setTimeout(() => navigate('/'), 2000);
          return;
        }

        // Verify state parameter
        const storedState = localStorage.getItem('spotify_auth_state');
        const backupState = sessionStorage.getItem('spotify_auth_state_backup');
        
        if (state !== storedState && state !== backupState) {
          console.log('❌ UNIFIED CALLBACK: State parameter mismatch');
          toast({
            title: "Security Error",
            description: "Invalid state parameter - please try connecting again",
            variant: "destructive",
          });
          
          // Clean up stored states
          localStorage.removeItem('spotify_auth_state');
          sessionStorage.removeItem('spotify_auth_state_backup');
          sessionStorage.removeItem(executionFlag);
          
          setTimeout(() => navigate('/'), 2000);
          return;
        }

        // Show validation success
        toast({
          title: "Authorization Validated",
          description: "Exchanging tokens with Spotify...",
        });

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          console.log('❌ UNIFIED CALLBACK: No valid session');
          toast({
            title: "Authentication Required",
            description: "Please log in to connect Spotify",
            variant: "destructive",
          });
          setTimeout(() => navigate('/auth'), 2000);
          return;
        }

        const redirectUri = `${window.location.origin}/spotify-callback`;
        
        console.log('🟡 UNIFIED CALLBACK: Calling spotify-auth edge function');
        
        const response = await supabase.functions.invoke('spotify-auth', {
          body: { code, state, redirect_uri: redirectUri },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.error) {
          console.error('❌ UNIFIED CALLBACK: Edge function error:', response.error);
          toast({
            title: "Connection Failed",
            description: `Failed to connect: ${response.error.message}`,
            variant: "destructive",
          });
          setTimeout(() => navigate('/'), 2000);
          return;
        }

        // Force the auth manager to refresh its state
        const authManager = SpotifyAuthManager.getInstance();
        await authManager.checkConnection(true);

        // Clean up stored state and execution flag
        localStorage.removeItem('spotify_auth_state');
        sessionStorage.removeItem('spotify_auth_state_backup');
        sessionStorage.removeItem(executionFlag);

        // Show success message
        toast({
          title: "Spotify Connected!",
          description: "Your Spotify account has been successfully connected.",
        });

        // Navigate back to main page
        setTimeout(() => navigate('/'), 1500);

      } catch (error: any) {
        console.error('❌ UNIFIED CALLBACK: Critical error:', error);
        
        // Clean up execution flag on error
        sessionStorage.removeItem(executionFlag);
        
        toast({
          title: "Connection Failed",
          description: `Failed to connect to Spotify: ${error.message}`,
          variant: "destructive",
        });
        setTimeout(() => navigate('/'), 2000);
      } finally {
        setIsProcessing(false);
      }
    };

    processCallback();
  }, [navigate, toast]);

  // Simple loading screen while processing
  if (isProcessing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-4">
          <div className="p-4 bg-green-500/10 rounded-full">
            <Music className="h-8 w-8 text-green-500" />
          </div>
          <div className="flex items-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin text-green-500" />
            <span className="text-lg font-medium">Connecting to Spotify...</span>
          </div>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Please wait while we securely process your Spotify authorization.
            You'll be redirected automatically.
          </p>
        </div>
      </div>
    );
  }

  // This should rarely be seen as the component redirects quickly
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-lg">Processing complete. Redirecting...</p>
      </div>
    </div>
  );
};

export default UnifiedSpotifyCallback;