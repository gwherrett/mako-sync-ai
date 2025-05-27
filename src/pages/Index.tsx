
import React from 'react';
import SpotifyHeader from '@/components/SpotifyHeader';
import StatsOverview from '@/components/StatsOverview';
import MetadataExtractor from '@/components/MetadataExtractor';

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-spotify-dark via-gray-900 to-black">
      <SpotifyHeader />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Dashboard</h2>
          <p className="text-gray-400">
            Extract metadata from your Spotify liked songs and sync with your MP3 collection for Serato DJ Pro
          </p>
        </div>
        
        <StatsOverview />
        <MetadataExtractor />
      </main>
    </div>
  );
};

export default Index;
