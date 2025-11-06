import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, Zap, Target, Search, Users2, Filter, ChevronDown, ChevronUp, Music2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { enhancedTrackMatchingService, TrackMatch } from '@/services/enhancedTrackMatching.service';
import { TrackMatchingService } from '@/services/trackMatching.service';
import MissingTracksAnalyzer from '@/components/MissingTracksAnalyzer';
import { ArtistMatchSummary } from '@/components/ArtistMatchSummary';
import { supabase } from '@/integrations/supabase/client';

interface NormalizedArtist {
  original: string;
  normalized: string;
  primary: string | null;
  source: 'Spotify' | 'Local';
}

interface MatchingStats {
  totalTracks: number;
  highConfidence: number; // 90-100
  mediumConfidence: number; // 75-89
  lowConfidence: number; // 60-74
  unmatched: number;
}

const SyncAnalysis = () => {
  const [isMatching, setIsMatching] = useState(false);
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [matchingProgress, setMatchingProgress] = useState(0);
  const [matchingStats, setMatchingStats] = useState<MatchingStats | null>(null);
  const [matches, setMatches] = useState<TrackMatch[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [user, setUser] = useState<any>(null);
  const [superGenres, setSuperGenres] = useState<string[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [normalizedArtists, setNormalizedArtists] = useState<NormalizedArtist[]>([]);
  const [loadingArtists, setLoadingArtists] = useState(false);
  const [artistSourceFilter, setArtistSourceFilter] = useState<'all' | 'Spotify' | 'Local'>('all');
  const [artistSortOrder, setArtistSortOrder] = useState<'asc' | 'desc'>('asc');
  const { toast } = useToast();

  // Get user and load super genres on mount
  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        try {
          const genres = await TrackMatchingService.fetchSuperGenres(user.id);
          setSuperGenres(genres);
        } catch (error) {
          console.error('Failed to fetch super genres:', error);
        }
      }
    };
    
    loadData();
  }, []);

  const normalizeAllTracks = async () => {
    if (!user) return;

    setIsNormalizing(true);
    try {
      const result = await enhancedTrackMatchingService.normalizeAllUserTracks(user.id);
      toast({
        title: "Normalization Complete",
        description: `Normalized ${result.local} local tracks and ${result.spotify} Spotify tracks`,
      });
    } catch (error: any) {
      console.error("Error normalizing tracks:", error);
      toast({
        title: "Normalization Failed",
        description: error.message || "Failed to normalize tracks",
        variant: "destructive",
      });
    } finally {
      setIsNormalizing(false);
    }
  };

  const performMatching = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to perform track matching.",
        variant: "destructive",
      });
      return;
    }

    setIsMatching(true);
    setMatchingProgress(0);

    try {
      const genreText = selectedGenre === 'all' ? '' : ` (${selectedGenre} filter)`;
      console.log(`🎯 Starting enhanced batch track matching${genreText}...`);
      
      // Normalize first
      setMatchingProgress(10);
      await normalizeAllTracks();
      
      setMatchingProgress(30);
      
      // Perform matching
      const matchResults = await enhancedTrackMatchingService.performBatchMatching(
        user.id,
        selectedGenre === "all" ? undefined : selectedGenre
      );

      setMatches(matchResults);
      setMatchingProgress(70);
      
      // Calculate statistics
      const stats: MatchingStats = {
        totalTracks: matchResults.length,
        highConfidence: matchResults.filter(m => m.score.total >= 90).length,
        mediumConfidence: matchResults.filter(m => m.score.total >= 75 && m.score.total < 90).length,
        lowConfidence: matchResults.filter(m => m.score.total >= 60 && m.score.total < 75).length,
        unmatched: 0,
      };

      setMatchingProgress(100);
      setMatchingStats(stats);

      const resultGenreText = selectedGenre === 'all' ? '' : ` (${selectedGenre})`;
      toast({
        title: "Matching Complete",
        description: `Found ${matchResults.length} matches${resultGenreText}.`,
      });

      console.log(`✅ Enhanced matching complete: ${matchResults.length} matches found`);
    } catch (error: any) {
      console.error('❌ Matching error:', error);
      toast({
        title: "Matching Failed",
        description: error.message || "Failed to perform track matching.",
        variant: "destructive",
      });
    } finally {
      setIsMatching(false);
      setMatchingProgress(0);
    }
  };

  const toggleRow = (matchId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(matchId)) {
        newSet.delete(matchId);
      } else {
        newSet.add(matchId);
      }
      return newSet;
    });
  };

  const getConfidenceColor = (score: number): string => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 75) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  const getConfidenceBadgeVariant = (score: number): "default" | "secondary" | "outline" => {
    if (score >= 90) return 'default';
    if (score >= 75) return 'secondary';
    return 'outline';
  };

  const getMatchQualityColor = (algorithm: string): string => {
    switch (algorithm) {
      case 'exact': return 'bg-green-500';
      case 'close': return 'bg-blue-500';
      case 'fuzzy': return 'bg-yellow-500';
      case 'artist-only': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getMatchQualityLabel = (algorithm: string): string => {
    switch (algorithm) {
      case 'exact': return 'Perfect Match';
      case 'close': return 'High Confidence';
      case 'fuzzy': return 'Good Match';
      case 'artist-only': return 'Artist Only';
      default: return 'Unknown';
    }
  };

  const loadNormalizedArtists = async () => {
    if (!user) return;

    setLoadingArtists(true);
    try {
      // Fetch Spotify artists
      const { data: spotifyData, error: spotifyError } = await supabase
        .from('spotify_liked')
        .select('artist, normalized_artist, primary_artist')
        .eq('user_id', user.id)
        .not('artist', 'is', null);

      if (spotifyError) throw spotifyError;

      // Fetch Local artists
      const { data: localData, error: localError } = await supabase
        .from('local_mp3s')
        .select('artist, normalized_artist, primary_artist')
        .eq('user_id', user.id)
        .not('artist', 'is', null);

      if (localError) throw localError;

      // Combine and format data
      const spotify: NormalizedArtist[] = (spotifyData || []).map(item => ({
        original: item.artist || '',
        normalized: item.normalized_artist || '',
        primary: item.primary_artist || null,
        source: 'Spotify' as const
      }));

      const local: NormalizedArtist[] = (localData || []).map(item => ({
        original: item.artist || '',
        normalized: item.normalized_artist || '',
        primary: item.primary_artist || null,
        source: 'Local' as const
      }));

      // Remove duplicates based on original + source
      const uniqueArtists = [...spotify, ...local].reduce((acc, curr) => {
        const key = `${curr.original}-${curr.source}`;
        if (!acc.has(key)) {
          acc.set(key, curr);
        }
        return acc;
      }, new Map<string, NormalizedArtist>());

      setNormalizedArtists(Array.from(uniqueArtists.values()));
    } catch (error: any) {
      console.error('Error loading normalized artists:', error);
      toast({
        title: "Failed to Load Artists",
        description: error.message || "Could not load normalized artist data",
        variant: "destructive",
      });
    } finally {
      setLoadingArtists(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardContent className="space-y-4">
          {/* Genre Filter */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filter by Common Genre:</span>
            </div>
            <Select value={selectedGenre} onValueChange={setSelectedGenre}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select genre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Common Genres</SelectItem>
                {superGenres.map((genre) => (
                  <SelectItem key={genre} value={genre}>
                    {genre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4">
            <Button 
              onClick={performMatching}
              disabled={isMatching}
              className="bg-primary hover:bg-primary/90"
            >
              {isMatching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Matching...
                </>
              ) : (
                <>
                  <Target className="w-4 h-4 mr-2" />
                  run matching algo
                </>
              )}
            </Button>
          </div>

          {/* Progress Bar */}
          {isMatching && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                <span>Processing tracks...</span>
                <span>{matchingProgress}%</span>
              </div>
              <Progress value={matchingProgress} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Match Overview</TabsTrigger>
          <TabsTrigger value="artists">Artist Discovery</TabsTrigger>
          <TabsTrigger value="missing">Missing Tracks</TabsTrigger>
          <TabsTrigger value="normalized">Normalized Artists</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {matchingStats ? (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription>Total Matches</CardDescription>
                    <CardTitle className="text-3xl">{matchingStats.totalTracks}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="border-green-200 dark:border-green-900">
                  <CardHeader className="pb-3">
                    <CardDescription className="text-green-600 dark:text-green-400">High Confidence</CardDescription>
                    <CardTitle className="text-3xl text-green-600 dark:text-green-400">{matchingStats.highConfidence}</CardTitle>
                    <CardDescription className="text-xs">90-100%</CardDescription>
                  </CardHeader>
                </Card>
                <Card className="border-yellow-200 dark:border-yellow-900">
                  <CardHeader className="pb-3">
                    <CardDescription className="text-yellow-600 dark:text-yellow-400">Medium Confidence</CardDescription>
                    <CardTitle className="text-3xl text-yellow-600 dark:text-yellow-400">{matchingStats.mediumConfidence}</CardTitle>
                    <CardDescription className="text-xs">75-89%</CardDescription>
                  </CardHeader>
                </Card>
                <Card className="border-orange-200 dark:border-orange-900">
                  <CardHeader className="pb-3">
                    <CardDescription className="text-orange-600 dark:text-orange-400">Low Confidence</CardDescription>
                    <CardTitle className="text-3xl text-orange-600 dark:text-orange-400">{matchingStats.lowConfidence}</CardTitle>
                    <CardDescription className="text-xs">60-74%</CardDescription>
                  </CardHeader>
                </Card>
              </div>
            </>
          ) : null}

          {matches.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Detailed Match Results</CardTitle>
                <CardDescription>
                  Click on a match to see detailed scoring breakdown
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>Local Track</TableHead>
                      <TableHead>Spotify Match</TableHead>
                      <TableHead className="text-center">Score</TableHead>
                      <TableHead>Algorithm</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matches.slice(0, 50).map((match) => {
                      const matchId = `${match.localTrack.id}-${match.spotifyTrack.id}`;
                      const isExpanded = expandedRows.has(matchId);
                      
                      return (
                        <React.Fragment key={matchId}>
                          <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRow(matchId)}>
                            <TableCell>
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{match.localTrack.title || 'Unknown'}</div>
                              <div className="text-sm text-muted-foreground">{match.localTrack.artist || 'Unknown'}</div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{match.spotifyTrack.title}</div>
                              <div className="text-sm text-muted-foreground">{match.spotifyTrack.artist}</div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={getConfidenceBadgeVariant(match.score.total)}>
                                {match.score.total}%
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{match.score.algorithm}</span>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow>
                              <TableCell colSpan={5} className="bg-muted/30">
                                <div className="p-4 space-y-3">
                                  <div className="text-sm font-medium">Score Breakdown:</div>
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                                    <div>
                                      <span className="text-muted-foreground">Core Title Match:</span>
                                      <span className="ml-2 font-medium">{match.score.breakdown.coreTitleMatch} pts</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Artist Match:</span>
                                      <span className="ml-2 font-medium">{match.score.breakdown.artistMatch} pts</span>
                                    </div>
                                    {match.score.breakdown.versionBonus > 0 && (
                                      <div>
                                        <span className="text-muted-foreground">Version Bonus:</span>
                                        <span className="ml-2 font-medium text-green-600">+{match.score.breakdown.versionBonus} pts</span>
                                      </div>
                                    )}
                                    {match.score.breakdown.albumBonus > 0 && (
                                      <div>
                                        <span className="text-muted-foreground">Album Bonus:</span>
                                        <span className="ml-2 font-medium text-green-600">+{match.score.breakdown.albumBonus} pts</span>
                                      </div>
                                    )}
                                    {match.score.breakdown.mixBonus > 0 && (
                                      <div>
                                        <span className="text-muted-foreground">Mix Bonus:</span>
                                        <span className="ml-2 font-medium text-green-600">+{match.score.breakdown.mixBonus} pts</span>
                                      </div>
                                    )}
                                    {match.score.breakdown.penalties !== 0 && (
                                      <div>
                                        <span className="text-muted-foreground">Penalties:</span>
                                        <span className="ml-2 font-medium text-red-600">{match.score.breakdown.penalties} pts</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-sm text-muted-foreground pt-2 border-t">
                                  {match.score.details}
                                </div>
                                {match.localTrack.mix && (
                                  <div className="text-sm">
                                    <span className="text-muted-foreground">Local Mix:</span>
                                    <span className="ml-2">{match.localTrack.mix}</span>
                                  </div>
                                )}
                                {match.spotifyTrack.mix && (
                                  <div className="text-sm">
                                    <span className="text-muted-foreground">Spotify Mix:</span>
                                    <span className="ml-2">{match.spotifyTrack.mix}</span>
                                  </div>
                                )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
                {matches.length > 50 && (
                  <div className="text-center text-sm text-muted-foreground mt-4">
                    Showing first 50 of {matches.length} matches
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {!matchingStats && matches.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Matching Results Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Run track matching to see how your local collection compares to your Spotify library.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="artists">
          <ArtistMatchSummary 
            selectedGenre={selectedGenre}
            superGenres={superGenres}
          />
        </TabsContent>

          <TabsContent value="missing">
            <MissingTracksAnalyzer 
              selectedGenre={selectedGenre}
              setSelectedGenre={setSelectedGenre}
              superGenres={superGenres}
            />
          </TabsContent>

        <TabsContent value="normalized" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music2 className="h-5 w-5" />
                Normalized Artist Names
              </CardTitle>
              <CardDescription>
                View how artist names are normalized for matching between Spotify and Local libraries
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Button 
                  onClick={loadNormalizedArtists}
                  disabled={loadingArtists}
                >
                  {loadingArtists ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load Artist Data'
                  )}
                </Button>

                {normalizedArtists.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={artistSourceFilter} onValueChange={(value: any) => setArtistSourceFilter(value)}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sources</SelectItem>
                        <SelectItem value="Spotify">Spotify Only</SelectItem>
                        <SelectItem value="Local">Local Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {normalizedArtists.length > 0 && (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead>Original Artist</TableHead>
                        <TableHead>Normalized</TableHead>
                        <TableHead>Primary Artist</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {normalizedArtists
                        .filter(artist => artistSourceFilter === 'all' || artist.source === artistSourceFilter)
                        .sort((a, b) => {
                          const aVal = a.primary || '';
                          const bVal = b.primary || '';
                          return artistSortOrder === 'asc' 
                            ? aVal.localeCompare(bVal)
                            : bVal.localeCompare(aVal);
                        })
                        .map((artist, idx) => (
                        <TableRow key={`${artist.source}-${artist.original}-${idx}`}>
                          <TableCell>
                            <Badge variant={artist.source === 'Spotify' ? 'default' : 'secondary'}>
                              {artist.source}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{artist.original}</TableCell>
                          <TableCell className="text-muted-foreground">{artist.normalized || '-'}</TableCell>
                          <TableCell className="text-muted-foreground">{artist.primary || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {normalizedArtists.length === 0 && !loadingArtists && (
                <div className="text-center py-8 text-muted-foreground">
                  <Music2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Click "Load Artist Data" to view normalized artist names</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SyncAnalysis;