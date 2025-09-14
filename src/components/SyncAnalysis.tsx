import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Zap, Target, Search, Users2, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TrackMatchingService } from '@/services/trackMatching.service';
import MissingTracksAnalyzer from '@/components/MissingTracksAnalyzer';
import { ArtistMatchSummary } from '@/components/ArtistMatchSummary';
import { supabase } from '@/integrations/supabase/client';

interface MatchingStats {
  total: number;
  exact: number;
  close: number;
  fuzzy: number;
  artistOnly: number;
  unmatched: number;
}

const SyncAnalysis = () => {
  const [isMatching, setIsMatching] = useState(false);
  const [matchingProgress, setMatchingProgress] = useState(0);
  const [matchingStats, setMatchingStats] = useState<MatchingStats | null>(null);
  const [user, setUser] = useState<any>(null);
  const [superGenres, setSuperGenres] = useState<string[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
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
      console.log(`🎯 Starting batch track matching${genreText}...`);
      
      // More accurate progress simulation
      const progressInterval = setInterval(() => {
        setMatchingProgress(prev => Math.min(prev + 5, 85));
      }, 800);

      const result = await TrackMatchingService.performBatchMatching(user.id, selectedGenre);
      
      clearInterval(progressInterval);
      setMatchingProgress(100);

      // Calculate stats
      const stats: MatchingStats = {
        total: result.processed,
        exact: result.matches.filter(m => m.algorithm === 'exact').length,
        close: result.matches.filter(m => m.algorithm === 'close').length,
        fuzzy: result.matches.filter(m => m.algorithm === 'fuzzy').length,
        artistOnly: result.matches.filter(m => m.algorithm === 'artist-only').length,
        unmatched: result.processed - result.matches.length
      };

      setMatchingStats(stats);

      const resultGenreText = selectedGenre === 'all' ? '' : ` (${selectedGenre})`;
      toast({
        title: "Matching Complete",
        description: `Processed ${result.processed} tracks, saved ${result.saved} matches${resultGenreText}.`,
      });

      console.log(`✅ Matching complete: ${result.saved} matches saved`);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Sync Analysis Dashboard
          </CardTitle>
          <CardDescription>
            Analyze and match your local music collection with your Spotify library.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Genre Filter */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filter by genre:</span>
            </div>
            <Select value={selectedGenre} onValueChange={setSelectedGenre}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select genre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genres</SelectItem>
                {superGenres.map((genre) => (
                  <SelectItem key={genre} value={genre}>
                    {genre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
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
                  Run Track Matching
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Match Overview</TabsTrigger>
          <TabsTrigger value="artists">Artist Discovery</TabsTrigger>
          <TabsTrigger value="missing">Missing Tracks</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {matchingStats ? (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Tracks</p>
                        <p className="text-2xl font-bold text-primary">{matchingStats.total}</p>
                      </div>
                      <Search className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Perfect Matches</p>
                        <p className="text-2xl font-bold text-green-600">{matchingStats.exact}</p>
                      </div>
                      <Target className="h-8 w-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Good Matches</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {matchingStats.close + matchingStats.fuzzy}
                        </p>
                      </div>
                      <Zap className="h-8 w-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Unmatched</p>
                        <p className="text-2xl font-bold text-orange-600">{matchingStats.unmatched}</p>
                      </div>
                      <Users2 className="h-8 w-8 text-orange-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Match Quality Breakdown</CardTitle>
                  <CardDescription>
                    Distribution of match confidence levels across your collection
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { key: 'exact', label: 'Perfect Match', count: matchingStats.exact, desc: 'Title + Artist + Album exact match' },
                      { key: 'close', label: 'High Confidence', count: matchingStats.close, desc: 'Title + Artist exact match' },
                      { key: 'fuzzy', label: 'Good Match', count: matchingStats.fuzzy, desc: 'Similar title and artist (80%+ similarity)' },
                      { key: 'artist-only', label: 'Artist Only', count: matchingStats.artistOnly, desc: 'Same artist, different track' },
                      { key: 'unmatched', label: 'No Match', count: matchingStats.unmatched, desc: 'No suitable match found' }
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${getMatchQualityColor(item.key)}`} />
                          <div>
                            <p className="font-medium">{item.label}</p>
                            <p className="text-sm text-muted-foreground">{item.desc}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary">{item.count} tracks</Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {matchingStats.total > 0 ? ((item.count / matchingStats.total) * 100).toFixed(1) : 0}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
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
      </Tabs>
    </div>
  );
};

export default SyncAnalysis;