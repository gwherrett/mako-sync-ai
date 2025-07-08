
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
          {selectedTrack && (
            <div className="bg-serato-dark/20 rounded-lg border border-serato-cyan/20 p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Track Details</h3>
              <div className="p-4 bg-serato-dark/30 rounded-lg border border-serato-cyan/10">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-white text-lg">{selectedTrack.title}</h4>
                    <p className="text-gray-300">{selectedTrack.artist} • {selectedTrack.album || 'Unknown Album'}</p>
                  </div>
                  <button 
                    className="text-serato-cyan hover:text-serato-cyan/80 transition-colors"
                    onClick={() => window.open(`https://open.spotify.com/track/${selectedTrack.spotify_id}`, '_blank')}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                  <div>
                    <span className="text-xs text-gray-400 block">BPM</span>
                    <span className="text-sm text-serato-cyan font-semibold">
                      {selectedTrack.bpm ? Math.round(selectedTrack.bpm) : 'Unknown'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Key</span>
                    <span className="text-sm text-serato-cyan font-semibold">
                      {selectedTrack.key ? (() => {
                        const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
                        const keyNum = parseInt(selectedTrack.key);
                        return keys[keyNum] || 'Unknown';
                      })() : 'Unknown'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Year</span>
                    <span className="text-sm text-white">{selectedTrack.year || 'Unknown'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Added</span>
                    <span className="text-sm text-white">
                      {selectedTrack.added_at ? new Date(selectedTrack.added_at).toLocaleDateString() : 'Unknown'}
                    </span>
                  </div>
                </div>

                <div className="flex space-x-2">
                  {selectedTrack.danceability && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-serato-cyan/10 text-serato-cyan border border-serato-cyan/30">
                      Danceability: {(selectedTrack.danceability * 100).toFixed(0)}%
                    </span>
                  )}
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-serato-orange/10 text-serato-orange border border-serato-orange/30">
                    Spotify Track
                  </span>
                </div>
              </div>
            </div>
          )}
          <MetadataExtractor selectedTrack={selectedTrack} />
        </div>
      </main>
    </div>
  );
};

export default Index;
