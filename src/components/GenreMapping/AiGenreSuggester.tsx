import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AiGenreSuggestService, type TrackInfo, type AiGenreSuggestion } from '@/services/aiGenreSuggest.service';
import type { SuperGenre } from '@/types/genreMapping';

interface AiGenreSuggesterProps {
  trackInfo: TrackInfo;
  currentGenre?: SuperGenre | null;
  onAcceptSuggestion: (genre: SuperGenre) => void;
}

export const AiGenreSuggester: React.FC<AiGenreSuggesterProps> = ({
  trackInfo,
  currentGenre,
  onAcceptSuggestion,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<AiGenreSuggestion | null>(null);
  const { toast } = useToast();

  const getSuggestion = async () => {
    setIsLoading(true);
    try {
      const result = await AiGenreSuggestService.suggestGenre(trackInfo);
      setSuggestion(result);
      
      toast({
        title: 'AI Suggestion Ready',
        description: `Suggested: ${result.suggestedGenre} (${result.confidence} confidence)`,
      });
    } catch (error) {
      console.error('Error getting AI suggestion:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to get AI suggestion',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = () => {
    if (suggestion) {
      onAcceptSuggestion(suggestion.suggestedGenre);
      toast({
        title: 'Genre Applied',
        description: `Set to ${suggestion.suggestedGenre}`,
      });
      setSuggestion(null);
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
      case 'low':
        return 'bg-red-500/10 text-red-700 dark:text-red-400';
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          AI Genre Suggester
        </CardTitle>
        <CardDescription>
          Get AI-powered genre recommendations based on track information
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm">
            <span className="font-medium">Track:</span> {trackInfo.title}
          </p>
          <p className="text-sm">
            <span className="font-medium">Artist:</span> {trackInfo.artist}
          </p>
          {trackInfo.mix && (
            <p className="text-sm">
              <span className="font-medium">Mix:</span> {trackInfo.mix}
            </p>
          )}
          {trackInfo.spotifyGenre && (
            <p className="text-sm">
              <span className="font-medium">Spotify Genre:</span> {trackInfo.spotifyGenre}
            </p>
          )}
          {currentGenre && (
            <p className="text-sm">
              <span className="font-medium">Current:</span> {currentGenre}
            </p>
          )}
        </div>

        {!suggestion ? (
          <Button 
            onClick={getSuggestion} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Get AI Suggestion
              </>
            )}
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="p-3 border rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">{suggestion.suggestedGenre}</span>
                <Badge className={getConfidenceColor(suggestion.confidence)}>
                  {suggestion.confidence} confidence
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{suggestion.reasoning}</p>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={handleAccept} className="flex-1">
                Accept Suggestion
              </Button>
              <Button onClick={() => setSuggestion(null)} variant="outline">
                Dismiss
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
