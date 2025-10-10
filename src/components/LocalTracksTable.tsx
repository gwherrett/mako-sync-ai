import React, { useState, useEffect } from 'react';
import { MoreHorizontal, ChevronUp, ChevronDown, Filter, X, Edit, Trash2, FileCheck, AlertCircle } from 'lucide-react';
import { TrackFilters, FilterConfig, FilterState, FilterOptions, FilterCallbacks } from '@/components/common/TrackFilters';
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

interface LocalTracksTableProps {
  onTrackSelect: (track: LocalTrack) => void;
  selectedTrack: LocalTrack | null;
}

const LocalTracksTable = ({ onTrackSelect, selectedTrack }: LocalTracksTableProps) => {
  const [tracks, setTracks] = useState<LocalTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTracks, setTotalTracks] = useState(0);
  const [sortField, setSortField] = useState<'last_modified' | 'year' | 'artist'>('last_modified');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [yearFrom, setYearFrom] = useState<string>('');
  const [yearTo, setYearTo] = useState<string>('');
  const [selectedArtist, setSelectedArtist] = useState<string>('');
  const [selectedAlbum, setSelectedAlbum] = useState<string>('');
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [fileFormat, setFileFormat] = useState<string>('');
  const [fileSizeFilter, setFileSizeFilter] = useState<string>('');
  const [missingMetadata, setMissingMetadata] = useState<string>('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  // Filter options
  const [artists, setArtists] = useState<string[]>([]);
  const [albums, setAlbums] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [fileFormats, setFileFormats] = useState<string[]>([]);
  
  const tracksPerPage = 100;
  const { toast } = useToast();

  useEffect(() => {
    fetchTracks();
    fetchFilterOptions();
  }, [currentPage, sortField, sortDirection, selectedArtist, selectedAlbum, selectedGenre, fileFormat, fileSizeFilter, missingMetadata]);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchTracks();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Debounced year filters
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchTracks();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [yearFrom, yearTo]);

  const fetchTracks = async () => {
    try {
      setLoading(true);
      
      console.log('🎵 LocalTracksTable: Fetching tracks with filters:', {
        search: searchQuery,
        yearFrom,
        yearTo,
        artist: selectedArtist,
        album: selectedAlbum,
        genre: selectedGenre,
        fileFormat,
        fileSizeFilter,
        missingMetadata
      });
      
      let query = supabase.from('local_mp3s').select('*', { count: 'exact' });
      
      // Apply search filter
      if (searchQuery.trim()) {
        query = query.or(`title.ilike.%${searchQuery}%,artist.ilike.%${searchQuery}%,album.ilike.%${searchQuery}%,file_path.ilike.%${searchQuery}%`);
      }
      
      // Apply year range filter
      if (yearFrom) {
        query = query.gte('year', parseInt(yearFrom));
      }
      if (yearTo) {
        query = query.lte('year', parseInt(yearTo));
      }
      
      // Apply metadata filters
      if (selectedArtist) {
        query = query.eq('artist', selectedArtist);
      }
      if (selectedAlbum) {
        query = query.eq('album', selectedAlbum);
      }
      if (selectedGenre) {
        query = query.eq('genre', selectedGenre);
      }
      
      // Apply file format filter
      if (fileFormat) {
        query = query.like('file_path', `%.${fileFormat}`);
      }
      
      // Apply file size filter
      if (fileSizeFilter === 'small') {
        query = query.lt('file_size', 5 * 1024 * 1024); // < 5MB
      } else if (fileSizeFilter === 'medium') {
        query = query.gte('file_size', 5 * 1024 * 1024).lt('file_size', 20 * 1024 * 1024); // 5-20MB
      } else if (fileSizeFilter === 'large') {
        query = query.gte('file_size', 20 * 1024 * 1024); // > 20MB
      }
      
      // Apply missing metadata filter
      if (missingMetadata === 'title') {
        query = query.is('title', null);
      } else if (missingMetadata === 'artist') {
        query = query.is('artist', null);
      } else if (missingMetadata === 'album') {
        query = query.is('album', null);
      } else if (missingMetadata === 'year') {
        query = query.is('year', null);
      } else if (missingMetadata === 'genre') {
        query = query.is('genre', null);
      } else if (missingMetadata === 'any') {
        query = query.or('title.is.null,artist.is.null,album.is.null,year.is.null,genre.is.null');
      }

      // Get total count
      const { count } = await query;
      setTotalTracks(count || 0);

      // Get paginated tracks
      const { data, error } = await query
        .order(sortField, { ascending: sortDirection === 'asc' })
        .range((currentPage - 1) * tracksPerPage, currentPage * tracksPerPage - 1);

      if (error) {
        console.error('❌ Error fetching local tracks:', error);
        toast({
          title: "Error",
          description: "Failed to fetch local tracks",
          variant: "destructive",
        });
        return;
      }

      console.log('✅ LocalTracksTable: Fetched tracks:', data?.length || 0);
      
      // Log metadata extraction status
      if (data) {
        const metadataStats = {
          total: data.length,
          withArtist: data.filter(t => t.artist).length,
          withAlbum: data.filter(t => t.album).length,
          withGenre: data.filter(t => t.genre).length,
          withYear: data.filter(t => t.year).length,
        };
        console.log('📊 Metadata extraction stats:', metadataStats);
      }

      setTracks(data || []);
    } catch (error) {
      console.error('💥 LocalTracksTable fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      // Get unique values for filters
      const { data } = await supabase
        .from('local_mp3s')
        .select('artist, album, genre, file_path');
      
      if (data) {
        const uniqueArtists = [...new Set(data.map(item => item.artist).filter(Boolean))].sort();
        const uniqueAlbums = [...new Set(data.map(item => item.album).filter(Boolean))].sort();
        const uniqueGenres = [...new Set(data.map(item => item.genre).filter(Boolean))].sort();
        const uniqueFormats = [...new Set(data.map(item => {
          const ext = item.file_path.split('.').pop()?.toLowerCase();
          return ext;
        }).filter(Boolean))].sort();
        
        setArtists(uniqueArtists);
        setAlbums(uniqueAlbums);
        setGenres(uniqueGenres);
        setFileFormats(uniqueFormats);
        
        console.log('🗂️ Filter options loaded:', {
          artists: uniqueArtists.length,
          albums: uniqueAlbums.length,
          genres: uniqueGenres.length,
          formats: uniqueFormats.length
        });
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
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
    setSelectedArtist('');
    setSelectedAlbum('');
    setSelectedGenre('');
    setFileFormat('');
    setFileSizeFilter('');
    setMissingMetadata('');
    setCurrentPage(1);
  };

  const handleSort = (field: 'year' | 'artist' | 'last_modified') => {
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
      fetchTracks();
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
            genre: true,
            artist: true,
            genreLabel: "All Common genres"
          }}
          state={{
            searchQuery,
            selectedGenre,
            selectedSuperGenre: '', // Not used for local tracks
            selectedArtist,
            dateFilter: '',
            noSuperGenre: false
          }}
          options={{
            genres,
            superGenres: [], // Not used for local tracks
            artists
          }}
          callbacks={{
            onSearchChange: setSearchQuery,
            onGenreChange: setSelectedGenre,
            onSuperGenreChange: () => {}, // Not used for local tracks
            onArtistChange: setSelectedArtist,
            onDateFilterChange: () => {}, // Not used for local tracks
            onNoSuperGenreChange: () => {},
            onClearFilters: () => {
              setSearchQuery('');
              setSelectedGenre('');
              setSelectedArtist('');
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
                <TableHead className="w-[250px]">Track</TableHead>
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
                <TableHead>Album</TableHead>
                <TableHead>Genre</TableHead>
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
                <TableHead>Bitrate</TableHead>
                <TableHead>Size</TableHead>
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
