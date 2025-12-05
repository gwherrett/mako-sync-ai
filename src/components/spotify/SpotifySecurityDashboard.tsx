import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Eye, 
  EyeOff,
  Clock,
  Activity,
  Lock,
  Unlock,
  Zap,
  TrendingUp,
  Settings
} from 'lucide-react';
import { useSpotifyTokens } from '@/hooks/useSpotifyTokens';
import { SpotifyTokenRefreshService } from '@/services/spotifyTokenRefresh.service';
import { SpotifyHealthMonitorService } from '@/services/spotifyHealthMonitor.service';
import { SpotifySecurityValidatorService } from '@/services/spotifySecurityValidator.service';
import { cn } from '@/lib/utils';

interface SecurityDashboardProps {
  className?: string;
  showDetailedMetrics?: boolean;
}

export const SpotifySecurityDashboard = ({
  className,
  showDetailedMetrics = true
}: SecurityDashboardProps) => {
  const { connection, isConnected, isLoading } = useSpotifyTokens();
  
  const [securityValidation, setSecurityValidation] = useState<any>(null);
  const [healthMetrics, setHealthMetrics] = useState<any>(null);
  const [securityMetrics, setSecurityMetrics] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);

  // Initialize health monitoring
  useEffect(() => {
    if (isConnected && connection) {
      const monitor = SpotifyHealthMonitorService.getInstance();
      
      // Add listener for health updates
      const unsubscribe = monitor.addListener((metrics, alerts) => {
        setHealthMetrics(metrics);
        setAlerts(alerts);
      });

      // Start monitoring
      monitor.startMonitoring();
      setMonitoringEnabled(true);

      return () => {
        unsubscribe();
        monitor.stopMonitoring();
      };
    }
  }, [isConnected, connection]);

  // Perform security validation
  const performSecurityValidation = async () => {
    if (!connection) return;

    setIsValidating(true);
    try {
      const [validation, metrics] = await Promise.all([
        SpotifySecurityValidatorService.validateTokenSecurity(connection),
        SpotifySecurityValidatorService.generateSecurityMetrics(connection)
      ]);

      setSecurityValidation(validation);
      setSecurityMetrics(metrics);
    } catch (error) {
      console.error('Security validation failed:', error);
    } finally {
      setIsValidating(false);
    }
  };

  // Initial security validation
  useEffect(() => {
    if (connection) {
      performSecurityValidation();
    }
  }, [connection]);

  const getSecurityStatusColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-orange-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getSecurityStatusIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'medium': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'high': return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'critical': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <Shield className="h-5 w-5 text-gray-500" />;
    }
  };

  const acknowledgeAlert = (alertId: string) => {
    const monitor = SpotifyHealthMonitorService.getInstance();
    monitor.acknowledgeAlert(alertId);
  };

  const performAutomatedRemediation = async () => {
    if (!connection) return;

    try {
      const result = await SpotifySecurityValidatorService.performAutomatedRemediation(connection);
      
      if (result.success) {
        // Refresh validation after remediation
        await performSecurityValidation();
      }
    } catch (error) {
      console.error('Automated remediation failed:', error);
    }
  };

  if (isLoading) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading security dashboard...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isConnected) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="pt-6">
          <div className="text-center space-y-3">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto" />
            <div>
              <h3 className="font-medium">No Spotify Connection</h3>
              <p className="text-sm text-muted-foreground">
                Connect your Spotify account to view security dashboard
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('w-full space-y-6', className)}>
      {/* Security Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-blue-500" />
              <div>
                <CardTitle>Security Dashboard</CardTitle>
                <CardDescription>
                  Comprehensive security monitoring for your Spotify connection
                </CardDescription>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                onClick={performSecurityValidation}
                disabled={isValidating}
                size="sm"
                variant="outline"
              >
                <RefreshCw className={cn('h-4 w-4 mr-2', isValidating && 'animate-spin')} />
                {isValidating ? 'Validating...' : 'Refresh'}
              </Button>
              
              <Button
                onClick={() => setShowSensitiveData(!showSensitiveData)}
                size="sm"
                variant="ghost"
              >
                {showSensitiveData ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="health">Health</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="alerts">Alerts</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Security Score */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Security Score</p>
                        <p className="text-2xl font-bold">
                          {securityMetrics?.tokenSecurityScore || 0}
                        </p>
                      </div>
                      <Shield className="h-8 w-8 text-blue-500" />
                    </div>
                    <Progress 
                      value={securityMetrics?.tokenSecurityScore || 0} 
                      className="mt-3"
                    />
                  </CardContent>
                </Card>

                {/* Connection Status */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Connection Status</p>
                        <p className={cn('text-lg font-semibold', getSecurityStatusColor(securityValidation?.riskLevel || 'unknown'))}>
                          {securityValidation?.riskLevel?.toUpperCase() || 'UNKNOWN'}
                        </p>
                      </div>
                      {getSecurityStatusIcon(securityValidation?.riskLevel || 'unknown')}
                    </div>
                  </CardContent>
                </Card>

                {/* Monitoring Status */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Monitoring</p>
                        <p className="text-lg font-semibold">
                          {monitoringEnabled ? 'Active' : 'Inactive'}
                        </p>
                      </div>
                      <Activity className={cn('h-8 w-8', monitoringEnabled ? 'text-green-500' : 'text-gray-400')} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={performAutomatedRemediation}
                  variant="outline"
                  size="sm"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Auto-Remediate
                </Button>
                
                <Button
                  onClick={() => {
                    const monitor = SpotifyHealthMonitorService.getInstance();
                    monitor.clearAcknowledgedAlerts();
                  }}
                  variant="outline"
                  size="sm"
                >
                  Clear Alerts
                </Button>
              </div>
            </TabsContent>

            {/* Health Tab */}
            <TabsContent value="health" className="space-y-4">
              {healthMetrics ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Connection Health</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Status:</span>
                        <Badge variant={healthMetrics.connectionStatus === 'healthy' ? 'default' : 'destructive'}>
                          {healthMetrics.connectionStatus}
                        </Badge>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Uptime:</span>
                        <span className="text-sm font-medium">{healthMetrics.uptime.toFixed(1)}%</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Response Time:</span>
                        <span className="text-sm font-medium">
                          {healthMetrics.responseTime ? `${healthMetrics.responseTime}ms` : 'N/A'}
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Failures:</span>
                        <span className="text-sm font-medium">{healthMetrics.consecutiveFailures}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Token Health</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Status:</span>
                        <Badge variant={healthMetrics.tokenHealth === 'valid' ? 'default' : 'destructive'}>
                          {healthMetrics.tokenHealth}
                        </Badge>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Last Refresh:</span>
                        <span className="text-sm font-medium">
                          {healthMetrics.lastSuccessfulRefresh 
                            ? new Date(healthMetrics.lastSuccessfulRefresh).toLocaleString()
                            : 'Never'
                          }
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Health monitoring data not available</p>
                </div>
              )}
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-4">
              {securityValidation ? (
                <div className="space-y-4">
                  {/* Security Issues */}
                  {securityValidation.issues.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Security Issues</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {securityValidation.issues.map((issue: any, index: number) => (
                            <Alert key={index} variant={issue.severity === 'critical' ? 'destructive' : 'default'}>
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription>
                                <div className="space-y-1">
                                  <p className="font-medium">{issue.description}</p>
                                  <p className="text-sm text-muted-foreground">{issue.remediation}</p>
                                </div>
                              </AlertDescription>
                            </Alert>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Security Recommendations */}
                  {securityValidation.recommendations.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Recommendations</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {securityValidation.recommendations.map((rec: string, index: number) => (
                            <li key={index} className="text-sm flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {/* Security Metrics */}
                  {showDetailedMetrics && securityMetrics && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Security Metrics</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center gap-2">
                            <Lock className="h-4 w-4" />
                            <span className="text-sm">Encryption: </span>
                            <Badge variant={securityMetrics.encryptionCompliance ? 'default' : 'destructive'}>
                              {securityMetrics.encryptionCompliance ? 'Compliant' : 'Non-compliant'}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            <span className="text-sm">Access Audit: </span>
                            <Badge variant={securityMetrics.accessAuditPassed ? 'default' : 'destructive'}>
                              {securityMetrics.accessAuditPassed ? 'Passed' : 'Failed'}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Security validation data not available</p>
                </div>
              )}
            </TabsContent>

            {/* Alerts Tab */}
            <TabsContent value="alerts" className="space-y-4">
              {alerts.length > 0 ? (
                <div className="space-y-3">
                  {alerts.filter((alert: any) => !alert.acknowledged).map((alert: any) => (
                    <Alert key={alert.id} variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <p className="font-medium">{alert.message}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(alert.timestamp).toLocaleString()}
                            </p>
                          </div>
                          <Button
                            onClick={() => acknowledgeAlert(alert.id)}
                            size="sm"
                            variant="ghost"
                          >
                            Acknowledge
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-muted-foreground">No active alerts</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default SpotifySecurityDashboard;