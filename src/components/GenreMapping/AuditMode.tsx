import { useState } from 'react';
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import type { GenreMapping, SuperGenre } from '@/types/genreMapping';
import { SUPER_GENRES } from '@/types/genreMapping';

interface AuditModeProps {
  mappings: GenreMapping[];
  onSetOverride: (spotifyGenre: string, superGenre: SuperGenre) => void;
  onRemoveOverride: (spotifyGenre: string) => void;
  onExit: () => void;
}

export const AuditMode: React.FC<AuditModeProps> = ({
  mappings,
  onSetOverride,
  onRemoveOverride,
  onExit
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewedGenres, setReviewedGenres] = useState<Set<string>>(new Set());

  const currentMapping = mappings[currentIndex];
  const progress = ((reviewedGenres.size) / mappings.length) * 100;

  const handleNext = () => {
    if (currentIndex < mappings.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleAcceptBase = () => {
    if (currentMapping.is_overridden) {
      onRemoveOverride(currentMapping.spotify_genre);
    }
    markAsReviewed();
  };

  const handleSetOverride = (superGenre: SuperGenre) => {
    onSetOverride(currentMapping.spotify_genre, superGenre);
    markAsReviewed();
  };

  const markAsReviewed = () => {
    const newReviewed = new Set(reviewedGenres);
    newReviewed.add(currentMapping.spotify_genre);
    setReviewedGenres(newReviewed);
    
    // Auto-advance to next item
    setTimeout(() => {
      if (currentIndex < mappings.length - 1) {
        handleNext();
      }
    }, 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key.toLowerCase()) {
      case 'a':
        e.preventDefault();
        handleAcceptBase();
        break;
      case 'arrowleft':
        e.preventDefault();
        handlePrevious();
        break;
      case 'arrowright':
        e.preventDefault();
        handleNext();
        break;
    }
  };

  const isReviewed = reviewedGenres.has(currentMapping.spotify_genre);

  return (
    <div className="space-y-6" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">Audit Mode</h2>
          <p className="text-muted-foreground">
            Review and override genre mappings • {reviewedGenres.size}/{mappings.length} reviewed
          </p>
        </div>
        <Button onClick={onExit} variant="outline">
          Exit Audit Mode
        </Button>
      </div>

      <Progress value={progress} className="w-full" />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              Genre {currentIndex + 1} of {mappings.length}
              {isReviewed && <Badge variant="secondary">Reviewed</Badge>}
            </CardTitle>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevious}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={currentIndex === mappings.length - 1}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <h3 className="text-3xl font-bold text-primary">
              {currentMapping.spotify_genre}
            </h3>
            <p className="text-muted-foreground">
              Current mapping: <span className="font-medium">{currentMapping.super_genre}</span>
              <Badge 
                variant={currentMapping.is_overridden ? 'secondary' : 'outline'}
                className="ml-2"
              >
                {currentMapping.is_overridden ? 'Override' : 'Base'}
              </Badge>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4">
              <h4 className="font-medium mb-3">Quick Actions</h4>
              <div className="space-y-2">
                <Button
                  onClick={handleAcceptBase}
                  variant="outline"
                  className="w-full justify-start"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Accept Current ({currentMapping.super_genre})
                  <Badge className="ml-auto">A</Badge>
                </Button>
              </div>
            </Card>

            <Card className="p-4">
              <h4 className="font-medium mb-3">Override with Different Genre</h4>
              <Select onValueChange={(value) => handleSetOverride(value as SuperGenre)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose super-genre..." />
                </SelectTrigger>
                <SelectContent>
                  {SUPER_GENRES.map(genre => (
                    <SelectItem 
                      key={genre} 
                      value={genre}
                      disabled={genre === currentMapping.super_genre}
                    >
                      {genre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Card>
          </div>

          <div className="text-center text-sm text-muted-foreground space-y-1">
            <p>Keyboard shortcuts: [A] Accept • [←] Previous • [→] Next</p>
            <p>Progress saved automatically</p>
          </div>
        </CardContent>
      </Card>

      {reviewedGenres.size === mappings.length && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <Check className="w-12 h-12 text-green-600 mx-auto" />
              <h3 className="text-lg font-semibold text-green-800">
                Audit Complete!
              </h3>
              <p className="text-green-700">
                You've reviewed all {mappings.length} genre mappings.
              </p>
              <Button onClick={onExit} className="mt-4">
                Return to Mapping Table
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};