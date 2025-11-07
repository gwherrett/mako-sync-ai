import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Loader2, CheckCircle2, XCircle, ArrowLeft, Music } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AiGenreSuggestService } from '@/services/aiGenreSuggest.service';
import type { SuperGenre } from '@/types/genreMapping';

interface NoGenreTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  mix?: string;
}

interface TrackSuggestion extends NoGenreTrack {
  suggestedGenre: string;
  suggestedSuperGenre: SuperGenre;
  confidence: string;
  reasoning: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export default function NoGenreTracks() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tracks, setTracks] = useState<NoGenreTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [suggestions, setSuggestions] = useState<TrackSuggestion[]>([]);
  const [currentTrack, setCurrentTrack] = useState<string>('');

  useEffect(() => {
    fetchNoGenreTracks();
  }, []);

  const fetchNoGenreTracks = async () => {
    try {
      const { data, error } = await supabase
        .from('spotify_liked')
        .select('id, title, artist, album, mix')
        .is('genre', null)
        .limit(50); // Limit to first 50 to avoid overwhelming

      if (error) throw error;

      setTracks(data || []);
    } catch (error) {
      console.error('Error fetching tracks:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch tracks without genres',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startAiProcessing = async () => {
    setIsProcessing(true);
    setProgress(0);
    setSuggestions([]);

    const newSuggestions: TrackSuggestion[] = [];
    const totalTracks = tracks.length;
    const batchSize = 3;
    const delayBetweenBatches = 2000;

    for (let i = 0; i < tracks.length; i += batchSize) {
      const batch = tracks.slice(i, Math.min(i + batchSize, tracks.length));

      const batchPromises = batch.map(async (track) => {
        setCurrentTrack(`${track.title} - ${track.artist}`);

        try {
          const suggestion = await AiGenreSuggestService.suggestGenre({
            title: track.title,
            artist: track.artist,
            album: track.album,
            mix: track.mix
          });

          return {
            ...track,
            suggestedGenre: suggestion.suggestedGenre.toLowerCase().replace(/\s+/g, ' '),
            suggestedSuperGenre: suggestion.suggestedGenre,
            confidence: suggestion.confidence,
            reasoning: suggestion.reasoning,
            status: 'pending' as const
          };
        } catch (error) {
          console.error(`Failed to process ${track.title}:`, error);
          return {
            ...track,
            suggestedGenre: 'other',
            suggestedSuperGenre: 'Other' as SuperGenre,
            confidence: 'low' as const,
            reasoning: 'Failed to get AI suggestion',
            status: 'pending' as const
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      newSuggestions.push(...batchResults);
      setSuggestions([...newSuggestions]);

      const progressPercent = Math.round(((i + batch.length) / totalTracks) * 100);
      setProgress(progressPercent);

      if (i + batchSize < tracks.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    setIsProcessing(false);
    setCurrentTrack('');
    toast({
      title: 'AI Processing Complete',
      description: `Analyzed ${totalTracks} tracks. Review and apply suggestions below.`,
    });
  };

  const handleToggleStatus = (index: number, newStatus: 'accepted' | 'rejected') => {
    setSuggestions(prev => prev.map((s, i) =>
      i === index ? { ...s, status: newStatus } : s
    ));
  };

  const handleApplyAccepted = async () => {
    const acceptedSuggestions = suggestions.filter(s => s.status === 'accepted');

    if (acceptedSuggestions.length === 0) {
      toast({
        title: 'No Suggestions Selected',
        description: 'Please accept at least one suggestion to apply.',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Update tracks with AI-suggested genres
      const updates = acceptedSuggestions.map(s => ({
        id: s.id,
        genre: s.suggestedGenre,
        super_genre: s.suggestedSuperGenre
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('spotify_liked')
          .update({ 
            genre: update.genre,
            super_genre: update.super_genre 
          })
          .eq('id', update.id);

        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: `Applied ${acceptedSuggestions.length} genre assignments.`,
      });

      // Refresh the tracks list
      await fetchNoGenreTracks();
      setSuggestions([]);
    } catch (error) {
      console.error('Error applying suggestions:', error);
      toast({
        title: 'Error',
        description: 'Failed to apply suggestions. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20';
      case 'low':
        return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20';
    }
  };

  const acceptedCount = suggestions.filter(s => s.status === 'accepted').length;
  const rejectedCount = suggestions.filter(s => s.status === 'rejected').length;
  const pendingCount = suggestions.filter(s => s.status === 'pending').length;

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Tracks Without Genres</h1>
            <p className="text-muted-foreground">
              {tracks.length} tracks need genre classification
            </p>
          </div>
        </div>
      </div>

      {tracks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Music className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">All tracks have genres!</p>
            <p className="text-sm text-muted-foreground">No tracks with missing genres found.</p>
          </CardContent>
        </Card>
      ) : suggestions.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>AI Genre Classification</CardTitle>
            <CardDescription>
              Use AI to analyze track metadata and suggest appropriate genres
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isProcessing ? (
              <>
                <Progress value={progress} className="w-full" />
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">
                    Analyzing: {currentTrack}
                  </span>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  This will analyze the first {Math.min(tracks.length, 50)} tracks and suggest genres based on:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>Track title and artist information</li>
                  <li>Album context</li>
                  <li>Remix/mix information if available</li>
                  <li>Musical style indicators in metadata</li>
                </ul>
                <Button onClick={startAiProcessing} disabled={isProcessing} className="w-full">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Start AI Genre Classification
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Review AI Suggestions</CardTitle>
                <CardDescription>
                  Accept or reject genre suggestions for your tracks
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {acceptedCount} Accepted
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  {rejectedCount} Rejected
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Loader2 className="h-3 w-3" />
                  {pendingCount} Pending
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-3">
                {suggestions.map((suggestion, index) => (
                  <Card
                    key={suggestion.id}
                    className={
                      suggestion.status === 'accepted'
                        ? 'border-green-500/50 bg-green-500/5'
                        : suggestion.status === 'rejected'
                        ? 'border-red-500/50 bg-red-500/5'
                        : ''
                    }
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-1">
                          <CardTitle className="text-base">{suggestion.title}</CardTitle>
                          <p className="text-sm text-muted-foreground">{suggestion.artist}</p>
                          {suggestion.mix && (
                            <p className="text-xs text-muted-foreground italic">Mix: {suggestion.mix}</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant={suggestion.status === 'accepted' ? 'default' : 'outline'}
                            onClick={() => handleToggleStatus(index, 'accepted')}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant={suggestion.status === 'rejected' ? 'destructive' : 'outline'}
                            onClick={() => handleToggleStatus(index, 'rejected')}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Suggested:</span>
                        <span className="text-sm">{suggestion.suggestedGenre}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-sm font-semibold">{suggestion.suggestedSuperGenre}</span>
                        <Badge className={getConfidenceColor(suggestion.confidence)}>
                          {suggestion.confidence}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{suggestion.reasoning}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            <div className="flex gap-2 pt-4 border-t">
              <Button onClick={handleApplyAccepted} disabled={acceptedCount === 0} className="flex-1">
                Apply {acceptedCount} Accepted Suggestion{acceptedCount !== 1 ? 's' : ''}
              </Button>
              <Button onClick={() => setSuggestions([])} variant="outline">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
