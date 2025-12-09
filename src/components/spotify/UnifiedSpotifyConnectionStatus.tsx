import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Music,
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Shield,
  Activity,
  Clock,
  Zap
} from 'lucide-react';
import { useUnifiedSpotifyAuth } from '@/hooks/useUnifiedSpotifyAuth';
import { cn } from '@/lib/utils';
import type { SpotifyConnection } from '@/types/spotify';

interface UnifiedSpotifyConnectionStatusProps {
  className?: string;
  showAdvancedControls?: boolean;
  onConnectionChange?: (isConnected: boolean, connection: SpotifyConnection | null) => void;
}

export const UnifiedSpotifyConnectionStatus: React.FC<UnifiedSpotifyConnectionStatusProps> = ({
  className,
  showAdvancedControls = false,
  onConnectionChange
}) => {
  const {
    isConnected,
    isLoading,
    connection,
    error,
    healthStatus,
    isConnecting,
    isDisconnecting,
    isSyncing,
    isRefreshing,
    connectSpotify,
    disconnectSpotify,
    refreshTokens,
    syncLikedSongs,
    performHealthCheck,
    validateSecurity,
    retryLastOperation,
    clearError
  } = useUnifiedSpotifyAuth({
    onConnectionChange,
    autoRefresh: true,
    healthMonitoring: true,
    securityValidation: true
  });

  // Calculate connection quality score
  const getConnectionQuality = () => {
    if (!isConnected) return 0;
    
    let score = 50; // Base score for being connected
    
    switch (healthStatus) {
      case 'healthy':
        score += 50;
        break;
      case 'warning':
        score += 25;
        break;
      case 'error':
        score += 10;
        break;
      default:
        score += 0;
    }
    
    return Math.min(100, score);
  };

  // Get status display info
  const getStatusInfo = () => {
    if (isLoading) {
      return {
        icon: RefreshCw,
        color: 'text-blue-500',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        message: 'Checking connection...',
        badge: 'Checking'
      };
    }

    if (error) {
      return {
        icon: XCircle,
        color: 'text-red-500',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        message: error,
        badge: 'Error'
      };
    }

    if (!isConnected) {
      return {
        icon: WifiOff,
        color: 'text-gray-500',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
        message: 'Not connected to Spotify',
        badge: 'Disconnected'
      };
    }

    switch (healthStatus) {
      case 'healthy':
        return {
          icon: CheckCircle,
          color: 'text-green-500',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          message: 'Connected and healthy',
          badge: 'Healthy'
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          message: 'Connected with warnings',
          badge: 'Warning'
        };
      case 'error':
        return {
          icon: XCircle,
          color: 'text-red-500',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          message: 'Connected but unhealthy',
          badge: 'Unhealthy'
        };
      default:
        return {
          icon: Wifi,
          color: 'text-blue-500',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          message: 'Connected',
          badge: 'Connected'
        };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;
  const connectionQuality = getConnectionQuality();

  // Format connection details
  const formatConnectionDetails = () => {
    if (!connection) return null;

    const expiresAt = new Date(connection.expires_at);
    const now = new Date();
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();
    const hoursUntilExpiry = Math.floor(timeUntilExpiry / (1000 * 60 * 60));
    const minutesUntilExpiry = Math.floor((timeUntilExpiry % (1000 * 60 * 60)) / (1000 * 60));

    return {
      displayName: connection.display_name || 'Unknown User',
      email: connection.email,
      expiresIn: timeUntilExpiry > 0 ? 
        `${hoursUntilExpiry}h ${minutesUntilExpiry}m` : 
        'Expired',
      isExpired: timeUntilExpiry <= 0,
      isExpiringSoon: timeUntilExpiry > 0 && timeUntilExpiry < 30 * 60 * 1000 // 30 minutes
    };
  };

  const connectionDetails = formatConnectionDetails();

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", statusInfo.bgColor)}>
              <Music className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <CardTitle className="text-lg">Spotify Connection</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <StatusIcon className={cn("h-4 w-4", statusInfo.color)} />
                {statusInfo.message}
              </CardDescription>
            </div>
          </div>
          <Badge 
            variant={
              statusInfo.badge === 'Healthy' ? 'default' :
              statusInfo.badge === 'Warning' ? 'secondary' :
              statusInfo.badge === 'Error' || statusInfo.badge === 'Unhealthy' ? 'destructive' :
              'outline'
            }
          >
            {statusInfo.badge}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Connection Quality */}
        {isConnected && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Connection Quality</span>
              <span className="font-medium">{connectionQuality}%</span>
            </div>
            <Progress value={connectionQuality} className="h-2" />
          </div>
        )}

        {/* Connection Details */}
        {connectionDetails && (
          <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Account</span>
              <span className="text-sm">{connectionDetails.displayName}</span>
            </div>
            {connectionDetails.email && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Email</span>
                <span className="text-sm text-muted-foreground">{connectionDetails.email}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Token Expires</span>
              <span className={cn(
                "text-sm",
                connectionDetails.isExpired ? "text-red-500" :
                connectionDetails.isExpiringSoon ? "text-yellow-500" :
                "text-muted-foreground"
              )}>
                {connectionDetails.expiresIn}
              </span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={retryLastOperation}
                className="ml-2"
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          {!isConnected ? (
            <Button
              onClick={connectSpotify}
              disabled={isConnecting || isLoading}
              className="w-full"
            >
              {isConnecting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Music className="h-4 w-4 mr-2" />
                  Connect Spotify
                </>
              )}
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => syncLikedSongs(false)}
                disabled={isSyncing || isLoading}
                variant="default"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Sync
                  </>
                )}
              </Button>
              <Button
                onClick={refreshTokens}
                disabled={isRefreshing || isLoading}
                variant="outline"
              >
                {isRefreshing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Advanced Controls */}
          {showAdvancedControls && isConnected && (
            <div className="grid grid-cols-3 gap-2 pt-2 border-t">
              <Button
                onClick={performHealthCheck}
                variant="outline"
                size="sm"
              >
                <Activity className="h-4 w-4 mr-1" />
                Health
              </Button>
              <Button
                onClick={validateSecurity}
                variant="outline"
                size="sm"
              >
                <Shield className="h-4 w-4 mr-1" />
                Security
              </Button>
              <Button
                onClick={disconnectSpotify}
                disabled={isDisconnecting}
                variant="destructive"
                size="sm"
              >
                {isDisconnecting ? (
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <WifiOff className="h-4 w-4 mr-1" />
                )}
                Disconnect
              </Button>
            </div>
          )}

          {/* Simple Disconnect for Basic View */}
          {!showAdvancedControls && isConnected && (
            <Button
              onClick={disconnectSpotify}
              disabled={isDisconnecting}
              variant="outline"
              size="sm"
            >
              {isDisconnecting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 mr-2" />
                  Disconnect
                </>
              )}
            </Button>
          )}
        </div>

        {/* Token Expiry Warning */}
        {connectionDetails?.isExpiringSoon && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              Your Spotify tokens will expire soon. Consider refreshing them.
            </AlertDescription>
          </Alert>
        )}

        {/* Offline Warning */}
        {!navigator.onLine && (
          <Alert variant="destructive">
            <WifiOff className="h-4 w-4" />
            <AlertDescription>
              You're offline. Spotify features may be limited until connection is restored.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default UnifiedSpotifyConnectionStatus;