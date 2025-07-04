
import React from 'react';
import SpotifyHeader from '@/components/SpotifyHeader';
import StatsOverview from '@/components/StatsOverview';
import MetadataExtractor from '@/components/MetadataExtractor';
import SpotifySync from '@/components/SpotifySync';

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-serato-dark via-serato-dark-elevated to-black">
      <SpotifyHeader />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Spotify - MP3 Sync Dashboard</h2>
          <p className="text-gray-400">
            Extract metadata from your music library and sync with Serato DJ Pro for optimal performance
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <SpotifySync />
          <StatsOverview />
        </div>
        
        <MetadataExtractor />
      </main>
    </div>
  );
};

export default Index;
