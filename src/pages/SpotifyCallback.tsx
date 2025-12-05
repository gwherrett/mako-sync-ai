
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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

const SpotifyCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<CallbackStep[]>([
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
  ]);

  const updateStepStatus = (stepIndex: number, status: CallbackStep['status']) => {
    setCurrentStep(stepIndex);
    setSteps(prevSteps => prevSteps.map((step, index) => ({
      ...step,
      status: index < stepIndex ? 'completed' : index === stepIndex ? status : 'pending'
    })));
  };

  const getProgressValue = () => {
    const completedSteps = steps.filter(step => step.status === 'completed').length;
    const activeStep = steps.findIndex(step => step.status === 'active');
    
    if (activeStep !== -1) {
      return ((completedSteps + 0.5) / steps.length) * 100;
    }
    
    return (completedSteps / steps.length) * 100;
  };

  // Add immediate debug output
  console.log('🟡 CALLBACK COMPONENT MOUNTED - this should appear immediately');
  console.log('🟡 Window location:', window.location.href);
  console.log('🟡 Is popup?', !!window.opener);

  useEffect(() => {
    const processCallback = async () => {
      console.log('🟡 Step 8: SpotifyCallback component loaded - URL:', window.location.href);
      console.log('🟡 Step 8a: Current window is popup?', !!window.opener);
      
      // Step 1: Validate authorization
      updateStepStatus(0, 'active');
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for UX
      
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');

      console.log('🟡 Step 8b: URL parameters extracted:', { code: code?.substring(0, 10) + '...', state, error });

      if (error) {
        console.log('❌ Step 8 Failed: Spotify returned error:', error);
        updateStepStatus(0, 'error');
        toast({
          title: "Spotify Connection Failed",
          description: `Error: ${error}`,
          variant: "destructive",
        });
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      if (!code || !state) {
        console.log('❌ Step 8 Failed: Missing required parameters - code:', !!code, 'state:', !!state);
        updateStepStatus(0, 'error');
        toast({
          title: "Authentication Error",
          description: "Missing authorization code or state",
          variant: "destructive",
        });
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      // Verify state matches what we stored
      const storedState = localStorage.getItem('spotify_auth_state');
      console.log('🟡 Step 9: Verifying state - received:', state, 'stored:', storedState);
      
      if (state !== storedState) {
        console.log('❌ Step 9 Failed: State mismatch - potential CSRF attack');
        updateStepStatus(0, 'error');
        toast({
          title: "Authentication Error",
          description: "Invalid state parameter",
          variant: "destructive",
        });
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      console.log('✅ Step 9 Complete: State verification successful');
      updateStepStatus(0, 'completed');

      // Step 2: Verify session
      updateStepStatus(1, 'active');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Clean up stored state
      localStorage.removeItem('spotify_auth_state');
      console.log('🟡 Step 10: Cleaned up stored state');

      try {
        console.log('🟡 Step 11: Getting current user session...');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.log('❌ Step 11 Failed: No active session found');
          updateStepStatus(1, 'error');
          toast({
            title: "Authentication Required",
            description: "Please log in to connect Spotify",
            variant: "destructive",
          });
          setTimeout(() => navigate('/auth'), 3000);
          return;
        }

        console.log('✅ Step 11 Complete: Session found for user:', session.user.id);
        updateStepStatus(1, 'completed');

        // Step 3: Exchange tokens
        updateStepStatus(2, 'active');
        await new Promise(resolve => setTimeout(resolve, 500));

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
        updateStepStatus(2, 'completed');

        // Step 4: Complete connection
        updateStepStatus(3, 'active');
        await new Promise(resolve => setTimeout(resolve, 1000));
        updateStepStatus(3, 'completed');

        // Show success message
        toast({
          title: "Spotify Connected!",
          description: "Your Spotify account has been successfully connected.",
        });

        // Navigate back to main page
        console.log('🟡 Step 13: Navigating back to main page');
        setTimeout(() => navigate('/'), 2000);
      } catch (error: any) {
        console.error('❌ Step 12 Failed: Spotify auth error:', error);
        updateStepStatus(currentStep, 'error');
        
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
          setTimeout(() => navigate('/'), 3000);
        }
      }
    };

    processCallback();
  }, [navigate, toast, currentStep]);

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
            {steps.map((step, index) => (
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
                  
                  {step.status === 'error' && (
                    <div className="mt-2 text-xs text-red-600">
                      Something went wrong. Redirecting back to the main page...
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
              industry-standard OAuth 2.0 security protocols.
            </AlertDescription>
          </Alert>

          {/* Error State */}
          {steps.some(step => step.status === 'error') && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Connection failed. You'll be redirected back to try again.
              </AlertDescription>
            </Alert>
          )}

          {/* Success State */}
          {steps.every(step => step.status === 'completed') && (
            <Alert className="border-green-200 bg-green-50/50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                <strong>Success!</strong> Your Spotify account has been connected.
                Redirecting to your dashboard...
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SpotifyCallback;
