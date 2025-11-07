import { useState, useEffect } from 'react';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GenreMappingTable } from '@/components/GenreMapping/GenreMappingTable';
import { useGenreMapping } from '@/hooks/useGenreMapping';
import { GenreMappingService } from '@/services/genreMapping.service';
import { Link } from 'react-router-dom';
export const GenreMapping = () => {
  const [noGenreCount, setNoGenreCount] = useState<number>(0);
  const {
    mappings,
    isLoading,
    error,
    setOverride,
    removeOverride,
    setBulkOverrides,
    exportToCSV
  } = useGenreMapping();

  useEffect(() => {
    const fetchNoGenreCount = async () => {
      try {
        const count = await GenreMappingService.getNoGenreCount();
        setNoGenreCount(count);
      } catch (error) {
        console.error('Error fetching no-genre count:', error);
      }
    };

    fetchNoGenreCount();
  }, []);
  if (error) {
    return <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">Error Loading Genre Mappings</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button asChild>
            <Link to="/">Return Home</Link>
          </Button>
        </div>
      </div>;
  }
  return <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Genre Map</h1>
            <p className="text-muted-foreground">Map Spotify genres to Common Genres</p>
          </div>
        </div>
      </div>

      {noGenreCount > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <div>
              <span className="font-medium">{noGenreCount} tracks</span> have no Spotify-provided genre and cannot be mapped here.{' '}
              Use AI to suggest genres for these tracks.
            </div>
            <Button variant="default" size="sm" asChild>
              <Link to="/no-genre-tracks">
                Fix with AI →
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <GenreMappingTable 
        mappings={mappings} 
        onSetOverride={setOverride} 
        onRemoveOverride={removeOverride} 
        onBulkOverrides={setBulkOverrides}
        onExport={exportToCSV} 
        isLoading={isLoading} 
      />
    </div>;
};