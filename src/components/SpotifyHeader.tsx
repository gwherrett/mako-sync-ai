
import React from 'react';
import { Settings, Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BrandLogo from '@/components/BrandLogo';
import { useSpotifyAuth } from '@/hooks/useSpotifyAuth';
import { useAuth } from '@/contexts/NewAuthContext';

const SpotifyHeader = () => {
  const { isConnected, isLoading, isSyncing, connectSpotify, syncLikedSongs } = useSpotifyAuth();
  const { user, signOut } = useAuth();

  return (
    <header className="bg-spotify-dark border-b border-white/10 p-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <BrandLogo size={40} />
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
            <Button 
              onClick={() => syncLikedSongs(false)}
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
