/**
 * Auth Debug Panel Component
 * Provides UI for testing auth endpoints and debugging issues
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AuthDebugger } from '@/utils/authDebugger';
import { useAuth } from '@/contexts/NewAuthContext';
import { 
  Bug, 
  Play, 
  Download, 
  Trash2, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Monitor
} from 'lucide-react';

export const AuthDebugPanel: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string>('');
  const [monitoring, setMonitoring] = useState(false);
  const [monitoringCleanup, setMonitoringCleanup] = useState<(() => void) | null>(null);

  const { user, session, loading, isAuthenticated } = useAuth();

  // Auto-capture state on mount
  useEffect(() => {
    AuthDebugger.captureAuthState('component-mount');
  }, []);

  const handleCaptureState = async () => {
    setIsLoading(true);
    try {
      await AuthDebugger.captureAuthState('manual-capture');
      setDebugLogs(AuthDebugger.exportLogs());
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestEndpoints = async () => {
    setIsLoading(true);
    try {
      await AuthDebugger.testAuthEndpoints();
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestSignIn = async () => {
    if (!email || !password) {
      alert('Please enter email and password');
      return;
    }

    setIsLoading(true);
    try {
      await AuthDebugger.testSignIn(email, password);
      setDebugLogs(AuthDebugger.exportLogs());
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestSignOut = async () => {
    setIsLoading(true);
    try {
      await AuthDebugger.testSignOut();
      setDebugLogs(AuthDebugger.exportLogs());
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportLogs = () => {
    const logs = AuthDebugger.exportLogs();
    const blob = new Blob([logs], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auth-debug-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearLogs = () => {
    AuthDebugger.clearLogs();
    setDebugLogs('');
  };

  const toggleMonitoring = () => {
    if (monitoring) {
      monitoringCleanup?.();
      setMonitoringCleanup(null);
      setMonitoring(false);
    } else {
      const cleanup = AuthDebugger.startMonitoring();
      setMonitoringCleanup(() => cleanup);
      setMonitoring(true);
    }
  };

  const getAuthStatus = () => {
    if (loading) return { icon: AlertTriangle, color: 'yellow', text: 'Loading' };
    if (isAuthenticated) return { icon: CheckCircle, color: 'green', text: 'Authenticated' };
    return { icon: XCircle, color: 'red', text: 'Not Authenticated' };
  };

  const authStatus = getAuthStatus();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="w-5 h-5" />
            Auth Debug Panel
          </CardTitle>
          <CardDescription>
            Comprehensive debugging tools for authentication issues
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Badge variant={authStatus.color === 'green' ? 'default' : 'destructive'}>
              <authStatus.icon className="w-3 h-3 mr-1" />
              {authStatus.text}
            </Badge>
            {user && (
              <Badge variant="outline">
                {user.email}
              </Badge>
            )}
            <Button
              onClick={toggleMonitoring}
              variant={monitoring ? 'destructive' : 'outline'}
              size="sm"
            >
              <Monitor className="w-4 h-4 mr-2" />
              {monitoring ? 'Stop Monitoring' : 'Start Monitoring'}
            </Button>
          </div>

          <Tabs defaultValue="quick-tests" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="quick-tests">Quick Tests</TabsTrigger>
              <TabsTrigger value="manual-tests">Manual Tests</TabsTrigger>
              <TabsTrigger value="state-info">State Info</TabsTrigger>
              <TabsTrigger value="debug-logs">Debug Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="quick-tests" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={handleCaptureState}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Capture Auth State
                </Button>

                <Button
                  onClick={handleTestEndpoints}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  Test Endpoints
                </Button>

                <Button
                  onClick={handleTestSignOut}
                  disabled={isLoading || !isAuthenticated}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Test Sign Out
                </Button>

                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Force Reload
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="manual-tests" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Test Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter test email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Test Password</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter test password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <Button
                  onClick={handleTestSignIn}
                  disabled={isLoading || !email || !password}
                  className="w-full flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  Test Sign In Flow
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="state-info" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Current User</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                      {JSON.stringify(user, null, 2)}
                    </pre>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Current Session</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                      {JSON.stringify(session, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Browser Info</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                    {JSON.stringify(AuthDebugger.getBrowserInfo(), null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="debug-logs" className="space-y-4">
              <div className="flex gap-2">
                <Button
                  onClick={handleExportLogs}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export Logs
                </Button>

                <Button
                  onClick={handleClearLogs}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Logs
                </Button>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Debug Logs</CardTitle>
                  <CardDescription>
                    Captured auth states and test results
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-4 rounded overflow-auto max-h-96">
                    {debugLogs || 'No logs captured yet. Run some tests to see debug information.'}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Debug Mode Active:</strong> This panel provides direct access to auth testing.
          Check the browser console for detailed logging output.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default AuthDebugPanel;