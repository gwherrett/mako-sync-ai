
import React from 'react';
import { Music2, Settings, Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSpotifyAuth } from '@/hooks/useSpotifyAuth';
import { useAuth } from '@/contexts/NewAuthContext';

const SpotifyHeader = () => {
  const { isConnected, isLoading, isSyncing, connectSpotify, disconnectSpotify, syncLikedSongs } = useSpotifyAuth();
  const { user, signOut } = useAuth();

  return (
    <header className="bg-spotify-dark border-b border-white/10 p-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
            <Music2 className="w-6 h-6 text-black" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Spotify Metadata Sync</h1>
            <p className="text-sm text-gray-400">
              {isConnected 
                ? "Connected to Spotify - Ready to sync your liked songs" 
                : "Extract & sync your liked songs for Serato"
              }
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="text-sm text-gray-400">
            Welcome, {user?.email}
          </div>
          
          <Button variant="outline" size="sm" className="text-white border-white/20 hover:bg-white/10">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
          
          {isLoading ? (
            <Button disabled className="spotify-gradient text-black font-medium">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Checking...
            </Button>
          ) : isConnected ? (
            <div className="flex items-center space-x-2">
              <Button 
                onClick={syncLikedSongs}
                disabled={isSyncing}
                className="spotify-gradient text-black font-medium hover:opacity-90 transition-opacity"
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
              <Button 
                onClick={disconnectSpotify}
                variant="outline" 
                className="text-white border-white/20 hover:bg-red-500/20 hover:border-red-500/50"
              >
                Disconnect
              </Button>
            </div>
          ) : (
            <Button 
              onClick={connectSpotify}
              className="spotify-gradient text-black font-medium hover:opacity-90 transition-opacity"
            >
              Connect Spotify
            </Button>
          )}
          
          <Button
            onClick={signOut}
            variant="outline"
            size="sm"
            className="text-white border-white/20 hover:bg-white/10"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
};

export default SpotifyHeader;
