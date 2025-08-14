import React from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Base filter configuration
export interface FilterConfig {
  search?: boolean;
  dateFilters?: boolean;
  genre?: boolean;
  artist?: boolean;
}

// Filter state interface
export interface FilterState {
  searchQuery: string;
  selectedGenre: string;
  selectedArtist: string;
  dateFilter: string;
}

// Filter options interface
export interface FilterOptions {
  genres: string[];
  artists: string[];
}

// Filter callbacks interface
export interface FilterCallbacks {
  onSearchChange: (value: string) => void;
  onGenreChange: (value: string) => void;
  onArtistChange: (value: string) => void;
  onDateFilterChange: (value: string) => void;
  onClearFilters: () => void;
  onPageChange: (page: number) => void;
}

interface TrackFiltersProps {
  config: FilterConfig;
  state: FilterState;
  options: FilterOptions;
  callbacks: FilterCallbacks;
  className?: string;
}

export const TrackFilters: React.FC<TrackFiltersProps> = ({
  config,
  state,
  options,
  callbacks,
  className = ""
}) => {
  const hasActiveFilters = state.searchQuery || state.selectedGenre || state.selectedArtist || state.dateFilter;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Top Row: Search Bar + Date Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        {/* Search Bar */}
        {config.search && (
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tracks or artists…"
              value={state.searchQuery}
              onChange={(e) => callbacks.onSearchChange(e.target.value)}
              className="pl-8"
            />
          </div>
        )}

        {/* Date Filters */}
        {config.dateFilters && (
          <div className="flex gap-2">
            <Button
              variant={state.dateFilter === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                callbacks.onDateFilterChange(state.dateFilter === 'week' ? '' : 'week');
                callbacks.onPageChange(1);
              }}
            >
              Last Week
            </Button>
            <Button
              variant={state.dateFilter === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                callbacks.onDateFilterChange(state.dateFilter === 'month' ? '' : 'month');
                callbacks.onPageChange(1);
              }}
            >
              Last Month
            </Button>
          </div>
        )}
      </div>
      
      {/* Bottom Row: Genre + Artist Filters */}
      {(config.genre || config.artist) && (
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Genre Filter */}
          {config.genre && (
            <div className="flex-1 max-w-xs">
              <Select
                value={state.selectedGenre}
                onValueChange={(value) => {
                  callbacks.onGenreChange(value === 'all' ? '' : value);
                  callbacks.onArtistChange(''); // Clear artist filter when genre changes
                  callbacks.onPageChange(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All genres" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All genres</SelectItem>
                  {options.genres.map((genre) => (
                    <SelectItem key={genre} value={genre}>
                      {genre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* Artist Filter */}
          {config.artist && (
            <div className="flex-1 max-w-xs">
              <Select
                value={state.selectedArtist}
                onValueChange={(value) => {
                  callbacks.onArtistChange(value === 'all' ? '' : value);
                  callbacks.onPageChange(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All artists" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All artists</SelectItem>
                  {options.artists.slice(0, 50).map((artist) => (
                    <SelectItem key={artist} value={artist}>
                      {artist}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <div className="flex justify-start">
          <Button variant="ghost" size="sm" onClick={callbacks.onClearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  );
};