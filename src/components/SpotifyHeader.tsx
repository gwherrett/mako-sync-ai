
import React from 'react';
import { Music2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SpotifyHeader = () => {
  return (
    <header className="bg-spotify-dark border-b border-white/10 p-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
            <Music2 className="w-6 h-6 text-black" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Spotify Metadata Sync</h1>
            <p className="text-sm text-gray-400">Extract & sync your liked songs for Serato</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button variant="outline" size="sm" className="text-white border-white/20 hover:bg-white/10">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
          <Button className="spotify-gradient text-black font-medium hover:opacity-90 transition-opacity">
            Connect Spotify
          </Button>
        </div>
      </div>
    </header>
  );
};

export default SpotifyHeader;
