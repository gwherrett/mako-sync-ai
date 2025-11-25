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
      {/* Header Card with Soulseek info */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle>Library Sync Analysis</CardTitle>
          <CardDescription>
            Find tracks in your Spotify collection that are missing from your local files. 
            Once identified, you can download them from Soulseek (slsk) or other sources to complete your library.
          </CardDescription>
        </CardHeader>
      </Card>
      
      {/* Missing Tracks Analyzer as main content */}
      <MissingTracksAnalyzer selectedGenre={selectedGenre} setSelectedGenre={setSelectedGenre} superGenres={superGenres} />
    </div>;
};
export default SyncAnalysis;