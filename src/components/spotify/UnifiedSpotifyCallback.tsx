import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SpotifyAuthManager } from '@/services/spotifyAuthManager.service';
import { sessionCache } from '@/services/sessionCache.service';
import { useAuth } from '@/contexts/NewAuthContext';
import { Loader2, Music } from 'lucide-react';

export const UnifiedSpotifyCallback: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: authLoading, isAuthenticated } = useAuth();
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
      const startTime = Date.now();
      console.log('🟡 UNIFIED CALLBACK: Starting callback processing', {
        timestamp: new Date().toISOString(),
        authLoading,
        isAuthenticated,
        url: window.location.href
      });
      
      // Show initial processing toast
      toast({
        title: "Connecting to Spotify",
        description: "Processing your Spotify authorization...",
      });
      
      try {
        // Step 1: Parse URL parameters
        console.log('📋 UNIFIED CALLBACK: Step 1 - Parsing URL parameters');
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        console.log('🟡 UNIFIED CALLBACK: URL parameters parsed:', {
          hasCode: !!code,
          codeLength: code?.length,
          hasState: !!state,
          stateValue: state?.substring(0, 10) + '...',
          error,
          step: 1,
          elapsed: Date.now() - startTime
        });

        if (error) {
          console.log('❌ UNIFIED CALLBACK: Spotify returned error:', error);
          toast({
            title: "Spotify Connection Failed",
            description: `Error: ${error}`,
            variant: "destructive",
          });
          sessionStorage.removeItem(executionFlag);
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
          sessionStorage.removeItem(executionFlag);
          setTimeout(() => navigate('/'), 2000);
          return;
        }

        // Step 2: Verify state parameter
        console.log('🔐 UNIFIED CALLBACK: Step 2 - Verifying state parameter');
        const storedState = localStorage.getItem('spotify_auth_state');
        const backupState = sessionStorage.getItem('spotify_auth_state_backup');
        
        console.log('🔐 UNIFIED CALLBACK: State verification:', {
          receivedState: state?.substring(0, 10) + '...',
          storedState: storedState?.substring(0, 10) + '...',
          backupState: backupState?.substring(0, 10) + '...',
          stateMatches: state === storedState || state === backupState,
          step: 2,
          elapsed: Date.now() - startTime
        });
        
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

        // Step 3: Wait for auth context to stabilize if needed
        console.log('⏳ UNIFIED CALLBACK: Step 3 - Checking auth context readiness');
        if (authLoading) {
          console.log('⏳ UNIFIED CALLBACK: Auth context still loading, waiting...');
          await new Promise(resolve => setTimeout(resolve, 500));
          console.log('⏳ UNIFIED CALLBACK: Auth context wait completed');
        }

        // Show validation success
        toast({
          title: "Authorization Validated",
          description: "Exchanging tokens with Spotify...",
        });

        // Step 4: Get session using cached service
        console.log('📡 UNIFIED CALLBACK: Step 4 - Getting session using cache service');
        const sessionStartTime = Date.now();
        
        const { session, error: sessionError } = await sessionCache.getSession();
        
        const sessionElapsed = Date.now() - sessionStartTime;
        console.log('✅ UNIFIED CALLBACK: Session fetch completed via cache', {
          elapsed: sessionElapsed,
          hasSession: !!session,
          hasUser: !!session?.user,
          error: sessionError?.message,
          step: 4,
          cacheStatus: sessionCache.getCacheStatus()
        });
        
        if (sessionError || !session) {
          console.log('❌ UNIFIED CALLBACK: No valid session', {
            sessionError: sessionError?.message,
            hasSession: !!session,
            step: 4,
            elapsed: Date.now() - startTime
          });
          toast({
            title: "Authentication Required",
            description: "Please log in to connect Spotify",
            variant: "destructive",
          });
          sessionStorage.removeItem(executionFlag);
          setTimeout(() => navigate('/auth'), 2000);
          return;
        }

        // Step 5: Call edge function with timeout
        console.log('🚀 UNIFIED CALLBACK: Step 5 - Calling spotify-auth edge function');
        const edgeFunctionStartTime = Date.now();
        const redirectUri = `${window.location.origin}/spotify-callback`;
        
        const edgeFunctionPromise = supabase.functions.invoke('spotify-auth', {
          body: { code, state, redirect_uri: redirectUri },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }).then(result => {
          const elapsed = Date.now() - edgeFunctionStartTime;
          console.log('✅ UNIFIED CALLBACK: Edge function completed', {
            elapsed,
            hasError: !!result.error,
            error: result.error?.message,
            step: 5
          });
          return result;
        }).catch(error => {
          const elapsed = Date.now() - edgeFunctionStartTime;
          console.error('❌ UNIFIED CALLBACK: Edge function failed', {
            elapsed,
            error: error.message,
            step: 5
          });
          throw error;
        });

        const edgeFunctionTimeoutPromise = new Promise<any>((_, reject) =>
          setTimeout(() => {
            const elapsed = Date.now() - edgeFunctionStartTime;
            console.error('❌ UNIFIED CALLBACK: Edge function timeout', {
              elapsed,
              timeout: 10000,
              step: 5
            });
            reject(new Error('Edge function timeout'));
          }, 10000)
        );

        const response = await Promise.race([
          edgeFunctionPromise,
          edgeFunctionTimeoutPromise
        ]);

        if (response.error) {
          console.error('❌ UNIFIED CALLBACK: Edge function error:', {
            error: response.error,
            step: 5,
            elapsed: Date.now() - startTime
          });
          toast({
            title: "Connection Failed",
            description: `Failed to connect: ${response.error.message}`,
            variant: "destructive",
          });
          sessionStorage.removeItem(executionFlag);
          setTimeout(() => navigate('/'), 2000);
          return;
        }

        // Step 6: Force auth manager refresh
        console.log('🔄 UNIFIED CALLBACK: Step 6 - Refreshing auth manager state');
        const authManagerStartTime = Date.now();
        
        const authManager = SpotifyAuthManager.getInstance();
        const authManagerResult = await authManager.checkConnection(true);
        
        console.log('✅ UNIFIED CALLBACK: Auth manager refresh completed', {
          elapsed: Date.now() - authManagerStartTime,
          success: authManagerResult.success,
          error: authManagerResult.error,
          step: 6
        });

        // Step 7: Clean up and complete
        console.log('🧹 UNIFIED CALLBACK: Step 7 - Cleaning up and completing');
        localStorage.removeItem('spotify_auth_state');
        sessionStorage.removeItem('spotify_auth_state_backup');
        sessionStorage.removeItem(executionFlag);

        const totalElapsed = Date.now() - startTime;
        console.log('✅ UNIFIED CALLBACK: Process completed successfully', {
          totalElapsed,
          steps: 7,
          timestamp: new Date().toISOString()
        });

        // Show success message
        toast({
          title: "Spotify Connected!",
          description: "Your Spotify account has been successfully connected.",
        });

        // Navigate back to main page
        setTimeout(() => navigate('/'), 1500);

      } catch (error: any) {
        const totalElapsed = Date.now() - startTime;
        console.error('❌ UNIFIED CALLBACK: Critical error:', {
          error: error.message,
          stack: error.stack,
          totalElapsed,
          timestamp: new Date().toISOString()
        });
        
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
  }, [navigate, toast, authLoading, isAuthenticated]);

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