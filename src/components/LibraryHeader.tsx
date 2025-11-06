import React from 'react';
import { LogOut, Loader2 } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/NewAuthContext';
import { useSpotifyAuth } from '@/hooks/useSpotifyAuth';

const LibraryHeader = () => {
  const { user, signOut } = useAuth();
  const { isConnected, isLoading, connection, connectSpotify } = useSpotifyAuth();

  return (
    <header className="bg-spotify-dark border-b border-white/10 p-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <BrandLogo size={40} />
          <div>
            <h1 className="text-xl font-bold text-white">Mako Sync</h1>
            <p className="text-sm text-gray-400">
              Manage your Spotify and local music collections
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Spotify Connection Status */}
          {isLoading ? (
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Checking Spotify...</span>
            </div>
          ) : isConnected ? (
            <div className="text-sm text-green-400">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Spotify: {connection?.display_name || 'Connected'}</span>
              </div>
            </div>
          ) : (
            <Button 
              onClick={connectSpotify}
              className="spotify-gradient text-black font-medium hover:opacity-90 transition-opacity"
              size="sm"
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

export default LibraryHeader;