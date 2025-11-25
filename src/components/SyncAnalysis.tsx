import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter } from 'lucide-react';
import MissingTracksAnalyzer from '@/components/MissingTracksAnalyzer';
import { TrackMatchingService } from '@/services/trackMatching.service';
import { supabase } from '@/integrations/supabase/client';
const SyncAnalysis = () => {
  const [user, setUser] = useState<any>(null);
  const [superGenres, setSuperGenres] = useState<string[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>('all');

  // Get user and load super genres on mount
  useEffect(() => {
    const loadData = async () => {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        try {
          const genres = await TrackMatchingService.fetchSuperGenres(user.id);
          setSuperGenres(genres);
        } catch (error) {
          console.error('Failed to fetch super genres:', error);
        }
      }
    };
    loadData();
  }, []);
  return <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-expos-blue/20 bg-expos-dark-elevated/50">
        
        <CardContent>
          {/* Genre Filter */}
          <div className="flex items-center gap-3">
            <Filter className="h-5 w-5 text-expos-blue" />
            <span className="text-sm font-medium text-foreground whitespace-nowrap">
              Filter by Genre:
            </span>
            <Select value={selectedGenre} onValueChange={setSelectedGenre}>
              <SelectTrigger className="w-[180px] border-expos-blue/30 bg-expos-dark/50">
                <SelectValue placeholder="Select genre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genres</SelectItem>
                {superGenres.map(genre => <SelectItem key={genre} value={genre}>
                    {genre}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      {/* Missing Tracks Analyzer as main content */}
      <MissingTracksAnalyzer selectedGenre={selectedGenre} setSelectedGenre={setSelectedGenre} superGenres={superGenres} />
    </div>;
};
export default SyncAnalysis;