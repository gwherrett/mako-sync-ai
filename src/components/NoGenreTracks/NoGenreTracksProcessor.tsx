import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, ChevronLeft, ChevronRight, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { TrackGenreService } from '@/services/trackGenre.service';
import { SUPER_GENRES, type SuperGenre } from '@/types/genreMapping';

interface Track {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  spotify_id: string;
}

interface Suggestion {
  suggestedGenre: SuperGenre;
  confidence: number;
  reasoning: string;
}

export const NoGenreTracksProcessor = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [processedCount, setProcessedCount] = useState(0);
  const [manualGenre, setManualGenre] = useState<SuperGenre | ''>('');

  useEffect(() => {
    loadTracks();
  }, []);

  const loadTracks = async () => {
    try {
      setIsLoading(true);
      const data = await TrackGenreService.getTracksWithoutGenre();
      setTracks(data);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error loading tracks',
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const currentTrack = tracks[currentIndex];

  const handleSuggest = async () => {
    if (!currentTrack) return;
    
    try {
      setIsSuggesting(true);
      setSuggestion(null);
      
      const result = await TrackGenreService.suggestGenreForTrack(
        currentTrack.id,
        currentTrack.title,
        currentTrack.artist,
        currentTrack.album
      );
      
      setSuggestion(result);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error getting suggestion',
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleAccept = async () => {
    if (!currentTrack || !suggestion) return;
    
    try {
      await TrackGenreService.assignGenreToTrack(currentTrack.id, suggestion.suggestedGenre);
      toast({
        title: 'Genre assigned',
        description: `"${currentTrack.title}" → ${suggestion.suggestedGenre}`
      });
      setProcessedCount(prev => prev + 1);
      handleNext();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error assigning genre',
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const handleManualAssign = async () => {
    if (!currentTrack || !manualGenre) return;
    
    try {
      await TrackGenreService.assignGenreToTrack(currentTrack.id, manualGenre);
      toast({
        title: 'Genre assigned',
        description: `"${currentTrack.title}" → ${manualGenre}`
      });
      setProcessedCount(prev => prev + 1);
      setManualGenre('');
      handleNext();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error assigning genre',
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const handleReject = () => {
    setSuggestion(null);
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setSuggestion(null);
      setManualGenre('');
    }
  };

  const handleNext = () => {
    if (currentIndex < tracks.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSuggestion(null);
      setManualGenre('');
    }
  };

  const handleSkip = () => {
    handleNext();
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'bg-green-500/10 text-green-700 dark:text-green-400';
    if (confidence >= 60) return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
    return 'bg-orange-500/10 text-orange-700 dark:text-orange-400';
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading tracks...</div>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">No Tracks to Process</h1>
          <p className="text-muted-foreground">All tracks have been assigned genres!</p>
          <Button onClick={() => navigate('/genre-mapping')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Genre Mapping
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => navigate('/genre-mapping')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="text-sm text-muted-foreground">
          Track {currentIndex + 1} of {tracks.length} • Processed: {processedCount}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{currentTrack.title}</CardTitle>
          <CardDescription>
            <div className="space-y-1 text-base">
              <div>👤 {currentTrack.artist}</div>
              {currentTrack.album && <div>💿 {currentTrack.album}</div>}
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!suggestion ? (
            <Button 
              onClick={handleSuggest} 
              disabled={isSuggesting}
              className="w-full"
              size="lg"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {isSuggesting ? 'Analyzing...' : 'Suggest Genre with AI'}
            </Button>
          ) : (
            <Alert className="border-primary/20">
              <Sparkles className="h-4 w-4 text-primary" />
              <AlertDescription className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg">Suggested: {suggestion.suggestedGenre}</span>
                  <Badge className={getConfidenceColor(suggestion.confidence)}>
                    {suggestion.confidence}% confidence
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {suggestion.reasoning}
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAccept} size="sm">
                    ✓ Accept
                  </Button>
                  <Button onClick={handleReject} variant="outline" size="sm">
                    ✗ Reject
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <div className="text-sm font-medium">Or assign manually:</div>
            <div className="flex gap-2">
              <Select value={manualGenre} onValueChange={(value) => setManualGenre(value as SuperGenre)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select genre..." />
                </SelectTrigger>
                <SelectContent>
                  {SUPER_GENRES.map(genre => (
                    <SelectItem key={genre} value={genre}>
                      {genre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleManualAssign} 
                disabled={!manualGenre}
                variant="secondary"
              >
                Assign
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>
        
        <Button
          variant="ghost"
          onClick={handleSkip}
        >
          <SkipForward className="w-4 h-4 mr-2" />
          Skip
        </Button>

        <Button
          variant="outline"
          onClick={handleNext}
          disabled={currentIndex === tracks.length - 1}
        >
          Next
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};
