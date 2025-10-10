import React, { useState, useEffect } from 'react';
import { ExternalLink, ChevronUp, ChevronDown } from 'lucide-react';
import { TrackFilters, FilterConfig, FilterState, FilterOptions, FilterCallbacks } from '@/components/common/TrackFilters';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
import { IframeBanner } from '@/components/common/IframeBanner';
import { openInNewTab, copyToClipboard } from '@/utils/linkUtils';
import { useGenreMappingOverrides } from '@/hooks/useGenreMappingOverrides';

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
  remixer: string | null;
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
  const [selectedSuperGenre, setSelectedSuperGenre] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [noSuperGenre, setNoSuperGenre] = useState<boolean>(false);
  const [noGenre, setNoGenre] = useState<boolean>(false);
  
  // Filter options
  const [artists, setArtists] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [superGenres, setSuperGenres] = useState<string[]>([]);

  const tracksPerPage = 50;
  const { toast } = useToast();
  const { hasOverride } = useGenreMappingOverrides();

  useEffect(() => {
    fetchTracks();
  }, [currentPage, sortField, sortDirection, selectedArtist, selectedGenre, selectedSuperGenre, dateFilter, noSuperGenre, noGenre]);

  // Separate useEffect for filter options that updates when genre changes
  useEffect(() => {
    fetchFilterOptions();
  }, [selectedGenre, selectedSuperGenre]);

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
      
      // Apply "No Genre" filter
      if (noGenre) {
        query = query.is('genre', null);
      }
      
      // Apply "No Super Genre" filter
      if (noSuperGenre) {
        query = query.is('super_genre', null);
      }
      
      // Apply super genre filter
      if (selectedSuperGenre) {
        query = query.eq('super_genre', selectedSuperGenre as any);
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

      // Get total count with filters (clone query to avoid mutation issues)
      let countQuery = supabase.from('spotify_liked').select('*', { count: 'exact', head: true });
      
      // Apply the same filters for count query
      if (searchQuery.trim()) {
        countQuery = countQuery.or(`title.ilike.%${searchQuery}%,artist.ilike.%${searchQuery}%`);
      }
      if (selectedGenre) {
        countQuery = countQuery.eq('genre', selectedGenre);
      }
      if (noGenre) {
        countQuery = countQuery.is('genre', null);
      }
      if (noSuperGenre) {
        countQuery = countQuery.is('super_genre', null);
      }
      if (selectedSuperGenre) {
        countQuery = countQuery.eq('super_genre', selectedSuperGenre as any);
      }
      if (selectedArtist) {
        countQuery = countQuery.eq('artist', selectedArtist);
      }
      if (dateFilter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        countQuery = countQuery.gte('added_at', weekAgo.toISOString());
      } else if (dateFilter === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        countQuery = countQuery.gte('added_at', monthAgo.toISOString());
      }
      
      const { count } = await countQuery;
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
      // Get unique artists filtered by genre and super genre if selected
      let artistQuery = supabase
        .from('spotify_liked')
        .select('artist')
        .not('artist', 'is', null);
      
      if (selectedGenre) {
        artistQuery = artistQuery.eq('genre', selectedGenre);
      }
      
      if (noSuperGenre) {
        artistQuery = artistQuery.is('super_genre', null);
      } else if (selectedSuperGenre) {
        artistQuery = artistQuery.eq('super_genre', selectedSuperGenre as any);
      }
      
      const { data: artistData } = await artistQuery;
      
      if (artistData) {
        const uniqueArtists = [...new Set(artistData.map(item => item.artist))].sort();
        setArtists(uniqueArtists);
      }

      // Get unique genres filtered by super genre if selected
      let genreQuery = supabase
        .from('spotify_liked')
        .select('genre')
        .not('genre', 'is', null);

      if (noSuperGenre) {
        genreQuery = genreQuery.is('super_genre', null);
      } else if (selectedSuperGenre) {
        genreQuery = genreQuery.eq('super_genre', selectedSuperGenre as any);
      }
      
      const { data: genreData } = await genreQuery;
      
      if (genreData) {
        const uniqueGenres = [...new Set(genreData.map(item => item.genre))].sort();
        setGenres(uniqueGenres);
      }

      // Get unique super genres (not filtered)
      const { data: superGenreData } = await supabase
        .from('spotify_liked')
        .select('super_genre')
        .not('super_genre', 'is', null);
      
      if (superGenreData) {
        const uniqueSuperGenres = [...new Set(superGenreData.map(item => item.super_genre))].sort();
        setSuperGenres(uniqueSuperGenres);
      }

    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedArtist('');
    setSelectedGenre('');
    setSelectedSuperGenre('');
    setDateFilter('');
    setNoSuperGenre(false);
    setNoGenre(false);
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

  const handleSpotifyClick = async (e: React.MouseEvent<HTMLAnchorElement>, spotifyId: string) => {
    e.stopPropagation();
    
    const url = `https://open.spotify.com/track/${spotifyId}`;
    
    // Handle Ctrl/Cmd+Click - let browser handle it naturally
    if (e.ctrlKey || e.metaKey) {
      return; // Don't preventDefault, let the browser handle it
    }
    
    // Prevent default link behavior for our custom handling
    e.preventDefault();
    
    // Dev-only logging
    if (process.env.NODE_ENV === 'development') {
      console.log('Opening Spotify track:', spotifyId);
    }
    
    // Use our robust link opener
    await openInNewTab({ url });
  };

  const handleCopySpotifyLink = async (spotifyId: string) => {
    const url = `https://open.spotify.com/track/${spotifyId}`;
    const success = await copyToClipboard(url);
    
    if (success) {
      toast({
        title: "Link Copied",
        description: "Spotify link copied to clipboard!",
      });
    }
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
        <IframeBanner />
        
        {/* Filters Panel */}
        <TrackFilters
          config={{
            search: true,
            dateFilters: true,
            genre: true,
            superGenre: true,
            artist: true
          }}
          state={{
            searchQuery,
            selectedGenre,
            selectedSuperGenre,
            selectedArtist,
            dateFilter,
            noSuperGenre,
            noGenre
          }}
          options={{
            genres,
            superGenres,
            artists
          }}
          callbacks={{
            onSearchChange: setSearchQuery,
            onGenreChange: (value) => {
              setSelectedGenre(value);
              setSelectedArtist(''); // Clear artist filter when genre changes
            },
            onSuperGenreChange: (value) => {
              setSelectedSuperGenre(value);
              setSelectedGenre(''); // Clear genre filter when super genre changes
              setSelectedArtist(''); // Clear artist filter when super genre changes
            },
            onArtistChange: setSelectedArtist,
            onDateFilterChange: setDateFilter,
            onNoSuperGenreChange: setNoSuperGenre,
            onNoGenreChange: setNoGenre,
            onClearFilters: clearFilters,
            onPageChange: setCurrentPage
          }}
          className="mb-4"
        />
        
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
                  <TableHead>Common Genre</TableHead>
                  <TableHead>Spotify Genre</TableHead>
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
                  <TableHead>Remixer</TableHead>
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
                      {track.super_genre ? (
                        <Badge variant="default" className="bg-blue-500/10 text-blue-400 border-blue-500/30">{track.super_genre}</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-500/10 text-gray-400 border-gray-500/30">Unmapped</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {track.genre ? (
                          <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 border-purple-500/30">{track.genre}</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-500/10 text-gray-400 border-gray-500/30">No Genre</Badge>
                        )}
                        {track.genre && hasOverride(track.genre) && (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-xs">
                            Overridden
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {track.year || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {track.remixer || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {track.spotify_id ? (
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            asChild
                          >
                            <a
                              href={`https://open.spotify.com/track/${track.spotify_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => handleSpotifyClick(e, track.spotify_id)}
                              title="Open in Spotify (Ctrl+Click for new tab)"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopySpotifyLink(track.spotify_id)}
                            title="Copy Spotify link"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                              <path d="M4 16c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h8c1.1 0 2 .9 2 2"/>
                            </svg>
                          </Button>
                        </div>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              disabled
                              onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>No Spotify link available</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
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