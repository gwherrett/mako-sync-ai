import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AiGenreSuggestService } from '@/services/aiGenreSuggest.service';
import type { GenreMapping, SuperGenre } from '@/types/genreMapping';

interface BatchResult {
  spotifyGenre: string;
  suggestedGenre: SuperGenre;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  status: 'pending' | 'accepted' | 'rejected';
}

interface BatchAiProcessorProps {
  unmappedGenres: GenreMapping[];
  onApplyBulk: (overrides: Array<{ spotifyGenre: string; superGenre: SuperGenre }>) => Promise<void>;
}

export const BatchAiProcessor: React.FC<BatchAiProcessorProps> = ({
  unmappedGenres,
  onApplyBulk,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [currentGenre, setCurrentGenre] = useState<string>('');
  const { toast } = useToast();

  const startBatchProcessing = async () => {
    setIsOpen(true);
    setIsProcessing(true);
    setProgress(0);
    setResults([]);
    setCurrentGenre('');

    const newResults: BatchResult[] = [];
    const totalGenres = unmappedGenres.length;

    // Process in small batches to avoid rate limits
    const batchSize = 3;
    const delayBetweenBatches = 2000; // 2 seconds

    for (let i = 0; i < unmappedGenres.length; i += batchSize) {
      const batch = unmappedGenres.slice(i, Math.min(i + batchSize, unmappedGenres.length));
      
      const batchPromises = batch.map(async (mapping) => {
        setCurrentGenre(mapping.spotify_genre);
        
        try {
          const suggestion = await AiGenreSuggestService.suggestGenre({
            title: `Representative track`,
            artist: 'Various Artists',
            spotifyGenre: mapping.spotify_genre
          });

          return {
            spotifyGenre: mapping.spotify_genre,
            suggestedGenre: suggestion.suggestedGenre,
            confidence: suggestion.confidence,
            reasoning: suggestion.reasoning,
            status: 'pending' as const
          };
        } catch (error) {
          console.error(`Failed to process ${mapping.spotify_genre}:`, error);
          return {
            spotifyGenre: mapping.spotify_genre,
            suggestedGenre: 'Other' as SuperGenre,
            confidence: 'low' as const,
            reasoning: 'Failed to get AI suggestion',
            status: 'pending' as const
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      newResults.push(...batchResults);
      setResults([...newResults]);
      
      const progressPercent = Math.round(((i + batch.length) / totalGenres) * 100);
      setProgress(progressPercent);

      // Add delay between batches to respect rate limits
      if (i + batchSize < unmappedGenres.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    setIsProcessing(false);
    setCurrentGenre('');
    toast({
      title: 'Batch Processing Complete',
      description: `Analyzed ${totalGenres} genres. Review and apply suggestions below.`,
    });
  };

  const handleToggleResult = (index: number, newStatus: 'accepted' | 'rejected') => {
    setResults(prev => prev.map((result, i) => 
      i === index ? { ...result, status: newStatus } : result
    ));
  };

  const handleApplyAccepted = async () => {
    const acceptedOverrides = results
      .filter(r => r.status === 'accepted')
      .map(r => ({
        spotifyGenre: r.spotifyGenre,
        superGenre: r.suggestedGenre
      }));

    if (acceptedOverrides.length === 0) {
      toast({
        title: 'No Suggestions Selected',
        description: 'Please accept at least one suggestion to apply.',
        variant: 'destructive'
      });
      return;
    }

    try {
      await onApplyBulk(acceptedOverrides);
      toast({
        title: 'Applied Suggestions',
        description: `Successfully applied ${acceptedOverrides.length} genre mappings.`,
      });
      setIsOpen(false);
      setResults([]);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to apply suggestions. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const acceptedCount = results.filter(r => r.status === 'accepted').length;
  const rejectedCount = results.filter(r => r.status === 'rejected').length;
  const pendingCount = results.filter(r => r.status === 'pending').length;

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

  return (
    <>
      <Button 
        onClick={startBatchProcessing} 
        disabled={unmappedGenres.length === 0}
        variant="default"
        size="sm"
      >
        <Sparkles className="mr-2 h-4 w-4" />
        AI Batch Process ({unmappedGenres.length})
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Batch AI Genre Analysis
            </DialogTitle>
            <DialogDescription>
              {isProcessing 
                ? `Processing unmapped genres... (${Math.round(progress)}%)`
                : results.length > 0
                ? 'Review and apply AI suggestions'
                : 'Ready to start'
              }
            </DialogDescription>
          </DialogHeader>

          {isProcessing && (
            <div className="space-y-4 py-4">
              <Progress value={progress} className="w-full" />
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">
                  Analyzing: {currentGenre}
                </span>
              </div>
            </div>
          )}

          {!isProcessing && results.length > 0 && (
            <>
              <div className="flex gap-4 py-2">
                <Badge variant="outline" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {acceptedCount} Accepted
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  {rejectedCount} Rejected
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {pendingCount} Pending
                </Badge>
              </div>

              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {results.map((result, index) => (
                    <Card 
                      key={result.spotifyGenre}
                      className={
                        result.status === 'accepted' 
                          ? 'border-green-500/50 bg-green-500/5' 
                          : result.status === 'rejected'
                          ? 'border-red-500/50 bg-red-500/5'
                          : ''
                      }
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-sm font-medium">
                              {result.spotifyGenre}
                            </CardTitle>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-semibold">
                                → {result.suggestedGenre}
                              </span>
                              <Badge className={getConfidenceColor(result.confidence)}>
                                {result.confidence}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant={result.status === 'accepted' ? 'default' : 'outline'}
                              onClick={() => handleToggleResult(index, 'accepted')}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant={result.status === 'rejected' ? 'destructive' : 'outline'}
                              onClick={() => handleToggleResult(index, 'rejected')}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          {result.reasoning}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  onClick={handleApplyAccepted}
                  disabled={acceptedCount === 0}
                  className="flex-1"
                >
                  Apply {acceptedCount} Accepted Suggestion{acceptedCount !== 1 ? 's' : ''}
                </Button>
                <Button 
                  onClick={() => setIsOpen(false)} 
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
