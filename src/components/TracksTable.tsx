import React, { useState, useEffect } from 'react';
import { MoreHorizontal, Play, ExternalLink, Download, ChevronUp, ChevronDown, Search, Filter, X } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

interface TracksTableProps {
  onTrackSelect: (track: SpotifyTrack) => void;
  selectedTrack: SpotifyTrack | null;
}

const TracksTable = ({ onTrackSelect, selectedTrack }: TracksTableProps) => {
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTracks, setTotalTracks] = useState(0);
  const [sortField, setSortField] = useState<'added_at' | 'year' | 'artist'>('added_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [yearFrom, setYearFrom] = useState<string>('');
  const [yearTo, setYearTo] = useState<string>('');
  const [selectedArtist, setSelectedArtist] = useState<string>('');
  const [selectedAlbum, setSelectedAlbum] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  // Filter options
  const [artists, setArtists] = useState<string[]>([]);
  const [albums, setAlbums] = useState<string[]>([]);
  
  const tracksPerPage = 50;
  const { toast } = useToast();

  useEffect(() => {
    fetchTracks();
    fetchFilterOptions();
  }, [currentPage, sortField, sortDirection, searchQuery, yearFrom, yearTo, selectedArtist, selectedAlbum, dateFilter]);

  const fetchTracks = async () => {
    try {
      setLoading(true);
      
      // Build query with filters
      let query = supabase.from('spotify_liked').select('*', { count: 'exact' });
      
      // Apply search filter
      if (searchQuery.trim()) {
        query = query.or(`title.ilike.%${searchQuery}%,artist.ilike.%${searchQuery}%,album.ilike.%${searchQuery}%`);
      }
      
      // Apply year range filter
      if (yearFrom) {
        query = query.gte('year', parseInt(yearFrom));
      }
      if (yearTo) {
        query = query.lte('year', parseInt(yearTo));
      }
      
      // Apply artist filter
      if (selectedArtist) {
        query = query.eq('artist', selectedArtist);
      }
      
      // Apply album filter
      if (selectedAlbum) {
        query = query.eq('album', selectedAlbum);
      }
      
      // Apply date filters
      if (dateFilter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        query = query.gte('added_at', weekAgo.toISOString());
      } else if (dateFilter === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        query = query.gte('added_at', monthAgo.toISOString());
      }

      // Get total count with filters
      const { count } = await query;
      setTotalTracks(count || 0);

      // Get paginated tracks with filters
      const { data, error } = await query
        .order(sortField, { ascending: sortDirection === 'asc' })
        .range((currentPage - 1) * tracksPerPage, currentPage * tracksPerPage - 1);

      if (error) {
        console.error('Error fetching tracks:', error);
        return;
      }

      setTracks(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      // Get unique artists
      const { data: artistData } = await supabase
        .from('spotify_liked')
        .select('artist')
        .not('artist', 'is', null);
      
      if (artistData) {
        const uniqueArtists = [...new Set(artistData.map(item => item.artist))].sort();
        setArtists(uniqueArtists);
      }

      // Get unique albums
      const { data: albumData } = await supabase
        .from('spotify_liked')
        .select('album')
        .not('album', 'is', null);
      
      if (albumData) {
        const uniqueAlbums = [...new Set(albumData.map(item => item.album))].sort();
        setAlbums(uniqueAlbums);
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const getKeyName = (key: string | null) => {
    if (!key) return 'Unknown';
    const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const keyNum = parseInt(key);
    return keys[keyNum] || 'Unknown';
  };


  const clearFilters = () => {
    setSearchQuery('');
    setYearFrom('');
    setYearTo('');
    setSelectedArtist('');
    setSelectedAlbum('');
    setDateFilter('');
    setCurrentPage(1);
  };

  const handleSort = (field: 'year' | 'artist') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  };

  const openSpotifyTrack = (spotifyId: string) => {
    window.open(`https://open.spotify.com/track/${spotifyId}`, '_blank');
  };


  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading tracks...</div>
        </CardContent>
      </Card>
    );
  }

  const totalPages = Math.ceil(totalTracks / tracksPerPage);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Your Liked Songs ({totalTracks} tracks)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filters Panel */}
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {filtersOpen ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
              </Button>
            </CollapsibleTrigger>
            {(searchQuery || yearFrom || yearTo || selectedArtist || selectedAlbum || dateFilter) && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear Filters
              </Button>
            )}
          </div>
          
          <CollapsibleContent className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tracks, artists, or albums..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
              />
            </div>
            
            {/* Quick Date Filters */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={dateFilter === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setDateFilter(dateFilter === 'week' ? '' : 'week');
                  setCurrentPage(1);
                }}
              >
                Last Week
              </Button>
              <Button
                variant={dateFilter === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setDateFilter(dateFilter === 'month' ? '' : 'month');
                  setCurrentPage(1);
                }}
              >
                Last Month
              </Button>
            </div>
            
            {/* Advanced Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Year Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Year Range</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="From"
                    type="number"
                    value={yearFrom}
                    onChange={(e) => {
                      setYearFrom(e.target.value);
                      setCurrentPage(1);
                    }}
                    min="1900"
                    max="2024"
                  />
                  <Input
                    placeholder="To"
                    type="number"
                    value={yearTo}
                    onChange={(e) => {
                      setYearTo(e.target.value);
                      setCurrentPage(1);
                    }}
                    min="1900"
                    max="2024"
                  />
                </div>
              </div>
              
              {/* Artist Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Artist</label>
                <Select
                  value={selectedArtist}
                  onValueChange={(value) => {
                    setSelectedArtist(value === 'all' ? '' : value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All artists" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All artists</SelectItem>
                    {artists.slice(0, 50).map((artist) => (
                      <SelectItem key={artist} value={artist}>
                        {artist}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Album Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Album</label>
                <Select
                  value={selectedAlbum}
                  onValueChange={(value) => {
                    setSelectedAlbum(value === 'all' ? '' : value);
                    setCurrentPage(1);
                  }}
                >
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
            </div>
          </CollapsibleContent>
        </Collapsible>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Track</TableHead>
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
                <TableHead>BPM</TableHead>
                <TableHead>Key</TableHead>
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
                  <TableCell className="font-medium">
                    <div className="max-w-[280px] truncate" title={track.title}>
                      {track.title}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[150px] truncate" title={track.artist}>
                      {track.artist}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[150px] truncate" title={track.album || 'Unknown'}>
                      {track.album || 'Unknown'}
                    </div>
                  </TableCell>
                  <TableCell>
                    {track.bpm ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">{Math.round(track.bpm)}</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-gray-500/10 text-gray-400 border-gray-500/30">No BPM</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {track.key ? (
                      <Badge variant="secondary" className="bg-green-500/10 text-green-400 border-green-500/30">{getKeyName(track.key)}</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-gray-500/10 text-gray-400 border-gray-500/30">No Key</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {track.year || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openSpotifyTrack(track.spotify_id)}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open in Spotify
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Download className="mr-2 h-4 w-4" />
                          Export to Serato
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Play className="mr-2 h-4 w-4" />
                          View Details
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
            No tracks found. Sync your liked songs to see them here.
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
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = Math.max(1, Math.min(totalPages, currentPage - 2 + i));
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
                })}
                
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

export default TracksTable;