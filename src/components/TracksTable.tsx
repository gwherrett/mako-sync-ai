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
  genre: string | null;
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
  const [selectedArtist, setSelectedArtist] = useState<string>('');
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  
  // Filter options
  const [artists, setArtists] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);

  const tracksPerPage = 50;
  const { toast } = useToast();

  useEffect(() => {
    fetchTracks();
    fetchFilterOptions();
  }, [currentPage, sortField, sortDirection, selectedArtist, selectedGenre, dateFilter]);

  // Separate useEffect for search with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchTracks();
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);


  const fetchTracks = async () => {
    try {
      setLoading(true);
      
      // Build query with filters
      let query = supabase.from('spotify_liked').select('*', { count: 'exact' });
      
      // Apply search filter
      if (searchQuery.trim()) {
        query = query.or(`title.ilike.%${searchQuery}%,artist.ilike.%${searchQuery}%`);
      }

      // Apply genre filter
      if (selectedGenre) {
        query = query.eq('genre', selectedGenre);
      }
      
      // Apply artist filter
      if (selectedArtist) {
        query = query.eq('artist', selectedArtist);
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

      // Get unique genres
      const { data: genreData } = await supabase
        .from('spotify_liked')
        .select('genre')
        .not('genre', 'is', null);
      
      if (genreData) {
        const uniqueGenres = [...new Set(genreData.map(item => item.genre))].sort();
        setGenres(uniqueGenres);
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
    setSelectedArtist('');
    setSelectedGenre('');
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
        <div className="mb-4 space-y-4">
          {/* Top Row: Search Bar + Date Filters */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tracks or artists…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>

            {/* Date Filters */}
            <div className="flex gap-2">
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
          </div>
          
          {/* Bottom Row: Genre + Artist Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Genre Filter */}
            <div className="flex-1 max-w-xs">
              <Select
                value={selectedGenre}
                onValueChange={(value) => {
                  setSelectedGenre(value === 'all' ? '' : value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All genres" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All genres</SelectItem>
                  {genres.slice(0, 50).map((genre) => (
                    <SelectItem key={genre} value={genre}>
                      {genre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Artist Filter */}
            <div className="flex-1 max-w-xs">
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
          </div>

          {/* Clear Filters Button */}
          {(searchQuery || selectedArtist || selectedGenre || dateFilter) && (
            <div className="flex justify-start">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear Filters
              </Button>
            </div>
          )}
        </div>
        
        {tracks.length > 0 ? (
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
                  <TableHead>Genre</TableHead>
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
                      {track.genre ? (
                        <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 border-purple-500/30">{track.genre}</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-500/10 text-gray-400 border-gray-500/30">No Genre</Badge>
                      )}
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
        ) : (
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

export default TracksTable;