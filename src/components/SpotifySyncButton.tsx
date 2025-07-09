import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSpotifyAuth } from '@/hooks/useSpotifyAuth';

const SpotifySyncButton = () => {
  const { isConnected, isLoading, isSyncing, connectSpotify, syncLikedSongs } = useSpotifyAuth();

  if (isLoading) {
    return (
      <Button disabled className="spotify-gradient text-black font-medium">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Checking...
      </Button>
    );
  }

  if (!isConnected) {
    return (
      <Button 
        onClick={connectSpotify}
        className="spotify-gradient text-black font-medium hover:opacity-90 transition-opacity"
      >
        Connect Spotify
      </Button>
    );
  }

  return (
    <Button 
      onClick={syncLikedSongs}
      disabled={isSyncing}
      className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-2 transition-colors shadow-lg"
    >
      {isSyncing ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Syncing...
        </>
      ) : (
        'Sync Liked Songs'
      )}
    </Button>
  );
};

export default SpotifySyncButton;