import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MoreHorizontal, ChevronUp, ChevronDown, Filter, X, Edit, Trash2, FileCheck, AlertCircle } from 'lucide-react';
import { TrackFilters, FilterConfig, FilterState, FilterOptions, FilterCallbacks } from '@/components/common/TrackFilters';
import { SUPER_GENRES } from '@/types/genreMapping';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/NewAuthContext';
import { withQueryTimeout } from '@/utils/supabaseQuery';

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

interface LocalTracksTableProps {
  onTrackSelect: (track: LocalTrack) => void;
  selectedTrack: LocalTrack | null;
  refreshTrigger?: number;
  isActive?: boolean; // For lazy loading - only fetch when tab is active
}

const LocalTracksTable = ({ onTrackSelect, selectedTrack, refreshTrigger, isActive = true }: LocalTracksTableProps) => {
  const [tracks, setTracks] = useState<LocalTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTracks, setTotalTracks] = useState(0);
  const [sortField, setSortField] = useState<'last_modified' | 'year' | 'artist' | 'title' | 'album' | 'genre' | 'bitrate' | 'file_size'>('last_modified');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [yearFrom, setYearFrom] = useState<string>('');
  const [yearTo, setYearTo] = useState<string>('');
  const [selectedSuperGenre, setSelectedSuperGenre] = useState<string>('');
  const [selectedArtist, setSelectedArtist] = useState<string>('');
  const [selectedAlbum, setSelectedAlbum] = useState<string>('');
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [fileFormat, setFileFormat] = useState<string>('');
  const [fileSizeFilter, setFileSizeFilter] = useState<string>('');
  const [missingMetadata, setMissingMetadata] = useState<string>('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  // Filter options - cascading
  const [allArtists, setAllArtists] = useState<string[]>([]); // All artists for reset
  const [allGenres, setAllGenres] = useState<string[]>([]); // All genres for reset
  const [artists, setArtists] = useState<string[]>([]); // Filtered by supergenre + genre
  const [genres, setGenres] = useState<string[]>([]); // Filtered by supergenre
  const [albums, setAlbums] = useState<string[]>([]);
  const [fileFormats, setFileFormats] = useState<string[]>([]);
  
  // Query deduplication ref
  const fetchInProgress = useRef(false);
  const hasInitiallyLoaded = useRef(false);
  
  const tracksPerPage = 100;
  const { toast } = useToast();
  const { user, isAuthenticated, loading: authLoading, initialDataReady } = useAuth();

  // Main data fetching effect - consolidated with debounce for text inputs
  useEffect(() => {
    // Guard: Wait for auth to be ready AND tab to be active
    if (authLoading || !initialDataReady || !isActive) return;

    if (!isAuthenticated || !user) {
      setTracks([]);
      setTotalTracks(0);
      setLoading(false);
      return;
    }

    // For text-based filters, use debounce
    const needsDebounce = searchQuery || yearFrom || yearTo;
    const timeoutId = needsDebounce
      ? setTimeout(() => fetchTracks(user.id), 300)
      : null;

    // For non-text filters, fetch immediately
    if (!needsDebounce) {
      fetchTracks(user.id);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [authLoading, initialDataReady, isActive, isAuthenticated, user?.id, currentPage, sortField, sortDirection, selectedSuperGenre, selectedArtist, selectedAlbum, selectedGenre, fileFormat, fileSizeFilter, missingMetadata, refreshTrigger, searchQuery, yearFrom, yearTo]);

  // Filter options fetch - only once when tab becomes active
  useEffect(() => {
    if (authLoading || !initialDataReady || !isActive || !isAuthenticated || !user) return;
    if (hasInitiallyLoaded.current) return; // Only fetch once
    
    hasInitiallyLoaded.current = true;
    fetchFilterOptions(user.id);
  }, [authLoading, initialDataReady, isActive, isAuthenticated, user?.id]);

  // Re-fetch filter options when refreshTrigger changes (after scan)
  useEffect(() => {
    if (!refreshTrigger || !isActive || !user) return;
    fetchFilterOptions(user.id);
  }, [refreshTrigger]);

  // Cascade: Supergenre → Genre filtering
  // Note: Local tracks don't have super_genre column, so this filters genres that 
  // are conceptually related to the supergenre (for future use when mapping is added)
  // For now, supergenre filter is a no-op on actual data but prepares the UI
  
  // Cascade: Genre → Artist filtering  
  useEffect(() => {
    if (!user || !isAuthenticated || !initialDataReady) return;

    const fetchFilteredArtists = async () => {
      try {
        let query = supabase
          .from('local_mp3s')
          .select('artist')
          .eq('user_id', user.id);

        // Apply genre filter if selected
        if (selectedGenre) {
          query = query.eq('genre', selectedGenre);
        }

        const { data } = await query;

        if (data) {
          const filteredArtists = [...new Set(data.map(item => item.artist).filter(Boolean))].sort();
          setArtists(filteredArtists as string[]);
        }
      } catch (error) {
        console.error('Error fetching filtered artists:', error);
      }
    };

    if (selectedGenre) {
      fetchFilteredArtists();
    } else {
      // Reset to all artists when no genre is selected
      setArtists(allArtists);
    }
  }, [selectedGenre, allArtists, user?.id, isAuthenticated, initialDataReady]);

  const fetchTracks = async (userId: string) => {
    if (!userId) {
      setTracks([]);
      setTotalTracks(0);
      setLoading(false);
      return;
    }

    // Prevent duplicate concurrent fetches
    if (fetchInProgress.current) {
      console.log('🔄 LocalTracksTable: Fetch already in progress, skipping');
      return;
    }
    
    fetchInProgress.current = true;
    setLoading(true);

    // Build filter function for reuse
    const applyFilters = (query: any) => {
      if (searchQuery.trim()) {
        query = query.or(`title.ilike.%${searchQuery}%,artist.ilike.%${searchQuery}%,album.ilike.%${searchQuery}%,file_path.ilike.%${searchQuery}%`);
      }
      if (yearFrom) query = query.gte('year', parseInt(yearFrom));
      if (yearTo) query = query.lte('year', parseInt(yearTo));
      if (selectedArtist) query = query.eq('artist', selectedArtist);
      if (selectedAlbum) query = query.eq('album', selectedAlbum);
      if (selectedGenre) query = query.eq('genre', selectedGenre);
      if (fileFormat) query = query.like('file_path', `%.${fileFormat}`);
      if (fileSizeFilter === 'small') query = query.lt('file_size', 5 * 1024 * 1024);
      else if (fileSizeFilter === 'medium') query = query.gte('file_size', 5 * 1024 * 1024).lt('file_size', 20 * 1024 * 1024);
      else if (fileSizeFilter === 'large') query = query.gte('file_size', 20 * 1024 * 1024);
      if (missingMetadata === 'title') query = query.is('title', null);
      else if (missingMetadata === 'artist') query = query.is('artist', null);
      else if (missingMetadata === 'album') query = query.is('album', null);
      else if (missingMetadata === 'year') query = query.is('year', null);
      else if (missingMetadata === 'genre') query = query.is('genre', null);
      else if (missingMetadata === 'any') query = query.or('title.is.null,artist.is.null,album.is.null,year.is.null,genre.is.null');
      return query;
    };

    // Count query with timeout
    const countResult = await withQueryTimeout(
      async (signal) => {
        let query = supabase
          .from('local_mp3s')
          .select('*', { count: 'exact' })
          .eq('user_id', userId);
        query = applyFilters(query);
        query = query.range(0, 0);
        return query.abortSignal(signal);
      },
      15000,
      'LocalTracksTable:count'
    );

    if (countResult.error) {
      if (countResult.timedOut) {
        toast({
          title: "Query Timeout",
          description: "The request took too long. Please try again.",
          variant: "destructive",
        });
      }
      setLoading(false);
      fetchInProgress.current = false;
      return;
    }

    setTotalTracks(countResult.data?.count || 0);

    // Data query with timeout
    const dataResult = await withQueryTimeout(
      async (signal) => {
        let query = supabase
          .from('local_mp3s')
          .select('*')
          .eq('user_id', userId);
        query = applyFilters(query);
        return query
          .order(sortField, { ascending: sortDirection === 'asc' })
          .range((currentPage - 1) * tracksPerPage, currentPage * tracksPerPage - 1)
          .abortSignal(signal);
      },
      15000,
      'LocalTracksTable:data'
    );

    if (dataResult.error) {
      if (dataResult.timedOut) {
        toast({
          title: "Query Timeout",
          description: "The request took too long. Please try again.",
          variant: "destructive",
        });
      }
      setLoading(false);
      fetchInProgress.current = false;
      return;
    }

    setTracks(dataResult.data?.data || []);
    setLoading(false);
    fetchInProgress.current = false;
  };

  const fetchFilterOptions = async (userId: string) => {
    try {
      console.log('🔄 Fetching filter options...');
      
      if (!userId) return;
      
      // Use database functions to efficiently get distinct values
      const [genresResult, artistsResult, albumsResult] = await Promise.all([
        supabase.rpc('get_distinct_local_genres', { user_uuid: userId }),
        supabase.rpc('get_distinct_local_artists', { user_uuid: userId }),
        supabase.rpc('get_distinct_local_albums', { user_uuid: userId })
      ]);

      console.log('📊 RPC results:', {
        genres: genresResult,
        artists: artistsResult,
        albums: albumsResult
      });
      
      // Extract the genre strings from the returned objects
      const uniqueGenres = (genresResult.data || []).map((row: any) => row.genre).filter(Boolean).sort();
      const uniqueArtists = (artistsResult.data || []).map((row: any) => row.artist).filter(Boolean).sort();
      const uniqueAlbums = (albumsResult.data || []).map((row: any) => row.album).filter(Boolean).sort();
      
      // Get file formats from a limited query
      const { data: formatsData } = await supabase
        .from('local_mp3s')
        .select('file_path')
        .eq('user_id', user.id)
        .limit(1000);
        
      const uniqueFormats = [...new Set((formatsData || []).map(item => {
        const ext = item.file_path.split('.').pop()?.toLowerCase();
        return ext;
      }).filter(Boolean))].sort();
      
      console.log('🗂️ Filter options loaded:', {
        artists: uniqueArtists.length,
        albums: uniqueAlbums.length,
        genres: uniqueGenres.length,
        formats: uniqueFormats.length
      });
      
      console.log('🎵 Unique genres found:', uniqueGenres);
      
      setAllArtists(uniqueArtists); // Store all artists for reset
      setAllGenres(uniqueGenres); // Store all genres for reset
      setArtists(uniqueArtists); // Initially show all artists
      setAlbums(uniqueAlbums);
      setGenres(uniqueGenres); // Initially show all genres
      setFileFormats(uniqueFormats);
    } catch (error) {
      console.error('💥 Error fetching filter options:', error);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const getFileFormat = (filePath: string) => {
    return filePath.split('.').pop()?.toUpperCase() || 'Unknown';
  };

  const getMissingMetadataCount = (track: LocalTrack) => {
    const fields = [track.title, track.artist, track.album, track.year, track.genre];
    return fields.filter(field => !field).length;
  };

  const clearFilters = () => {
    setSearchQuery('');
    setYearFrom('');
    setYearTo('');
    setSelectedSuperGenre('');
    setSelectedArtist('');
    setSelectedAlbum('');
    setSelectedGenre('');
    setFileFormat('');
    setFileSizeFilter('');
    setMissingMetadata('');
    setCurrentPage(1);
    // Reset cascading filters
    setGenres(allGenres);
    setArtists(allArtists);
  };

  const handleSort = (field: 'year' | 'artist' | 'last_modified' | 'title' | 'album' | 'genre' | 'bitrate' | 'file_size') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const handleSelectTrack = (trackId: string) => {
    const newSelection = new Set(selectedTracks);
    if (newSelection.has(trackId)) {
      newSelection.delete(trackId);
    } else {
      newSelection.add(trackId);
    }
    setSelectedTracks(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedTracks.size === tracks.length) {
      setSelectedTracks(new Set());
    } else {
      setSelectedTracks(new Set(tracks.map(t => t.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTracks.size === 0) return;
    
    try {
      const { error } = await supabase
        .from('local_mp3s')
        .delete()
        .in('id', Array.from(selectedTracks));
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: `Deleted ${selectedTracks.size} tracks`,
      });
      
      setSelectedTracks(new Set());
      if (user) {
        fetchTracks(user.id);
      }
    } catch (error) {
      console.error('Error deleting tracks:', error);
      toast({
        title: "Error",
        description: "Failed to delete tracks",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading local tracks...</div>
        </CardContent>
      </Card>
    );
  }

  const totalPages = Math.ceil(totalTracks / tracksPerPage);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Local Library ({totalTracks} tracks)</span>
          {selectedTracks.size > 0 && (
            <div className="flex gap-2">
              <Badge variant="secondary">{selectedTracks.size} selected</Badge>
              <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                <Trash2 className="h-4 w-4 mr-1" />
                Delete Selected
              </Button>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Common Filters */}
        <TrackFilters
          config={{
            search: true,
            dateFilters: false,
            superGenre: true,
            genre: true,
            artist: true,
            superGenreLabel: "All Supergenres",
            genreLabel: "All Genres"
          }}
          state={{
            searchQuery,
            selectedGenre,
            selectedSuperGenre,
            selectedArtist,
            dateFilter: '',
            noSuperGenre: false
          }}
          options={{
            genres,
            superGenres: [...SUPER_GENRES].sort(),
            artists
          }}
          callbacks={{
            onSearchChange: setSearchQuery,
            onGenreChange: (value) => {
              setSelectedGenre(value);
              setSelectedArtist(''); // Clear artist when genre changes
            },
            onSuperGenreChange: (value) => {
              setSelectedSuperGenre(value);
              setSelectedGenre(''); // Clear genre when supergenre changes
              setSelectedArtist(''); // Clear artist when supergenre changes
            },
            onArtistChange: setSelectedArtist,
            onDateFilterChange: () => {},
            onNoSuperGenreChange: () => {},
            onClearFilters: () => {
              setSearchQuery('');
              setSelectedSuperGenre('');
              setSelectedGenre('');
              setSelectedArtist('');
              setGenres(allGenres);
              setArtists(allArtists);
            },
            onPageChange: setCurrentPage
          }}
          className="mb-4"
        />

        {/* Local Track Filters */}
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Advanced Filters
                {filtersOpen ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
              </Button>
            </CollapsibleTrigger>
            {(yearFrom || yearTo || selectedAlbum || fileFormat || fileSizeFilter || missingMetadata) && (
              <Button variant="ghost" size="sm" onClick={() => {
                setYearFrom('');
                setYearTo('');
                setSelectedAlbum('');
                setFileFormat('');
                setFileSizeFilter('');
                setMissingMetadata('');
                setCurrentPage(1);
              }}>
                <X className="h-4 w-4 mr-1" />
                Clear Advanced
              </Button>
            )}
            {(searchQuery || yearFrom || yearTo || selectedArtist || selectedAlbum || selectedGenre || fileFormat || fileSizeFilter || missingMetadata) && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
          </div>
          
          <CollapsibleContent className="space-y-4">
            {/* Advanced Filters Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Year Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Year Range</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="From"
                    type="number"
                    value={yearFrom}
                    onChange={(e) => setYearFrom(e.target.value)}
                    min="1900"
                    max="2024"
                  />
                  <Input
                    placeholder="To"
                    type="number"
                    value={yearTo}
                    onChange={(e) => setYearTo(e.target.value)}
                    min="1900"
                    max="2024"
                  />
                </div>
              </div>
              
              {/* Album Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Album</label>
                <Select value={selectedAlbum || 'all'} onValueChange={(value) => setSelectedAlbum(value === 'all' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All albums" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All albums</SelectItem>
                    {albums.slice(0, 50).map((album) => (
                      <SelectItem key={album} value={album}>
                        {album}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* File Format Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">File Format</label>
                <Select value={fileFormat || 'all'} onValueChange={(value) => setFileFormat(value === 'all' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All formats" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All formats</SelectItem>
                    {fileFormats.map((format) => (
                      <SelectItem key={format} value={format}>
                        .{format.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* File Size Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">File Size</label>
                <Select value={fileSizeFilter || 'all'} onValueChange={(value) => setFileSizeFilter(value === 'all' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All sizes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sizes</SelectItem>
                    <SelectItem value="small">Small (&lt; 5MB)</SelectItem>
                    <SelectItem value="medium">Medium (5-20MB)</SelectItem>
                    <SelectItem value="large">Large (&gt; 20MB)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Missing Metadata Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Missing Metadata</label>
                <Select value={missingMetadata || 'all'} onValueChange={(value) => setMissingMetadata(value === 'all' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All tracks" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tracks</SelectItem>
                    <SelectItem value="any">Missing any metadata</SelectItem>
                    <SelectItem value="title">Missing title</SelectItem>
                    <SelectItem value="artist">Missing artist</SelectItem>
                    <SelectItem value="album">Missing album</SelectItem>
                    <SelectItem value="year">Missing year</SelectItem>
                    <SelectItem value="genre">Missing genre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectedTracks.size === tracks.length && tracks.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead
                  className="w-[250px] cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center gap-1">
                    Track
                    {sortField === 'title' && (
                      sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('artist')}
                >
                  <div className="flex items-center gap-1">
                    Artist
                    {sortField === 'artist' && (
                      sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </TableHead>
                <TableHead>Mix</TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('album')}
                >
                  <div className="flex items-center gap-1">
                    Album
                    {sortField === 'album' && (
                      sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('genre')}
                >
                  <div className="flex items-center gap-1">
                    Genre
                    {sortField === 'genre' && (
                      sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('year')}
                >
                  <div className="flex items-center gap-1">
                    Year
                    {sortField === 'year' && (
                      sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </TableHead>
                <TableHead>BPM</TableHead>
                <TableHead>Format</TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('bitrate')}
                >
                  <div className="flex items-center gap-1">
                    Bitrate
                    {sortField === 'bitrate' && (
                      sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('file_size')}
                >
                  <div className="flex items-center gap-1">
                    Size
                    {sortField === 'file_size' && (
                      sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tracks.map((track) => (
                <TableRow 
                  key={track.id} 
                  className={`cursor-pointer ${selectedTrack?.id === track.id ? 'bg-muted' : ''}`}
                  onClick={() => onTrackSelect(track)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedTracks.has(track.id)}
                      onCheckedChange={() => handleSelectTrack(track.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="max-w-[230px] truncate" title={track.title || track.file_path}>
                      {track.title || <span className="text-muted-foreground">No title</span>}
                    </div>
                    <div className="text-[10px] text-muted-foreground/40 max-w-[230px] truncate mt-0.5" title={track.file_path}>
                      {track.file_path.split('/').pop()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[150px] truncate" title={track.artist || 'Unknown'}>
                      {track.artist || <span className="text-muted-foreground">Unknown</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {track.mix || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[150px] truncate" title={track.album || 'Unknown'}>
                      {track.album || <span className="text-muted-foreground">Unknown</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {track.genre || <span className="text-muted-foreground">Unknown</span>}
                  </TableCell>
                   <TableCell>
                     {track.year || <span className="text-muted-foreground">—</span>}
                   </TableCell>
                   <TableCell>
                     {track.bpm ? (
                       <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                         {track.bpm} BPM
                       </Badge>
                     ) : (
                       <span className="text-muted-foreground">—</span>
                     )}
                   </TableCell>
                   <TableCell>
                     <Badge variant="outline">
                       {getFileFormat(track.file_path)}
                     </Badge>
                   </TableCell>
                   <TableCell>
                      {track.bitrate ? (
                        <span className="text-sm">{track.bitrate}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                   </TableCell>
                   <TableCell>
                     {formatFileSize(track.file_size)}
                   </TableCell>
                  <TableCell>
                    {getMissingMetadataCount(track) === 0 ? (
                      <Badge variant="default" className="bg-green-500/10 text-green-400 border-green-500/30">
                        <FileCheck className="h-3 w-3 mr-1" />
                        Complete
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/30">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {getMissingMetadataCount(track)} missing
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Metadata
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove from Library
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {tracks.length === 0 && !loading && (
          <div className="text-center py-8 text-muted-foreground">
            No local tracks found. Scan your local library to see tracks here.
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                
                {(() => {
                  const maxVisiblePages = 5;
                  const startPage = Math.max(1, Math.min(currentPage - Math.floor(maxVisiblePages / 2), totalPages - maxVisiblePages + 1));
                  const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                  
                  return Array.from({ length: endPage - startPage + 1 }, (_, i) => {
                    const page = startPage + i;
                    return (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => setCurrentPage(page)}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  });
                })()}
                
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LocalTracksTable;
