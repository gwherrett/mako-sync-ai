import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter } from 'lucide-react';
import MissingTracksAnalyzer from '@/components/MissingTracksAnalyzer';
import { TrackMatchingService } from '@/services/trackMatching.service';
import { supabase } from '@/integrations/supabase/client';

interface SyncAnalysisProps {
  sharedSearchQuery?: string;
  sharedSuperGenre?: string;
}

const SyncAnalysis = ({ sharedSearchQuery = '', sharedSuperGenre = '' }: SyncAnalysisProps) => {
  const [user, setUser] = useState<any>(null);
  const [superGenres, setSuperGenres] = useState<string[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>('all');

  // Use shared supergenre if set, otherwise use local selection
  const effectiveGenre = sharedSuperGenre || selectedGenre;

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
      {/* Missing Tracks Analyzer as main content */}
      <MissingTracksAnalyzer
        selectedGenre={effectiveGenre}
        setSelectedGenre={setSelectedGenre}
        superGenres={superGenres}
        sharedSearchQuery={sharedSearchQuery}
      />
    </div>;
};
export default SyncAnalysis;