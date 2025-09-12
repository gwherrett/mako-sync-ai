import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import LibraryHeader from '@/components/LibraryHeader';
import StatsOverview from '@/components/StatsOverview';
import { SetupChecklist } from '@/components/SetupChecklist';
import MetadataExtractor from '@/components/MetadataExtractor';
import TracksTable from '@/components/TracksTable';
import LocalTracksTable from '@/components/LocalTracksTable';
import SpotifySyncButton from '@/components/SpotifySyncButton';
import LocalScanButton from '@/components/LocalScanButton';
import FileUploadScanner from '@/components/FileUploadScanner';
import SyncAnalysis from '@/components/SyncAnalysis';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  genre: string | null;
  super_genre: string | null;
  bpm: number | null;
  key: string | null;
  danceability: number | null;
  year: number | null;
  added_at: string | null;
  spotify_id: string;
}

interface LocalTrack {
  id: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  genre: string | null;
  year: number | null;
  bpm: number | null;
  key: string | null;
  bitrate: number | null;
  file_path: string;
  file_size: number | null;
  last_modified: string | null;
  created_at: string | null;
  hash: string | null;
  rating: number | null;
  play_count: number | null;
}

const Index = () => {
  const [selectedTrack, setSelectedTrack] = useState<SpotifyTrack | null>(null);
  const [selectedLocalTrack, setSelectedLocalTrack] = useState<LocalTrack | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-serato-dark via-serato-dark-elevated to-black">
      <LibraryHeader />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <SetupChecklist />
        </div>
        
        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-3xl font-bold text-white mb-2">Spotify - Local Collection Dashboard</h2>
            <p className="text-gray-400">
              Use Spotify metadata to find matches with local library
            </p>
          </div>
        </div>
        
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="sync">Sync Analysis</TabsTrigger>
            <TabsTrigger value="spotify" className="flex items-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              Spotify Library
            </TabsTrigger>
            <TabsTrigger value="local" className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              Local Library
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <StatsOverview />
          </TabsContent>

          <TabsContent value="sync">
            <SyncAnalysis />
          </TabsContent>
          
          <TabsContent value="spotify" className="space-y-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-white">Spotify Liked Songs</h3>
              <SpotifySyncButton />
            </div>
            <TracksTable onTrackSelect={setSelectedTrack} selectedTrack={selectedTrack} />
            {selectedTrack && (
              <div className="bg-serato-dark/20 rounded-lg border border-serato-cyan/20 p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Track Details</h3>
                <div className="p-4 bg-serato-dark/30 rounded-lg border border-serato-cyan/10">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold text-white text-lg">{selectedTrack.title}</h4>
                      <p className="text-gray-300">{selectedTrack.artist} • {selectedTrack.album || 'Unknown Album'}</p>
                      {selectedTrack.genre && (
                        <p className="text-purple-400 text-sm">{selectedTrack.genre}</p>
                      )}
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
          </TabsContent>

          <TabsContent value="local" className="space-y-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-white">Local Library</h3>
              <LocalScanButton />
            </div>
            <FileUploadScanner />
            <LocalTracksTable onTrackSelect={setSelectedLocalTrack} selectedTrack={selectedLocalTrack} />
            {selectedLocalTrack && (
              <div className="bg-serato-dark/20 rounded-lg border border-serato-cyan/20 p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Local Track Details</h3>
                <div className="p-4 bg-serato-dark/30 rounded-lg border border-serato-cyan/10">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold text-white text-lg">
                        {selectedLocalTrack.title || selectedLocalTrack.file_path.split('/').pop()}
                      </h4>
                      <p className="text-gray-300">
                        {selectedLocalTrack.artist || 'Unknown Artist'} • {selectedLocalTrack.album || 'Unknown Album'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1" title={selectedLocalTrack.file_path}>
                        {selectedLocalTrack.file_path}
                      </p>
                    </div>
                  </div>
                  
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                     <div>
                       <span className="text-xs text-gray-400 block">BPM</span>
                       <span className="text-sm text-serato-cyan font-semibold">
                         {selectedLocalTrack.bpm || 'Unknown'}
                       </span>
                     </div>
                     <div>
                       <span className="text-xs text-gray-400 block">Key</span>
                       <span className="text-sm text-serato-cyan font-semibold">
                         {selectedLocalTrack.key || 'Unknown'}
                       </span>
                     </div>
                     <div>
                       <span className="text-xs text-gray-400 block">Bitrate</span>
                       <span className="text-sm text-white">
                         {selectedLocalTrack.bitrate || 'Unknown'}
                       </span>
                     </div>
                     <div>
                       <span className="text-xs text-gray-400 block">Genre</span>
                       <span className="text-sm text-serato-cyan font-semibold">
                         {selectedLocalTrack.genre || 'Unknown'}
                       </span>
                     </div>
                   </div>
                   
                   <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-3">
                     <div>
                       <span className="text-xs text-gray-400 block">Year</span>
                       <span className="text-sm text-white">{selectedLocalTrack.year || 'Unknown'}</span>
                     </div>
                     <div>
                       <span className="text-xs text-gray-400 block">File Size</span>
                       <span className="text-sm text-white">
                         {selectedLocalTrack.file_size ? 
                           `${(selectedLocalTrack.file_size / (1024 * 1024)).toFixed(1)} MB` : 'Unknown'}
                       </span>
                     </div>
                     <div>
                       <span className="text-xs text-gray-400 block">Last Modified</span>
                       <span className="text-sm text-white">
                         {selectedLocalTrack.last_modified ? 
                           new Date(selectedLocalTrack.last_modified).toLocaleDateString() : 'Unknown'}
                       </span>
                     </div>
                   </div>

                  <div className="flex space-x-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-serato-orange/10 text-serato-orange border border-serato-orange/30">
                      Local File
                    </span>
                    {selectedLocalTrack.hash && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30">
                        Hashed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;