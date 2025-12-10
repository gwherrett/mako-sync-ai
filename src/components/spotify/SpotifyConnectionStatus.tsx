import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Music,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
  Wifi,
  WifiOff,
  Shield,
  Key,
  Calendar,
  Activity
} from 'lucide-react';
import { useUnifiedSpotifyAuth } from '@/hooks/useUnifiedSpotifyAuth';
import { cn } from '@/lib/utils';
import type { SpotifyConnection } from '@/types/spotify';

interface SpotifyConnectionStatusProps {
  className?: string;
  showDetailedInfo?: boolean;
  onConnectionChange?: (isConnected: boolean) => void;
}

export const SpotifyConnectionStatus = ({
  className,
  showDetailedInfo = true,
  onConnectionChange
}: SpotifyConnectionStatusProps) => {
  const {
    connection,
    isConnected,
    isLoading,
    connectSpotify,
    disconnectSpotify,
    refreshConnection,
    isRefreshing,
    isSyncing
  } = useUnifiedSpotifyAuth();

  // Calculate token health from connection data
  const getTokenHealth = () => {
    if (!connection) return { status: 'error', expiresIn: 0 };
    
    const now = new Date();
    const expiresAt = new Date(connection.expires_at);
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();
    const minutesUntilExpiry = Math.max(0, Math.floor(timeUntilExpiry / (1000 * 60)));
    
    if (timeUntilExpiry <= 0) return { status: 'expired', expiresIn: 0 };
    if (minutesUntilExpiry <= 30) return { status: 'warning', expiresIn: minutesUntilExpiry };
    return { status: 'healthy', expiresIn: minutesUntilExpiry };
  };

  const tokenHealth = getTokenHealth();
  const isHealthy = tokenHealth.status === 'healthy';
  const isWarning = tokenHealth.status === 'warning';
  const isExpired = tokenHealth.status === 'expired';
  const hasError = tokenHealth.status === 'error';
  const needsRefresh = isWarning || isExpired;

  const getTimeUntilExpiry = () => {
    if (!connection || tokenHealth.expiresIn <= 0) return 'Expired';
    
    const minutes = tokenHealth.expiresIn;
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours < 24) {
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
    
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days} day${days !== 1 ? 's' : ''}`;
  };

  const timeUntilExpiry = getTimeUntilExpiry();
  const healthMessage = isConnected
    ? (isHealthy ? 'Connection is healthy' : `Expires in ${timeUntilExpiry}`)
    : 'Not connected to Spotify';

  // Notify parent of connection changes
  useEffect(() => {
    onConnectionChange?.(isConnected);
  }, [isConnected, onConnectionChange]);

  const getConnectionStatusInfo = () => {
    if (!isConnected || !connection) {
      return {
        status: 'disconnected',
        color: 'destructive',
        icon: XCircle,
        message: 'Not connected to Spotify'
      };
    }

    if (isExpired) {
      return {
        status: 'expired',
        color: 'destructive',
        icon: XCircle,
        message: 'Connection expired'
      };
    }

    if (isWarning) {
      return {
        status: 'warning',
        color: 'secondary',
        icon: AlertTriangle,
        message: `Expires in ${timeUntilExpiry}`
      };
    }

    if (hasError) {
      return {
        status: 'error',
        color: 'destructive',
        icon: XCircle,
        message: 'Connection error'
      };
    }

    return {
      status: 'connected',
      color: 'default',
      icon: CheckCircle,
      message: healthMessage
    };
  };

  const statusInfo = getConnectionStatusInfo();
  const StatusIcon = statusInfo.icon;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTokenExpiryProgress = () => {
    if (!connection) return 0;
    
    const now = new Date();
    const createdAt = new Date(connection.created_at);
    const expiresAt = new Date(connection.expires_at);
    
    const totalDuration = expiresAt.getTime() - createdAt.getTime();
    const elapsed = now.getTime() - createdAt.getTime();
    
    return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
  };

  if (isLoading) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Checking Spotify connection...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Music className="h-6 w-6 text-green-500" />
              <div className={cn(
                'absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-background',
                isConnected ? 'bg-green-500' : 'bg-red-500'
              )} />
            </div>
            <div>
              <CardTitle className="text-lg">Spotify Connection</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <StatusIcon className={cn(
                  'h-4 w-4',
                  statusInfo.color === 'destructive' && 'text-red-500',
                  statusInfo.color === 'secondary' && 'text-yellow-500',
                  statusInfo.color === 'default' && 'text-green-500'
                )} />
                {statusInfo.message}
              </CardDescription>
            </div>
          </div>
          
          <Badge variant={statusInfo.color as any} className="capitalize">
            {statusInfo.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Connection Actions */}
        <div className="flex gap-2">
          {!isConnected ? (
            <Button 
              onClick={connectSpotify}
              className="flex-1"
              disabled={isSyncing}
            >
              <Music className="h-4 w-4 mr-2" />
              Connect Spotify
            </Button>
          ) : (
            <>
              <Button
                onClick={refreshConnection}
                variant="outline"
                size="sm"
                disabled={isRefreshing || isSyncing}
              >
                <RefreshCw className={cn('h-4 w-4 mr-2', (isRefreshing || isSyncing) && 'animate-spin')} />
                Refresh
              </Button>
              <Button
                onClick={disconnectSpotify}
                variant="destructive"
                size="sm"
                disabled={isSyncing}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            </>
          )}
        </div>

        {/* Detailed Connection Info */}
        {showDetailedInfo && isConnected && connection && (
          <div className="space-y-4">
            {/* Token Expiry Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Token Status</span>
                <span className="text-xs text-muted-foreground">
                  Expires: {formatDate(connection.expires_at)}
                </span>
              </div>
              <Progress
                value={getTokenExpiryProgress()}
                className={cn(
                  'h-2',
                  hasError && 'bg-red-100',
                  isWarning && 'bg-yellow-100'
                )}
              />
            </div>

            {/* Connection Details */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  <span>Security</span>
                </div>
                <div className="pl-6">
                  <div className="flex items-center gap-1">
                    <Key className="h-3 w-3 text-green-500" />
                    <span className="text-xs">Encrypted tokens</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Connected</span>
                </div>
                <div className="pl-6">
                  <span className="text-xs">{formatDate(connection.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Last Update Info */}
            {connection.updated_at && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Activity className="h-3 w-3" />
                <span>Last updated: {formatDate(connection.updated_at)}</span>
              </div>
            )}

            {/* Health Warnings */}
            {isWarning && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Your Spotify connection will expire soon. Consider refreshing your tokens.
                </AlertDescription>
              </Alert>
            )}

            {(isExpired || hasError) && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  {isExpired
                    ? "Your Spotify connection has expired. Please refresh your tokens or reconnect."
                    : "There's an issue with your Spotify connection. Please try reconnecting."
                  }
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Offline Warning */}
        {!navigator.onLine && (
          <Alert>
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

export default SpotifyConnectionStatus;