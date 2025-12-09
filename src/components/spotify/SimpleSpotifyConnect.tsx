import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Music, ExternalLink, Shield, CheckCircle } from 'lucide-react';
import { useUnifiedSpotifyAuth } from '@/hooks/useUnifiedSpotifyAuth';
import { cn } from '@/lib/utils';

interface SimpleSpotifyConnectProps {
  className?: string;
}

export const SimpleSpotifyConnect = ({ className }: SimpleSpotifyConnectProps) => {
  const { connectSpotify, isConnecting } = useUnifiedSpotifyAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleConnect = async () => {
    setIsRedirecting(true);
    
    try {
      // This will trigger immediate redirect to Spotify
      await connectSpotify();
    } catch (error) {
      console.error('Connection failed:', error);
      setIsRedirecting(false);
    }
  };

  return (
    <Card className={cn('w-full max-w-lg', className)}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/10 rounded-lg">
            <Music className="h-6 w-6 text-green-500" />
          </div>
          <div>
            <CardTitle>Connect to Spotify</CardTitle>
            <CardDescription>
              Link your Spotify account to sync your music library
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Permissions Info */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">What we'll access:</h4>
          <div className="grid grid-cols-1 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Your profile and saved tracks</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Your playlists and listening history</span>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
          <Shield className="h-4 w-4 text-blue-500 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Secure Connection</p>
            <p className="text-muted-foreground">
              Your credentials are never stored. We only receive encrypted access tokens.
            </p>
          </div>
        </div>

        {/* Connect Button */}
        <Button
          onClick={handleConnect}
          disabled={isConnecting || isRedirecting}
          className="w-full"
          size="lg"
        >
          {isRedirecting ? (
            <>
              <ExternalLink className="h-4 w-4 mr-2" />
              Redirecting to Spotify...
            </>
          ) : (
            <>
              <Music className="h-4 w-4 mr-2" />
              Connect to Spotify
              <ExternalLink className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          You'll be redirected to Spotify to authorize the connection
        </p>
      </CardContent>
    </Card>
  );
};

export default SimpleSpotifyConnect;