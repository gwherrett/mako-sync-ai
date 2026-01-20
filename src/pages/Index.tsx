import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings, Database, Shuffle, Search, X } from 'lucide-react';
import LibraryHeader from '@/components/LibraryHeader';
import { StatsOverview } from '@/components/StatsOverview';
import SetupChecklist from '@/components/SetupChecklist';
import TracksTable from '@/components/TracksTable';
import LocalTracksTable from '@/components/LocalTracksTable';
import FileUploadScanner from '@/components/FileUploadScanner';
import SpotifySyncButton from '@/components/SpotifySyncButton';
import SyncAnalysis from '@/components/SyncAnalysis';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SUPER_GENRES } from '@/types/genreMapping';

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
  mix: string | null;
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
  mix: string | null;
}

// Shared filter state interface
export interface SharedFilterState {
  searchQuery: string;
  selectedSuperGenre: string;
}

const Index = () => {
  const [selectedTrack, setSelectedTrack] = useState<SpotifyTrack | null>(null);
  const [selectedLocalTrack, setSelectedLocalTrack] = useState<LocalTrack | null>(null);
  const [isDashboardCollapsed, setIsDashboardCollapsed] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState('local');

  // Shared filter state - persists across tabs
  const [sharedSearchQuery, setSharedSearchQuery] = useState('');
  const [sharedSuperGenre, setSharedSuperGenre] = useState('');

  const hasSharedFilters = sharedSearchQuery || sharedSuperGenre;

  const clearSharedFilters = () => {
    setSharedSearchQuery('');
    setSharedSuperGenre('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-expos-dark via-expos-dark-elevated to-black">
      <LibraryHeader 
        isDashboardCollapsed={isDashboardCollapsed}
        onToggleDashboard={() => setIsDashboardCollapsed(!isDashboardCollapsed)}
      />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Collapsible Dashboard Section */}
        {!isDashboardCollapsed && (
          <div className="mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
              {/* Stats Cards - Left Column */}
              <div className="lg:col-span-4">
                <StatsOverview />
              </div>
              
              {/* Setup Checklist - Right Column */}
              <div className="lg:col-span-8">
                <SetupChecklist />
              </div>
            </div>
          </div>
        )}
        
        {/* Shared Filter Bar */}
        <div className="mb-6 p-4 bg-expos-dark-elevated/30 rounded-lg border border-expos-blue/20">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tracks or artists…"
                value={sharedSearchQuery}
                onChange={(e) => setSharedSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>

            {/* Supergenre Filter */}
            <div className="flex-1 max-w-xs">
              <Select
                value={sharedSuperGenre || 'all'}
                onValueChange={(value) => setSharedSuperGenre(value === 'all' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Supergenres" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Supergenres</SelectItem>
                  {[...SUPER_GENRES].sort().map((genre) => (
                    <SelectItem key={genre} value={genre}>
                      {genre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters Button */}
            {hasSharedFilters && (
              <Button variant="ghost" size="sm" onClick={clearSharedFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="local">
              <Database className="w-4 h-4 mr-2" />
              Local
            </TabsTrigger>
            <TabsTrigger value="spotify">
              <svg viewBox="0 0 24 24" className="w-4 h-4 mr-2" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              Spotify
            </TabsTrigger>
            <TabsTrigger value="sync">
              <Shuffle className="w-4 h-4 mr-2" />
              Matching
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sync">
            <SyncAnalysis
              sharedSearchQuery={sharedSearchQuery}
              sharedSuperGenre={sharedSuperGenre}
            />
          </TabsContent>
          
          <TabsContent value="spotify" className="space-y-8">
            <SpotifySyncButton />
            <TracksTable
              onTrackSelect={setSelectedTrack}
              selectedTrack={selectedTrack}
              sharedSearchQuery={sharedSearchQuery}
              sharedSuperGenre={sharedSuperGenre}
            />
            {selectedTrack && (
              <div className="bg-expos-dark-elevated/30 rounded-lg border border-expos-blue/20 p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Track Details</h3>
                <div className="p-4 bg-expos-dark-elevated/50 rounded-lg border border-expos-blue/10">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold text-white text-lg">{selectedTrack.title}</h4>
                      <p className="text-gray-300">{selectedTrack.artist} • {selectedTrack.album || 'Unknown Album'}</p>
                      {selectedTrack.genre && (
                        <p className="text-purple-400 text-sm">{selectedTrack.genre}</p>
                      )}
                    </div>
                    <button 
                      className="text-expos-blue hover:text-expos-blue/80 transition-colors"
                      onClick={() => {
                        window.open(
                          `https://open.spotify.com/track/${selectedTrack.spotify_id}`, 
                          'spotify-track'
                        );
                      }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div>
                      <span className="text-xs text-gray-400 block">BPM</span>
                      <span className="text-sm text-expos-blue font-semibold">
                        {selectedTrack.bpm ? Math.round(selectedTrack.bpm) : 'Unknown'}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Key</span>
                      <span className="text-sm text-expos-blue font-semibold">
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
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-expos-blue/10 text-expos-blue border border-expos-blue/30">
                        Danceability: {(selectedTrack.danceability * 100).toFixed(0)}%
                      </span>
                    )}
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-expos-red/10 text-expos-red border border-expos-red/30">
                      Spotify Track
                    </span>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="local" className="space-y-8">
            <FileUploadScanner onScanComplete={() => setRefreshTrigger(prev => prev + 1)} />
            <LocalTracksTable
              onTrackSelect={setSelectedLocalTrack}
              selectedTrack={selectedLocalTrack}
              refreshTrigger={refreshTrigger}
              isActive={activeTab === 'local'}
              sharedSearchQuery={sharedSearchQuery}
              sharedSuperGenre={sharedSuperGenre}
            />
            {selectedLocalTrack && (
              <div className="bg-expos-dark-elevated/30 rounded-lg border border-expos-blue/20 p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Local Track Details</h3>
                <div className="p-4 bg-expos-dark-elevated/50 rounded-lg border border-expos-blue/10">
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
                       <span className="text-sm text-expos-blue font-semibold">
                         {selectedLocalTrack.bpm || 'Unknown'}
                       </span>
                     </div>
                     <div>
                       <span className="text-xs text-gray-400 block">Key</span>
                       <span className="text-sm text-expos-blue font-semibold">
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
                       <span className="text-sm text-expos-blue font-semibold">
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
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-expos-red/10 text-expos-red border border-expos-red/30">
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