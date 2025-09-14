import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Music, Users } from 'lucide-react';
import { TrackMatchingService } from '@/services/trackMatching.service';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ArtistMatchSummaryProps {
  selectedGenre?: string;
  superGenres: string[];
}

interface LocalTrack {
  id: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  genre: string | null;
  file_path: string;
}

interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  genre: string | null;
  super_genre: string | null;
}

interface ArtistMatch {
  artistName: string;
  localTracks: LocalTrack[];
  spotifyTracks: SpotifyTrack[];
  similarity: number;
}

export function ArtistMatchSummary({ selectedGenre, superGenres }: ArtistMatchSummaryProps) {
  const [artistMatches, setArtistMatches] = useState<ArtistMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [expandedArtists, setExpandedArtists] = useState<Set<string>>(new Set());

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  const analyzeArtistMatches = async () => {
    if (!user) {
      toast.error('Please sign in to analyze tracks');
      return;
    }

    setIsLoading(true);
    try {
      const result = await TrackMatchingService.findTracksByMatchingArtist(
        user.id, 
        selectedGenre === 'all' ? undefined : selectedGenre
      );
      
      setArtistMatches(result.artistMatches);
      toast.success(`Found ${result.artistMatches.length} artists with matching tracks`);
    } catch (error) {
      console.error('Artist analysis failed:', error);
      toast.error('Failed to analyze artist matches');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleArtistExpansion = (artistName: string) => {
    setExpandedArtists(prev => {
      const newSet = new Set(prev);
      if (newSet.has(artistName)) {
        newSet.delete(artistName);
      } else {
        newSet.add(artistName);
      }
      return newSet;
    });
  };

  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 95) return 'bg-green-500';
    if (similarity >= 80) return 'bg-blue-500';
    if (similarity >= 60) return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Artist-Based Track Discovery
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Find all tracks by artists that match between your local collection and Spotify
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={analyzeArtistMatches}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Music className="h-4 w-4" />
            {isLoading ? 'Analyzing Artists...' : 'Find Artist Matches'}
          </Button>
        </div>

        {artistMatches.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                Found {artistMatches.length} matching artists
              </h3>
            </div>

            <div className="space-y-3">
              {artistMatches.map((match, index) => (
                <Card key={`${match.artistName}-${index}`} className="border-l-4" 
                      style={{ borderLeftColor: `hsl(var(--${getSimilarityColor(match.similarity).replace('bg-', '')}))` }}>
                  <Collapsible>
                    <CollapsibleTrigger 
                      className="w-full"
                      onClick={() => toggleArtistExpansion(match.artistName)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="text-left">
                              <h4 className="font-medium">{match.artistName}</h4>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>{match.localTracks.length} local tracks</span>
                                <span>•</span>
                                <span>{match.spotifyTracks.length} Spotify tracks</span>
                              </div>
                            </div>
                            <Badge variant="secondary" className={`${getSimilarityColor(match.similarity)} text-white`}>
                              {Math.round(match.similarity)}% match
                            </Badge>
                          </div>
                          {expandedArtists.has(match.artistName) ? 
                            <ChevronUp className="h-4 w-4" /> : 
                            <ChevronDown className="h-4 w-4" />
                          }
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <div className="grid md:grid-cols-2 gap-4">
                          {/* Local Tracks */}
                          <div>
                            <h5 className="font-medium text-sm mb-2 text-green-600">
                              Local Tracks ({match.localTracks.length})
                            </h5>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {match.localTracks.map((track) => (
                                <div key={track.id} className="text-xs p-2 bg-green-50 rounded border-l-2 border-green-200">
                                  <div className="font-medium">{track.title || 'Unknown Title'}</div>
                                  <div className="text-muted-foreground">{track.album || 'Unknown Album'}</div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Spotify Tracks */}
                          <div>
                            <h5 className="font-medium text-sm mb-2 text-blue-600">
                              Spotify Tracks ({match.spotifyTracks.length})
                            </h5>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {match.spotifyTracks.map((track) => (
                                <div key={track.id} className="text-xs p-2 bg-blue-50 rounded border-l-2 border-blue-200">
                                  <div className="font-medium">{track.title}</div>
                                  <div className="text-muted-foreground">{track.album || 'Unknown Album'}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              ))}
            </div>
          </div>
        )}

        {artistMatches.length === 0 && !isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No artist matches found yet</p>
            <p className="text-sm">Click "Find Artist Matches" to discover shared artists between your collections</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}