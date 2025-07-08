
import React, { useState } from 'react';
import SpotifyHeader from '@/components/SpotifyHeader';
import StatsOverview from '@/components/StatsOverview';
import MetadataExtractor from '@/components/MetadataExtractor';
import TracksTable from '@/components/TracksTable';

interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  bpm: number | null;
  key: string | null;
  danceability: number | null;
  year: number | null;
  added_at: string | null;
  spotify_id: string;
}

const Index = () => {
  const [selectedTrack, setSelectedTrack] = useState<SpotifyTrack | null>(null);

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
        
        <div className="space-y-8">
          <StatsOverview />
          <TracksTable onTrackSelect={setSelectedTrack} selectedTrack={selectedTrack} />
          <MetadataExtractor selectedTrack={selectedTrack} />
        </div>
      </main>
    </div>
  );
};

export default Index;
