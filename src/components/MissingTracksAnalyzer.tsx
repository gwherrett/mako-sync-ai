import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, Music, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TrackMatchingService } from '@/services/trackMatching.service';
import { supabase } from '@/integrations/supabase/client';

interface MissingTrack {
  spotifyTrack: {
    id: string;
    title: string;
    artist: string;
    album: string | null;
    genre: string | null;
    super_genre: string | null;
  };
  reason: string;
}

interface ArtistGroup {
  artist: string;
  tracks: MissingTrack[];
  genres: string[];
}

const MissingTracksAnalyzer = () => {
  const [missingTracks, setMissingTracks] = useState<MissingTrack[]>([]);
  const [artistGroups, setArtistGroups] = useState<ArtistGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const { toast } = useToast();

  // Get user on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  // Group tracks by artist
  const groupByArtist = (tracks: MissingTrack[]): ArtistGroup[] => {
    const groups = tracks.reduce((acc, track) => {
      const artist = track.spotifyTrack.artist;
      if (!acc[artist]) {
        acc[artist] = {
          artist,
          tracks: [],
          genres: new Set<string>()
        };
      }
      acc[artist].tracks.push(track);
      if (track.spotifyTrack.genre) {
        acc[artist].genres.add(track.spotifyTrack.genre);
      }
      if (track.spotifyTrack.super_genre) {
        acc[artist].genres.add(track.spotifyTrack.super_genre);
      }
      return acc;
    }, {} as Record<string, { artist: string; tracks: MissingTrack[]; genres: Set<string> }>);

    return Object.values(groups)
      .map(group => ({
        ...group,
        genres: Array.from(group.genres)
      }))
      .sort((a, b) => b.tracks.length - a.tracks.length);
  };

  const analyzeMissingTracks = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to analyze missing tracks.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔍 Starting missing tracks analysis...');
      const missing = await TrackMatchingService.findMissingTracks(user.id);
      
      setMissingTracks(missing);
      setArtistGroups(groupByArtist(missing));

      toast({
        title: "Analysis Complete",
        description: `Found ${missing.length} tracks missing from your local collection.`,
      });

      console.log(`✅ Analysis complete: ${missing.length} missing tracks found`);
    } catch (error: any) {
      console.error('❌ Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze missing tracks.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const exportToCSV = () => {
    if (missingTracks.length === 0) return;

    const csvContent = [
      ['Artist', 'Title', 'Album', 'Genre', 'Super Genre'].join(','),
      ...missingTracks.map(track => [
        `"${track.spotifyTrack.artist}"`,
        `"${track.spotifyTrack.title}"`,
        `"${track.spotifyTrack.album || ''}"`,
        `"${track.spotifyTrack.genre || ''}"`,
        `"${track.spotifyTrack.super_genre || ''}"`,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `missing-tracks-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            Missing Tracks Analysis
          </CardTitle>
          <CardDescription>
            Find tracks in your Spotify collection that are missing from your local files.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button 
              onClick={analyzeMissingTracks}
              disabled={isLoading}
              className="bg-primary hover:bg-primary/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                'Analyze Missing Tracks'
              )}
            </Button>
            
            {missingTracks.length > 0 && (
              <Button 
                onClick={exportToCSV}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {missingTracks.length > 0 && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Missing Tracks</p>
                    <p className="text-2xl font-bold text-primary">{missingTracks.length}</p>
                  </div>
                  <Music className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Artists</p>
                    <p className="text-2xl font-bold text-primary">{artistGroups.length}</p>
                  </div>
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Top Artist</p>
                    <p className="text-lg font-semibold text-primary truncate">
                      {artistGroups[0]?.artist || 'N/A'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {artistGroups[0]?.tracks.length || 0} tracks
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Artist Groups */}
          <Card>
            <CardHeader>
              <CardTitle>Missing Tracks by Artist</CardTitle>
              <CardDescription>
                Artists with tracks missing from your local collection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {artistGroups.map((group) => (
                  <div 
                    key={group.artist} 
                    className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-lg">{group.artist}</h3>
                      <Badge variant="secondary">
                        {group.tracks.length} track{group.tracks.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    
                    {/* Genres */}
                    {group.genres.length > 0 && (
                      <div className="flex gap-1 mb-2 flex-wrap">
                        {group.genres.map((genre) => (
                          <Badge key={genre} variant="outline" className="text-xs">
                            {genre}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Track List */}
                    <div className="space-y-1">
                      {group.tracks.map((track, idx) => (
                        <div key={idx} className="text-sm text-muted-foreground">
                          <span className="font-medium">{track.spotifyTrack.title}</span>
                          {track.spotifyTrack.album && (
                            <span className="ml-2">• {track.spotifyTrack.album}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty State */}
      {!isLoading && missingTracks.length === 0 && user && (
        <Card>
          <CardContent className="text-center py-8">
            <Music className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Analysis Yet</h3>
            <p className="text-muted-foreground mb-4">
              Click "Analyze Missing Tracks" to find gaps in your local collection.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MissingTracksAnalyzer;