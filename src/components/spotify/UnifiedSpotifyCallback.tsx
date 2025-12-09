import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SpotifyAuthManager } from '@/services/spotifyAuthManager.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  Music,
  CheckCircle,
  XCircle,
  Shield,
  Key,
  ArrowRight,
  AlertTriangle
} from 'lucide-react';

interface CallbackStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

interface CallbackState {
  currentStep: number;
  steps: CallbackStep[];
  error: string | null;
  isProcessing: boolean;
}

export const UnifiedSpotifyCallback: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [state, setState] = useState<CallbackState>({
    currentStep: 0,
    steps: [
      {
        id: 'validate',
        title: 'Validating Authorization',
        description: 'Checking authorization code and state parameters',
        status: 'pending'
      },
      {
        id: 'session',
        title: 'Verifying Session',
        description: 'Confirming your authentication status',
        status: 'pending'
      },
      {
        id: 'exchange',
        title: 'Exchanging Tokens',
        description: 'Securely exchanging authorization code for access tokens',
        status: 'pending'
      },
      {
        id: 'complete',
        title: 'Connection Complete',
        description: 'Your Spotify account is now connected',
        status: 'pending'
      }
    ],
    error: null,
    isProcessing: false
  });

  const updateStep = (stepIndex: number, status: CallbackStep['status'], error?: string) => {
    setState(prevState => ({
      ...prevState,
      currentStep: stepIndex,
      error: error || null,
      steps: prevState.steps.map((step, index) => ({
        ...step,
        status: index < stepIndex ? 'completed' : index === stepIndex ? status : 'pending'
      }))
    }));
  };

  const getProgressValue = () => {
    const completedSteps = state.steps.filter(step => step.status === 'completed').length;
    const activeStep = state.steps.findIndex(step => step.status === 'active');
    
    if (activeStep !== -1) {
      return ((completedSteps + 0.5) / state.steps.length) * 100;
    }
    
    return (completedSteps / state.steps.length) * 100;
  };

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
      
      setState(prev => ({ ...prev, isProcessing: true }));
      
      try {
        // Step 1: Validate authorization
        updateStep(0, 'active');
        await new Promise(resolve => setTimeout(resolve, 500));
        
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
          updateStep(0, 'error', `Spotify error: ${error}`);
          toast({
            title: "Spotify Connection Failed",
            description: `Error: ${error}`,
            variant: "destructive",
          });
          setTimeout(() => navigate('/'), 3000);
          return;
        }

        if (!code || !state) {
          console.log('❌ UNIFIED CALLBACK: Missing required parameters');
          updateStep(0, 'error', 'Missing authorization code or state');
          toast({
            title: "Authentication Error",
            description: "Missing authorization code or state",
            variant: "destructive",
          });
          setTimeout(() => navigate('/'), 3000);
          return;
        }

        // Verify state parameter
        const storedState = localStorage.getItem('spotify_auth_state');
        const backupState = sessionStorage.getItem('spotify_auth_state_backup');
        
        if (state !== storedState && state !== backupState) {
          console.log('❌ UNIFIED CALLBACK: State parameter mismatch');
          updateStep(0, 'error', 'Invalid state parameter - security check failed');
          toast({
            title: "Security Error",
            description: "Invalid state parameter - please try connecting again",
            variant: "destructive",
          });
          
          // Clean up stored states
          localStorage.removeItem('spotify_auth_state');
          sessionStorage.removeItem('spotify_auth_state_backup');
          sessionStorage.removeItem(executionFlag);
          
          setTimeout(() => navigate('/'), 3000);
          return;
        }

        updateStep(0, 'completed');

        // Step 2: Verify session
        updateStep(1, 'active');
        await new Promise(resolve => setTimeout(resolve, 500));

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          console.log('❌ UNIFIED CALLBACK: No valid session');
          updateStep(1, 'error', 'No valid session found');
          toast({
            title: "Authentication Required",
            description: "Please log in to connect Spotify",
            variant: "destructive",
          });
          setTimeout(() => navigate('/auth'), 3000);
          return;
        }

        updateStep(1, 'completed');

        // Step 3: Exchange tokens using unified auth manager
        updateStep(2, 'active');
        await new Promise(resolve => setTimeout(resolve, 500));

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
          updateStep(2, 'error', response.error.message);
          toast({
            title: "Connection Failed",
            description: `Failed to connect: ${response.error.message}`,
            variant: "destructive",
          });
          setTimeout(() => navigate('/'), 3000);
          return;
        }

        updateStep(2, 'completed');

        // Step 4: Complete connection and update auth manager
        updateStep(3, 'active');
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Force the auth manager to refresh its state
        const authManager = SpotifyAuthManager.getInstance();
        await authManager.checkConnection(true);

        updateStep(3, 'completed');

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
        setTimeout(() => navigate('/'), 2000);

      } catch (error: any) {
        console.error('❌ UNIFIED CALLBACK: Critical error:', error);
        updateStep(state.currentStep, 'error', error.message);
        
        // Clean up execution flag on error
        sessionStorage.removeItem(executionFlag);
        
        toast({
          title: "Connection Failed",
          description: `Failed to connect to Spotify: ${error.message}`,
          variant: "destructive",
        });
        setTimeout(() => navigate('/'), 3000);
      } finally {
        setState(prev => ({ ...prev, isProcessing: false }));
      }
    };

    processCallback();
  }, [navigate, toast]);

  const getStepIcon = (step: CallbackStep, index: number) => {
    if (step.status === 'completed') {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    
    if (step.status === 'active') {
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    }
    
    if (step.status === 'error') {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
    
    return <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Music className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <CardTitle>Connecting to Spotify</CardTitle>
              <CardDescription>
                Please wait while we securely connect your Spotify account
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Connection Progress</span>
              <span className="text-muted-foreground">
                {Math.round(getProgressValue())}%
              </span>
            </div>
            <Progress value={getProgressValue()} className="h-2" />
          </div>

          {/* Connection Steps */}
          <div className="space-y-4">
            {state.steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
                  step.status === 'active' ? 'border-blue-200 bg-blue-50/50' :
                  step.status === 'completed' ? 'border-green-200 bg-green-50/50' :
                  step.status === 'error' ? 'border-red-200 bg-red-50/50' :
                  'border-muted bg-muted/20'
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getStepIcon(step, index)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className={`font-medium ${
                    step.status === 'active' ? 'text-blue-700' :
                    step.status === 'completed' ? 'text-green-700' :
                    step.status === 'error' ? 'text-red-700' :
                    ''
                  }`}>
                    {step.title}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {step.description}
                  </p>
                  
                  {step.status === 'error' && state.error && (
                    <div className="mt-2 text-xs text-red-600">
                      {state.error}
                    </div>
                  )}
                  
                  {step.status === 'active' && (
                    <div className="mt-2 text-xs text-blue-600">
                      Processing...
                    </div>
                  )}
                </div>

                {step.status === 'active' && (
                  <div className="flex-shrink-0">
                    <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Security Notice */}
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Secure Processing:</strong> Your connection is being established using
              industry-standard OAuth 2.0 security protocols with enhanced token protection.
            </AlertDescription>
          </Alert>

          {/* Error State */}
          {state.steps.some(step => step.status === 'error') && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Connection failed. You'll be redirected back to try again.
              </AlertDescription>
            </Alert>
          )}

          {/* Success State */}
          {state.steps.every(step => step.status === 'completed') && (
            <Alert className="border-green-200 bg-green-50/50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                <strong>Success!</strong> Your Spotify account has been connected with enhanced security.
                Redirecting to your dashboard...
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UnifiedSpotifyCallback;