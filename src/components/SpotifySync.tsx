
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Music, RefreshCw, ExternalLink } from 'lucide-react';
import { useSpotifyAuth } from '@/hooks/useSpotifyAuth';

const SpotifySync = () => {
  const { 
    isConnected, 
    isLoading, 
    isSyncing, 
    connection, 
    syncLikedSongs, 
    connectSpotify 
  } = useSpotifyAuth();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Music className="w-5 h-5 text-green-500" />
            <CardTitle>Spotify Integration</CardTitle>
          </div>
          <CardDescription>Loading connection status...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Music className="w-5 h-5 text-green-500" />
          <CardTitle>Spotify Integration</CardTitle>
        </div>
        <CardDescription>
          {isConnected 
            ? `Connected as ${connection?.display_name || connection?.email || 'Spotify User'}`
            : 'Connect your Spotify account to sync your liked songs'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected ? (
          <Button 
            onClick={connectSpotify}
            className="w-full bg-green-500 hover:bg-green-600 text-white"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Connect Spotify Account
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-gray-600">
              <p>✅ Spotify account connected</p>
              {connection?.updated_at && (
                <p className="text-xs mt-1">
                  Last updated: {new Date(connection.updated_at).toLocaleString()}
                </p>
              )}
            </div>
            <Button 
              onClick={syncLikedSongs}
              disabled={isSyncing}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Syncing Liked Songs...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sync Liked Songs
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SpotifySync;
