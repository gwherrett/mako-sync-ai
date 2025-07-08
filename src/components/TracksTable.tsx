import React, { useState, useEffect } from 'react';
import { MoreHorizontal, Play, ExternalLink, Download } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';

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

  useEffect(() => {
    fetchTracks();
  }, []);

  const fetchTracks = async () => {
    try {
      const { data, error } = await supabase
        .from('spotify_liked')
        .select('*')
        .order('added_at', { ascending: false })
        .limit(100); // Start with first 100 tracks

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

  const getKeyName = (key: string | null) => {
    if (!key) return 'Unknown';
    const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const keyNum = parseInt(key);
    return keys[keyNum] || 'Unknown';
  };

  const getDanceabilityLabel = (danceability: number | null) => {
    if (!danceability) return 'Unknown';
    if (danceability >= 0.8) return 'High';
    if (danceability >= 0.6) return 'Medium';
    if (danceability >= 0.4) return 'Low';
    return 'Very Low';
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Your Liked Songs ({tracks.length} tracks)</span>
          <Button variant="outline" size="sm" onClick={fetchTracks}>
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Track</TableHead>
                <TableHead>Artist</TableHead>
                <TableHead>Album</TableHead>
                <TableHead>BPM</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Dance</TableHead>
                <TableHead>Year</TableHead>
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
                    <div className="max-w-[200px] truncate" title={track.title}>
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
                      <Badge variant="outline">{Math.round(track.bpm)}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {track.key ? (
                      <Badge variant="secondary">{getKeyName(track.key)}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {track.danceability ? (
                      <Badge 
                        variant={
                          track.danceability >= 0.8 ? "default" :
                          track.danceability >= 0.6 ? "secondary" : "outline"
                        }
                      >
                        {getDanceabilityLabel(track.danceability)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
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
        
        {tracks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No tracks found. Sync your liked songs to see them here.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TracksTable;