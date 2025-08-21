import { useState } from 'react';
import { Search, Download, Edit3 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { GenreMapping, SuperGenre } from '@/types/genreMapping';
import { SUPER_GENRES } from '@/types/genreMapping';

interface GenreMappingTableProps {
  mappings: GenreMapping[];
  onSetOverride: (spotifyGenre: string, superGenre: SuperGenre) => void;
  onRemoveOverride: (spotifyGenre: string) => void;
  onExport: () => void;
  isLoading?: boolean;
}

export const GenreMappingTable: React.FC<GenreMappingTableProps> = ({
  mappings,
  onSetOverride,
  onRemoveOverride,
  onExport,
  isLoading = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSuperGenre, setFilterSuperGenre] = useState<string>('all');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [editingRow, setEditingRow] = useState<string | null>(null);

  const filteredMappings = mappings.filter(mapping => {
    const matchesSearch = mapping.spotify_genre.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesFilter = true;
    if (filterSuperGenre === 'no-super-genre') {
      matchesFilter = !mapping.super_genre;
    } else if (filterSuperGenre !== 'all') {
      matchesFilter = mapping.super_genre === filterSuperGenre;
    }
    
    return matchesSearch && matchesFilter;
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

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading genre mappings...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Genre Mapping</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {mappings.length} total genres • {overriddenCount} overridden • {unmappedCount} unmapped
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
            <Input
              placeholder="Search genres..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={filterSuperGenre} onValueChange={setFilterSuperGenre}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by super-genre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Super-Genres</SelectItem>
              <SelectItem value="no-super-genre">No Super Genre</SelectItem>
              {SUPER_GENRES.map(genre => (
                <SelectItem key={genre} value={genre}>{genre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  checked={selectedRows.size === filteredMappings.length && filteredMappings.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded"
                />
              </TableHead>
              <TableHead>Spotify Genre</TableHead>
              <TableHead>Super-Genre</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMappings.map((mapping) => (
              <TableRow key={mapping.spotify_genre} className={mapping.is_overridden ? 'bg-accent/50' : ''}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selectedRows.has(mapping.spotify_genre)}
                    onChange={(e) => handleRowSelect(mapping.spotify_genre, e.target.checked)}
                    className="rounded"
                  />
                </TableCell>
                <TableCell className="font-medium">{mapping.spotify_genre}</TableCell>
                 <TableCell>
                   {editingRow === mapping.spotify_genre ? (
                     <Select
                       value={mapping.super_genre || ''}
                       onValueChange={(value) => handleInlineEdit(mapping.spotify_genre, value as SuperGenre)}
                     >
                       <SelectTrigger className="w-40">
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent>
                         {SUPER_GENRES.map(genre => (
                           <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                     ) : (
                       <span>
                         {mapping.super_genre ? (
                           mapping.super_genre
                         ) : (
                           <span className="text-muted-foreground italic">No super genre</span>
                         )}
                       </span>
                     )}
                 </TableCell>
                 <TableCell>
                   <Badge 
                     variant={
                       !mapping.super_genre ? 'destructive' : 
                       mapping.is_overridden ? 'secondary' : 'outline'
                     }
                   >
                     {!mapping.super_genre ? 'Unmapped' : 
                      mapping.is_overridden ? 'Override' : 'Base'}
                   </Badge>
                 </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingRow(editingRow === mapping.spotify_genre ? null : mapping.spotify_genre)}
                    >
                      <Edit3 className="w-3 h-3" />
                    </Button>
                    {mapping.is_overridden && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleResetToDefault(mapping)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {selectedRows.size > 0 && (
          <div className="mt-4 p-3 bg-accent rounded-lg">
            <p className="text-sm font-medium mb-2">
              {selectedRows.size} genre{selectedRows.size !== 1 ? 's' : ''} selected
            </p>
            <div className="flex gap-2">
              <Select onValueChange={(value) => {
                const overrides = Array.from(selectedRows).map(spotifyGenre => ({
                  spotifyGenre,
                  superGenre: value as SuperGenre
                }));
                // This would need to be connected to bulk operation
                console.log('Bulk update:', overrides);
              }}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Set super-genre for selected" />
                </SelectTrigger>
                <SelectContent>
                  {SUPER_GENRES.map(genre => (
                    <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedRows(new Set())}
              >
                Clear Selection
              </Button>
            </div>
          </div>
        )}
        
        {filteredMappings.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No genres found matching your search criteria.
          </div>
        )}
      </CardContent>
    </Card>
  );
};