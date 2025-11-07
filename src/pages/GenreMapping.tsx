import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GenreMappingTable } from '@/components/GenreMapping/GenreMappingTable';
import { useGenreMapping } from '@/hooks/useGenreMapping';
import { Link } from 'react-router-dom';

export const GenreMapping = () => {
  const {
    mappings,
    isLoading,
    error,
    setOverride,
    removeOverride,
    setBulkOverrides,
    exportToCSV
  } = useGenreMapping();
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