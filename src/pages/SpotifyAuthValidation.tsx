import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  RefreshCw,
  Shield,
  Database,
  Zap,
  Activity,
  ArrowLeft,
  TestTube,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUnifiedSpotifyAuth } from '@/hooks/useUnifiedSpotifyAuth';
import { useUnifiedSpotifyAuthMock } from '@/hooks/useUnifiedSpotifyAuth.mock';
import { useToast } from '@/hooks/use-toast';

const SpotifyAuthValidation: React.FC = () => {
  const [useMockMode, setUseMockMode] = useState(true);
  const { toast } = useToast();

  // Use either mock or real implementation based on mode
  const realAuth = useUnifiedSpotifyAuth();
  const mockAuth = useUnifiedSpotifyAuthMock();
  
  const auth = useMockMode ? mockAuth : realAuth;

  // Test scenarios for mock mode
  const runTestScenario = async (scenario: string) => {
    if (!useMockMode) {
      toast({
        title: "Test Mode Required",
        description: "Switch to Mock Mode to run test scenarios",
        variant: "destructive",
      });
      return;
    }

    const mockAuthTyped = mockAuth as any; // Type assertion for mock-specific methods

    switch (scenario) {
      case 'connect-success':
        toast({
          title: "Test: Successful Connection",
          description: "Simulating successful Spotify connection...",
        });
        mockAuthTyped.setMockConnectionState(true);
        break;

      case 'connect-failure':
        toast({
          title: "Test: Connection Failure",
          description: "Simulating connection failure...",
        });
        mockAuthTyped.setMockConnectionState(false, 'Mock connection failed');
        break;

      case 'token-expiry':
        toast({
          title: "Test: Token Expiry",
          description: "Simulating token expiry scenario...",
        });
        mockAuthTyped.simulateTokenExpiry();
        break;

      case 'network-error':
        toast({
          title: "Test: Network Error",
          description: "Simulating network error...",
        });
        mockAuthTyped.simulateError('network');
        break;

      case 'auth-error':
        toast({
          title: "Test: Auth Error",
          description: "Simulating authentication error...",
        });
        mockAuthTyped.simulateError('auth');
        break;

      case 'api-error':
        toast({
          title: "Test: API Error",
          description: "Simulating Spotify API error...",
        });
        mockAuthTyped.simulateError('api');
        break;

      case 'vault-error':
        toast({
          title: "Test: Vault Error",
          description: "Simulating vault access error...",
        });
        mockAuthTyped.simulateError('vault');
        break;

      default:
        toast({
          title: "Unknown Test",
          description: `Test scenario '${scenario}' not implemented`,
          variant: "destructive",
        });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      healthy: 'default',
      warning: 'secondary',
      error: 'destructive',
      unknown: 'outline'
    };
    
    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-expos-dark via-expos-dark-elevated to-black">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                  <TestTube className="w-8 h-8" />
                  Spotify Auth
                </h1>
                <p className="text-gray-400 mt-1">
                  Comprehensive testing and validation of the unified Spotify authentication system
                </p>
              </div>
            </div>
            
            {/* Mode Toggle */}
            <div className="flex items-center gap-2">
              <Badge variant={useMockMode ? "default" : "outline"}>
                {useMockMode ? "Mock Mode" : "Production Mode"}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUseMockMode(!useMockMode)}
              >
                {useMockMode ? (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Switch to Production
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Switch to Mock
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Mode Warning */}
          <Alert className={useMockMode ? "border-blue-500/20 bg-blue-500/5" : "border-yellow-500/20 bg-yellow-500/5"}>
            <Activity className="w-4 h-4" />
            <AlertDescription>
              <strong>{useMockMode ? "Mock Mode Active" : "Production Mode Active"}:</strong>{" "}
              {useMockMode 
                ? "Using simulated Spotify authentication for safe testing without API calls."
                : "Using real Spotify authentication - requires valid credentials and network access."
              }
            </AlertDescription>
          </Alert>
        </div>

        <Tabs defaultValue="status" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="status">
              <Activity className="w-4 h-4 mr-2" />
              Status
            </TabsTrigger>
            <TabsTrigger value="operations">
              <Zap className="w-4 h-4 mr-2" />
              Operations
            </TabsTrigger>
            <TabsTrigger value="testing">
              <TestTube className="w-4 h-4 mr-2" />
              Testing
            </TabsTrigger>
            <TabsTrigger value="monitoring">
              <Shield className="w-4 h-4 mr-2" />
              Monitoring
            </TabsTrigger>
          </TabsList>

          {/* Status Tab */}
          <TabsContent value="status" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Connection Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    Connection Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span>Connected:</span>
                      <Badge variant={auth.isConnected ? "default" : "outline"}>
                        {auth.isConnected ? "Yes" : "No"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Loading:</span>
                      <Badge variant={auth.isLoading ? "secondary" : "outline"}>
                        {auth.isLoading ? "Yes" : "No"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Health:</span>
                      {getStatusBadge(auth.healthStatus)}
                    </div>
                    {auth.error && (
                      <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
                        {auth.error}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Operation States */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Operation States
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span>Connecting:</span>
                      <Badge variant={auth.isConnecting ? "secondary" : "outline"}>
                        {auth.isConnecting ? "Yes" : "No"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Disconnecting:</span>
                      <Badge variant={auth.isDisconnecting ? "secondary" : "outline"}>
                        {auth.isDisconnecting ? "Yes" : "No"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Syncing:</span>
                      <Badge variant={auth.isSyncing ? "secondary" : "outline"}>
                        {auth.isSyncing ? "Yes" : "No"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Refreshing:</span>
                      <Badge variant={auth.isRefreshing ? "secondary" : "outline"}>
                        {auth.isRefreshing ? "Yes" : "No"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Connection Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Connection Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {auth.connection ? (
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm text-gray-400">Display Name:</span>
                        <div className="font-medium">{auth.connection.display_name || 'Unknown'}</div>
                      </div>
                      <div>
                        <span className="text-sm text-gray-400">Spotify ID:</span>
                        <div className="font-mono text-sm">{auth.connection.spotify_user_id}</div>
                      </div>
                      <div>
                        <span className="text-sm text-gray-400">Expires:</span>
                        <div className="text-sm">
                          {new Date(auth.connection.expires_at).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <span className="text-sm text-gray-400">Token Storage:</span>
                        <div className="text-sm text-green-400">
                          {auth.connection.access_token === '***ENCRYPTED_IN_VAULT***' ? 'Secure (Vault)' : 'Insecure (Plain)'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-400 text-center py-4">
                      No connection available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Operations Tab */}
          <TabsContent value="operations" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Connection Operations */}
              <Card>
                <CardHeader>
                  <CardTitle>Connection Operations</CardTitle>
                  <CardDescription>
                    Test basic connection and disconnection functionality
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    onClick={auth.connectSpotify}
                    disabled={auth.isConnecting || auth.isConnected}
                    className="w-full"
                  >
                    {auth.isConnecting ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      'Connect Spotify'
                    )}
                  </Button>
                  
                  <Button 
                    onClick={auth.disconnectSpotify}
                    disabled={auth.isDisconnecting || !auth.isConnected}
                    variant="outline"
                    className="w-full"
                  >
                    {auth.isDisconnecting ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Disconnecting...
                      </>
                    ) : (
                      'Disconnect Spotify'
                    )}
                  </Button>

                  <Button 
                    onClick={() => auth.checkConnection(true)}
                    variant="secondary"
                    className="w-full"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Force Check Connection
                  </Button>
                </CardContent>
              </Card>

              {/* Token Operations */}
              <Card>
                <CardHeader>
                  <CardTitle>Token Operations</CardTitle>
                  <CardDescription>
                    Test token refresh and management functionality
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    onClick={auth.refreshTokens}
                    disabled={auth.isRefreshing || !auth.isConnected}
                    className="w-full"
                  >
                    {auth.isRefreshing ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      'Refresh Tokens'
                    )}
                  </Button>

                  <Button 
                    onClick={auth.performHealthCheck}
                    disabled={!auth.isConnected}
                    variant="outline"
                    className="w-full"
                  >
                    <Activity className="w-4 h-4 mr-2" />
                    Health Check
                  </Button>

                  <Button 
                    onClick={auth.validateSecurity}
                    disabled={!auth.isConnected}
                    variant="outline"
                    className="w-full"
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Security Validation
                  </Button>
                </CardContent>
              </Card>

              {/* Sync Operations */}
              <Card>
                <CardHeader>
                  <CardTitle>Sync Operations</CardTitle>
                  <CardDescription>
                    Test Spotify data synchronization functionality
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    onClick={() => auth.syncLikedSongs(false)}
                    disabled={auth.isSyncing || !auth.isConnected}
                    className="w-full"
                  >
                    {auth.isSyncing ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      'Incremental Sync'
                    )}
                  </Button>

                  <Button 
                    onClick={() => auth.syncLikedSongs(true)}
                    disabled={auth.isSyncing || !auth.isConnected}
                    variant="outline"
                    className="w-full"
                  >
                    {auth.isSyncing ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      'Full Sync'
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Utility Operations */}
              <Card>
                <CardHeader>
                  <CardTitle>Utility Operations</CardTitle>
                  <CardDescription>
                    Test error handling and recovery functionality
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    onClick={auth.clearError}
                    disabled={!auth.error}
                    variant="outline"
                    className="w-full"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Clear Error
                  </Button>

                  <Button 
                    onClick={auth.retryLastOperation}
                    variant="outline"
                    className="w-full"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Retry Last Operation
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Testing Tab */}
          <TabsContent value="testing" className="space-y-6">
            {useMockMode ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Success Scenarios */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-green-400">Success Scenarios</CardTitle>
                    <CardDescription>
                      Test successful operation scenarios
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button 
                      onClick={() => runTestScenario('connect-success')}
                      className="w-full"
                      variant="outline"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Successful Connection
                    </Button>
                  </CardContent>
                </Card>

                {/* Error Scenarios */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-red-400">Error Scenarios</CardTitle>
                    <CardDescription>
                      Test various error conditions and recovery
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button 
                      onClick={() => runTestScenario('connect-failure')}
                      className="w-full"
                      variant="outline"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Connection Failure
                    </Button>

                    <Button 
                      onClick={() => runTestScenario('token-expiry')}
                      className="w-full"
                      variant="outline"
                    >
                      <Clock className="w-4 h-4 mr-2" />
                      Token Expiry
                    </Button>

                    <Button 
                      onClick={() => runTestScenario('network-error')}
                      className="w-full"
                      variant="outline"
                    >
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Network Error
                    </Button>

                    <Button 
                      onClick={() => runTestScenario('auth-error')}
                      className="w-full"
                      variant="outline"
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Auth Error
                    </Button>

                    <Button 
                      onClick={() => runTestScenario('api-error')}
                      className="w-full"
                      variant="outline"
                    >
                      <Database className="w-4 h-4 mr-2" />
                      API Error
                    </Button>

                    <Button 
                      onClick={() => runTestScenario('vault-error')}
                      className="w-full"
                      variant="outline"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Vault Error
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Alert>
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  <strong>Production Mode Active:</strong> Test scenarios are only available in Mock Mode. 
                  Switch to Mock Mode to run automated test scenarios safely.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          {/* Monitoring Tab */}
          <TabsContent value="monitoring" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>System Health Overview</CardTitle>
                <CardDescription>
                  Real-time monitoring of the unified authentication system
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      {getStatusIcon(auth.healthStatus)}
                    </div>
                    <div className="text-sm text-gray-400">Health Status</div>
                    <div className="font-semibold">{auth.healthStatus}</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-500">
                      {auth.isConnected ? '1' : '0'}
                    </div>
                    <div className="text-sm text-gray-400">Active Connections</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-500">
                      {useMockMode ? 'Mock' : 'Prod'}
                    </div>
                    <div className="text-sm text-gray-400">Mode</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SpotifyAuthValidation;