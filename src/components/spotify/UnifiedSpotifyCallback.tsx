import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SpotifyAuthManager } from '@/services/spotifyAuthManager.service';
import { useAuth } from '@/contexts/NewAuthContext';
import { Loader2, Music } from 'lucide-react';

export const UnifiedSpotifyCallback: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: authLoading, isAuthenticated, session } = useAuth();
  const [isProcessing, setIsProcessing] = useState(true);

  // Create refs to track current state values and avoid stale closures
  const authLoadingRef = useRef(authLoading);
  const sessionRef = useRef(session);

  // Keep refs in sync with state
  useEffect(() => {
    authLoadingRef.current = authLoading;
  }, [authLoading]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

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

        // Step 3: Wait for auth context to stabilize
        console.log('⏳ UNIFIED CALLBACK: Step 3 - Waiting for auth context');
        const maxWaitTime = 5000;
        const startWait = Date.now();

        while (authLoadingRef.current && (Date.now() - startWait) < maxWaitTime) {
          console.log('⏳ UNIFIED CALLBACK: Auth still loading, waiting 100ms...', {
            elapsed: Date.now() - startWait,
            maxWait: maxWaitTime,
            authLoadingRef: authLoadingRef.current
          });
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (Date.now() - startWait >= maxWaitTime) {
          console.error('❌ UNIFIED CALLBACK: Auth context timeout', {
            elapsed: Date.now() - startWait,
            maxWait: maxWaitTime
          });
          toast({
            title: "Authentication Timeout",
            description: "Authentication is taking too long. Please try again.",
            variant: "destructive",
          });
          sessionStorage.removeItem(executionFlag);
          setTimeout(() => navigate('/auth'), 2000);
          return;
        }

        console.log('✅ UNIFIED CALLBACK: Auth context ready', {
          elapsed: Date.now() - startWait,
          authLoading: authLoadingRef.current,
          isAuthenticated,
          hasSession: !!sessionRef.current
        });

        // Show validation success
        toast({
          title: "Authorization Validated",
          description: "Exchanging tokens with Spotify...",
        });

        // Step 4: Use session from auth context
        const currentSession = sessionRef.current;
        console.log('📡 UNIFIED CALLBACK: Step 4 - Using session from auth context', {
          hasSession: !!currentSession,
          hasAccessToken: !!currentSession?.access_token,
          hasUser: !!currentSession?.user,
          userId: currentSession?.user?.id,
          step: 4
        });

        if (!currentSession || !currentSession.access_token) {
          console.log('❌ UNIFIED CALLBACK: No valid session in auth context', {
            hasSession: !!currentSession,
            hasAccessToken: !!currentSession?.access_token,
            isAuthenticated,
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

        // Step 5: Call edge function with enhanced timeout and logging
        console.log('🚀 UNIFIED CALLBACK: Step 5 - Calling spotify-auth edge function');
        const edgeFunctionStartTime = Date.now();
        const redirectUri = `${window.location.origin}/spotify-callback`;
        
        // Pre-flight debug logging
        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://bzzstdpfmyqttnzhgaoa.supabase.co";
        console.log('🚀 CALLING EDGE FUNCTION:', {
          url: `${SUPABASE_URL}/functions/v1/spotify-auth`,
          redirectUri,
          codeLength: code?.length,
          hasAuth: !!currentSession.access_token,
          timestamp: new Date().toISOString(),
          step: 5
        });
        
        const edgeFunctionPromise = supabase.functions.invoke('spotify-auth', {
          body: { code, state, redirect_uri: redirectUri },
          headers: {
            Authorization: `Bearer ${currentSession.access_token}`,
          },
        }).then(result => {
          const elapsed = Date.now() - edgeFunctionStartTime;
          console.log('✅ UNIFIED CALLBACK: Edge function completed', {
            elapsed,
            hasError: !!result.error,
            error: result.error?.message,
            step: 5,
            timestamp: new Date().toISOString()
          });
          return result;
        }).catch(error => {
          const elapsed = Date.now() - edgeFunctionStartTime;
          const errorType = error.name === 'AbortError' ? 'NETWORK_TIMEOUT' :
                           error.message?.includes('timeout') ? 'SERVER_TIMEOUT' :
                           error.message?.includes('fetch') ? 'NETWORK_ERROR' : 'SERVER_ERROR';
          
          console.error('❌ UNIFIED CALLBACK: Edge function failed', {
            elapsed,
            error: error.message,
            errorType,
            errorName: error.name,
            step: 5,
            timestamp: new Date().toISOString()
          });
          
          // Enhance error with type information
          error.errorType = errorType;
          throw error;
        });

        const edgeFunctionTimeoutPromise = new Promise<any>((_, reject) =>
          setTimeout(() => {
            const elapsed = Date.now() - edgeFunctionStartTime;
            console.error('❌ UNIFIED CALLBACK: Edge function timeout', {
              elapsed,
              timeout: 45000,
              step: 5,
              timestamp: new Date().toISOString()
            });
            const timeoutError = new Error('Edge function timeout - never reached server');
            (timeoutError as any).errorType = 'NETWORK_TIMEOUT';
            reject(timeoutError);
          }, 45000) // Increased from 10s to 45s for cold-start edge functions
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
        console.error('❌ UNIFIED CALLBACK: Critical error:', error);
        
        // DON'T trigger a session check that might fail
        // Just navigate with existing session intact
        sessionStorage.removeItem(executionFlag);
        
        toast({
          title: "Connection Failed",
          description: `Failed to connect to Spotify: ${error.message}. Please try again.`,
          variant: "destructive",
        });
        
        // Use a longer delay to ensure toast is visible
        setTimeout(() => navigate('/'), 3000);
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