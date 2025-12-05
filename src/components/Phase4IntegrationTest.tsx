import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TestTube, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Shield,
  Activity,
  RefreshCw
} from 'lucide-react';
import { useSpotifyTokens } from '@/hooks/useSpotifyTokens';
import { SpotifyTokenRefreshService } from '@/services/spotifyTokenRefresh.service';
import { SpotifyHealthMonitorService } from '@/services/spotifyHealthMonitor.service';
import { SpotifySecurityValidatorService } from '@/services/spotifySecurityValidator.service';
import { Phase4ErrorHandlerService } from '@/services/phase4ErrorHandler.service';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
  duration?: number;
}

export const Phase4IntegrationTest = () => {
  const { connection, isConnected } = useSpotifyTokens();
  const [tests, setTests] = useState<TestResult[]>([
    { name: 'Token Refresh Service', status: 'pending' },
    { name: 'Health Monitor Service', status: 'pending' },
    { name: 'Security Validator Service', status: 'pending' },
    { name: 'Edge Function Integration', status: 'pending' },
    { name: 'Error Handler Service', status: 'pending' },
  ]);
  const [isRunning, setIsRunning] = useState(false);

  const updateTest = (index: number, updates: Partial<TestResult>) => {
    setTests(prev => prev.map((test, i) => i === index ? { ...test, ...updates } : test));
  };

  const runTests = async () => {
    if (!connection || !isConnected) {
      alert('Please connect your Spotify account first');
      return;
    }

    setIsRunning(true);
    
    // Test 1: Token Refresh Service
    updateTest(0, { status: 'running' });
    const startTime1 = Date.now();
    try {
      const tokenHealth = SpotifyTokenRefreshService.validateTokenHealth(connection);
      updateTest(0, { 
        status: 'success', 
        message: `Token status: ${tokenHealth.status}`,
        duration: Date.now() - startTime1
      });
    } catch (error: any) {
      updateTest(0, { 
        status: 'error', 
        message: error.message,
        duration: Date.now() - startTime1
      });
    }

    // Test 2: Health Monitor Service
    updateTest(1, { status: 'running' });
    const startTime2 = Date.now();
    try {
      const monitor = SpotifyHealthMonitorService.getInstance();
      const metrics = monitor.getHealthMetrics();
      updateTest(1, { 
        status: 'success', 
        message: `Monitor initialized, metrics: ${metrics ? 'available' : 'pending'}`,
        duration: Date.now() - startTime2
      });
    } catch (error: any) {
      updateTest(1, { 
        status: 'error', 
        message: error.message,
        duration: Date.now() - startTime2
      });
    }

    // Test 3: Security Validator Service
    updateTest(2, { status: 'running' });
    const startTime3 = Date.now();
    try {
      const validation = await SpotifySecurityValidatorService.validateTokenSecurity(connection);
      updateTest(2, { 
        status: 'success', 
        message: `Risk level: ${validation.riskLevel}, Issues: ${validation.issues.length}`,
        duration: Date.now() - startTime3
      });
    } catch (error: any) {
      updateTest(2, { 
        status: 'error', 
        message: error.message,
        duration: Date.now() - startTime3
      });
    }

    // Test 4: Edge Function Integration
    updateTest(3, { status: 'running' });
    const startTime4 = Date.now();
    try {
      // Test health check endpoint
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const response = await supabase.functions.invoke('spotify-sync-liked', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: {
            health_check: true
          }
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        updateTest(3, { 
          status: 'success', 
          message: `Health check passed: ${response.data?.success ? 'OK' : 'Failed'}`,
          duration: Date.now() - startTime4
        });
      } else {
        throw new Error('No active session');
      }
    } catch (error: any) {
      updateTest(3, { 
        status: 'error', 
        message: error.message,
        duration: Date.now() - startTime4
      });
    }

    // Test 5: Error Handler Service
    updateTest(4, { status: 'running' });
    const startTime5 = Date.now();
    try {
      // Test error logging
      Phase4ErrorHandlerService.handleError(
        'security-validator',
        'integrationTest',
        new Error('Test error for integration testing'),
        { testRun: true },
        false
      );

      const stats = Phase4ErrorHandlerService.getErrorStats();
      const serviceHealth = Phase4ErrorHandlerService.getServiceHealth();
      
      updateTest(4, { 
        status: 'success', 
        message: `Errors logged: ${stats.total}, Services monitored: ${Object.keys(serviceHealth).length}`,
        duration: Date.now() - startTime5
      });
    } catch (error: any) {
      updateTest(4, { 
        status: 'error', 
        message: error.message,
        duration: Date.now() - startTime5
      });
    }

    setIsRunning(false);
  };

  const resetTests = () => {
    setTests(prev => prev.map(test => ({ ...test, status: 'pending', message: undefined, duration: undefined })));
    Phase4ErrorHandlerService.clearErrors();
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return <TestTube className="h-4 w-4 text-gray-400" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'running':
        return 'default';
      case 'success':
        return 'default';
      case 'error':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const successCount = tests.filter(t => t.status === 'success').length;
  const errorCount = tests.filter(t => t.status === 'error').length;
  const totalTests = tests.length;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-blue-500" />
            <div>
              <CardTitle>Phase 4 Integration Test</CardTitle>
              <CardDescription>
                Test all Phase 4 services and integrations
              </CardDescription>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={resetTests}
              variant="outline"
              size="sm"
              disabled={isRunning}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            
            <Button
              onClick={runTests}
              disabled={isRunning || !isConnected}
              size="sm"
            >
              <Activity className="h-4 w-4 mr-2" />
              {isRunning ? 'Running Tests...' : 'Run Tests'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!isConnected && (
          <Alert>
            <AlertDescription>
              Please connect your Spotify account to run Phase 4 integration tests.
            </AlertDescription>
          </Alert>
        )}

        {/* Test Results Summary */}
        {(successCount > 0 || errorCount > 0) && (
          <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
            <div className="text-sm">
              <span className="font-medium">Results: </span>
              <span className="text-green-600">{successCount} passed</span>
              {errorCount > 0 && (
                <>
                  <span className="text-muted-foreground"> • </span>
                  <span className="text-red-600">{errorCount} failed</span>
                </>
              )}
              <span className="text-muted-foreground"> • </span>
              <span className="text-muted-foreground">{totalTests - successCount - errorCount} pending</span>
            </div>
          </div>
        )}

        {/* Individual Test Results */}
        <div className="space-y-3">
          {tests.map((test, index) => (
            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(test.status)}
                <div>
                  <div className="font-medium">{test.name}</div>
                  {test.message && (
                    <div className="text-sm text-muted-foreground">{test.message}</div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {test.duration && (
                  <span className="text-xs text-muted-foreground">
                    {test.duration}ms
                  </span>
                )}
                <Badge variant={getStatusColor(test.status)}>
                  {test.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default Phase4IntegrationTest;