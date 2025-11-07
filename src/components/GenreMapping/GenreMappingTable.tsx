import { useState, useEffect } from 'react';
import { Search, Download, Edit3, ArrowUpDown, CheckCircle2, Circle, Sparkles, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { AiGenreSuggestService } from '@/services/aiGenreSuggest.service';
import type { GenreMapping, SuperGenre } from '@/types/genreMapping';
import { SUPER_GENRES } from '@/types/genreMapping';
interface GenreMappingTableProps {
  mappings: GenreMapping[];
  onSetOverride: (spotifyGenre: string, superGenre: SuperGenre) => void;
  onRemoveOverride: (spotifyGenre: string) => void;
  onBulkOverrides: (overrides: Array<{ spotifyGenre: string; superGenre: SuperGenre }>) => Promise<void>;
  onExport: () => void;
  isLoading?: boolean;
}
export const GenreMappingTable: React.FC<GenreMappingTableProps> = ({
  mappings,
  onSetOverride,
  onRemoveOverride,
  onBulkOverrides,
  onExport,
  isLoading = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSuperGenre, setFilterSuperGenre] = useState<string>('all');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<'spotify_genre' | 'super_genre'>('spotify_genre');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [reviewedGenres, setReviewedGenres] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiSuggestionGenre, setAiSuggestionGenre] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ suggestedGenre: SuperGenre; confidence: string; reasoning: string } | null>(null);
  const { toast } = useToast();

  // Load reviewed genres from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('reviewedGenres');
    if (stored) {
      try {
        setReviewedGenres(new Set(JSON.parse(stored)));
      } catch (e) {
        console.error('Failed to load reviewed genres', e);
      }
    }
  }, []);

  // Save reviewed genres to localStorage
  useEffect(() => {
    localStorage.setItem('reviewedGenres', JSON.stringify(Array.from(reviewedGenres)));
  }, [reviewedGenres]);
  const filteredMappings = mappings.filter(mapping => {
    const matchesSearch = 
      mapping.spotify_genre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (mapping.super_genre && mapping.super_genre.toLowerCase().includes(searchTerm.toLowerCase()));
    let matchesFilter = true;
    if (filterSuperGenre === 'no-super-genre') {
      matchesFilter = !mapping.super_genre;
    } else if (filterSuperGenre !== 'all') {
      matchesFilter = mapping.super_genre === filterSuperGenre;
    }
    return matchesSearch && matchesFilter;
  }).sort((a, b) => {
    const aValue = sortColumn === 'spotify_genre' ? a.spotify_genre : (a.super_genre || '');
    const bValue = sortColumn === 'spotify_genre' ? b.spotify_genre : (b.super_genre || '');
    const comparison = aValue.localeCompare(bValue);
    return sortDirection === 'asc' ? comparison : -comparison;
  });
  const overriddenCount = mappings.filter(m => m.is_overridden).length;
  const unmappedCount = mappings.filter(m => !m.super_genre).length;
  const handleRowSelect = (spotifyGenre: string, checked: boolean) => {
    const newSelected = new Set(selectedRows);
    if (checked) {
      newSelected.add(spotifyGenre);
    } else {
      newSelected.delete(spotifyGenre);
    }
    setSelectedRows(newSelected);
  };
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(filteredMappings.map(m => m.spotify_genre)));
    } else {
      setSelectedRows(new Set());
    }
  };
  const handleInlineEdit = (spotifyGenre: string, newSuperGenre: SuperGenre) => {
    onSetOverride(spotifyGenre, newSuperGenre);
    setEditingRow(null);
  };
  const handleResetToDefault = (mapping: GenreMapping) => {
    if (mapping.is_overridden) {
      onRemoveOverride(mapping.spotify_genre);
    }
  };

  const toggleSort = (column: 'spotify_genre' | 'super_genre') => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const toggleReviewed = (spotifyGenre: string) => {
    const newReviewed = new Set(reviewedGenres);
    if (newReviewed.has(spotifyGenre)) {
      newReviewed.delete(spotifyGenre);
    } else {
      newReviewed.add(spotifyGenre);
    }
    setReviewedGenres(newReviewed);
  };

  const handleBulkSetGenre = async (superGenre: SuperGenre) => {
    setIsBulkUpdating(true);
    try {
      const overrides = Array.from(selectedRows).map(spotifyGenre => ({
        spotifyGenre,
        superGenre
      }));
      await onBulkOverrides(overrides);
      setSelectedRows(new Set());
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const reviewedCount = Array.from(reviewedGenres).filter(genre => 
    mappings.some(m => m.spotify_genre === genre)
  ).length;

  const handleAiSuggest = async (spotifyGenre: string) => {
    setAiSuggestionGenre(spotifyGenre);
    setAiDialogOpen(true);
    setAiLoading(true);
    setAiSuggestion(null);

    try {
      // Create a representative track info for the genre
      const trackInfo = {
        title: `Example track in ${spotifyGenre}`,
        artist: 'Various Artists',
        spotifyGenre: spotifyGenre
      };

      const suggestion = await AiGenreSuggestService.suggestGenre(trackInfo);
      setAiSuggestion(suggestion);
    } catch (error) {
      console.error('AI suggestion error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to get AI suggestion',
        variant: 'destructive'
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleAcceptAiSuggestion = () => {
    if (aiSuggestionGenre && aiSuggestion) {
      onSetOverride(aiSuggestionGenre, aiSuggestion.suggestedGenre);
      setAiDialogOpen(false);
      setAiSuggestion(null);
      setAiSuggestionGenre(null);
      toast({
        title: 'Applied AI Suggestion',
        description: `Set ${aiSuggestionGenre} to ${aiSuggestion.suggestedGenre}`
      });
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
  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading genre mappings...</div>;
  }
  return <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Summary</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {mappings.length} total genres • {overriddenCount} overridden • {unmappedCount} unmapped • {reviewedCount} reviewed
            </p>
          </div>
          <Button onClick={onExport} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
        
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search genres..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
          
          <Select value={filterSuperGenre} onValueChange={setFilterSuperGenre}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by Common Genre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Genres</SelectItem>
              <SelectItem value="no-super-genre">Unmapped</SelectItem>
              {[...SUPER_GENRES].sort().map(genre => <SelectItem key={genre} value={genre}>{genre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <input type="checkbox" checked={selectedRows.size === filteredMappings.length && filteredMappings.length > 0} onChange={e => handleSelectAll(e.target.checked)} className="rounded" />
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => toggleSort('spotify_genre')} className="font-semibold -ml-3">
                  Spotify Genre
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => toggleSort('super_genre')} className="font-semibold -ml-3">
                  Common Genre
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="w-12">Reviewed</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMappings.map(mapping => <TableRow key={mapping.spotify_genre} className={mapping.is_overridden ? 'bg-accent/50' : ''}>
                <TableCell>
                  <input type="checkbox" checked={selectedRows.has(mapping.spotify_genre)} onChange={e => handleRowSelect(mapping.spotify_genre, e.target.checked)} className="rounded" />
                </TableCell>
                <TableCell className="font-medium">{mapping.spotify_genre}</TableCell>
                 <TableCell>
                   {editingRow === mapping.spotify_genre ? <Select value={mapping.super_genre || ''} onValueChange={value => handleInlineEdit(mapping.spotify_genre, value as SuperGenre)}>
                       <SelectTrigger className="w-40">
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent>
                          {[...SUPER_GENRES].sort().map(genre => <SelectItem key={genre} value={genre}>{genre}</SelectItem>)}
                       </SelectContent>
                     </Select> : <span>
                         {mapping.super_genre ? mapping.super_genre : <span className="text-muted-foreground italic">Unmapped</span>}
                       </span>}
                 </TableCell>
                 <TableCell>
                   <Badge variant={!mapping.super_genre ? 'destructive' : mapping.is_overridden ? 'secondary' : 'outline'}>
                     {!mapping.super_genre ? 'Unmapped' : mapping.is_overridden ? 'Override' : 'Base'}
                   </Badge>
                 </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleReviewed(mapping.spotify_genre)}
                    className="p-0 h-auto"
                  >
                    {reviewedGenres.has(mapping.spotify_genre) ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground" />
                    )}
                  </Button>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => handleAiSuggest(mapping.spotify_genre)}
                      title="Get AI suggestion"
                    >
                      <Sparkles className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingRow(editingRow === mapping.spotify_genre ? null : mapping.spotify_genre)}>
                      <Edit3 className="w-3 h-3" />
                    </Button>
                    {mapping.is_overridden && <Button size="sm" variant="ghost" onClick={() => handleResetToDefault(mapping)} className="text-muted-foreground hover:text-foreground">
                        Reset
                      </Button>}
                  </div>
                </TableCell>
              </TableRow>)}
          </TableBody>
        </Table>

        {selectedRows.size > 0 && <div className="mt-4 p-3 bg-accent rounded-lg">
            <p className="text-sm font-medium mb-2">
              {selectedRows.size} genre{selectedRows.size !== 1 ? 's' : ''} selected
            </p>
            <div className="flex gap-2">
              <Select onValueChange={handleBulkSetGenre} disabled={isBulkUpdating}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Set Common Genre for selected" />
                </SelectTrigger>
                <SelectContent>
                  {[...SUPER_GENRES].sort().map(genre => <SelectItem key={genre} value={genre}>{genre}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSelectedRows(new Set())}
                disabled={isBulkUpdating}
              >
                Clear Selection
              </Button>
              {isBulkUpdating && (
                <span className="text-sm text-muted-foreground flex items-center">
                  Updating...
                </span>
              )}
            </div>
          </div>}
        
        {filteredMappings.length === 0 && <div className="text-center py-8 text-muted-foreground">
            No genres found matching your search criteria.
          </div>}
      </CardContent>

      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Genre Suggestion
            </DialogTitle>
            <DialogDescription>
              {aiSuggestionGenre && `Getting AI recommendation for "${aiSuggestionGenre}"`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {aiLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-sm text-muted-foreground">Analyzing genre...</span>
              </div>
            ) : aiSuggestion ? (
              <>
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold">{aiSuggestion.suggestedGenre}</span>
                    <Badge className={getConfidenceColor(aiSuggestion.confidence)}>
                      {aiSuggestion.confidence} confidence
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{aiSuggestion.reasoning}</p>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleAcceptAiSuggestion} className="flex-1">
                    Apply Suggestion
                  </Button>
                  <Button 
                    onClick={() => {
                      setAiDialogOpen(false);
                      setAiSuggestion(null);
                    }} 
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                No suggestion available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>;
};