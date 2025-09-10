import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, AlertCircle, ExternalLink, Settings } from 'lucide-react';
import { useSpotifyAuth } from '@/hooks/useSpotifyAuth';
import { GenreMappingService } from '@/services/genreMapping.service';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  status: 'complete' | 'incomplete' | 'warning';
  count?: number;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
}

export const SetupChecklist: React.FC = () => {
  const { isConnected, isLoading: spotifyLoading, connectSpotify, syncLikedSongs, isSyncing } = useSpotifyAuth();
  const [likedSongsCount, setLikedSongsCount] = useState<number>(0);
  const [unmappedCount, setUnmappedCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        // Get liked songs count
        const { count: liked } = await supabase
          .from('spotify_liked')
          .select('*', { count: 'exact', head: true });
        
        setLikedSongsCount(liked || 0);

        // Get unmapped songs count (no super_genre)
        const { count: unmapped } = await supabase
          .from('spotify_liked')
          .select('*', { count: 'exact', head: true })
          .is('super_genre', null);
        
        setUnmappedCount(unmapped || 0);
      } catch (error) {
        console.error('Error fetching counts:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isConnected) {
      fetchCounts();
    } else {
      setLoading(false);
    }
  }, [isConnected]);

  const checklist: ChecklistItem[] = [
    {
      id: 'spotify-connection',
      title: 'Connect to Spotify',
      description: 'Link your Spotify account to access your liked songs',
      status: spotifyLoading ? 'incomplete' : (isConnected ? 'complete' : 'incomplete'),
      action: isConnected ? undefined : {
        label: 'Connect Spotify',
        onClick: connectSpotify
      }
    },
    {
      id: 'sync-liked-songs',
      title: 'Sync Liked Songs',
      description: 'Import your Spotify liked songs with metadata',
      status: !isConnected ? 'incomplete' : (likedSongsCount > 0 ? 'complete' : 'incomplete'),
      count: likedSongsCount,
      action: !isConnected ? undefined : {
        label: isSyncing ? 'Syncing...' : (likedSongsCount > 0 ? 'Sync Again' : 'Start Sync'),
        onClick: syncLikedSongs
      }
    },
    {
      id: 'map-genres',
      title: 'Map Genres',
      description: 'Organize your music by mapping Spotify genres to super-genres',
      status: !isConnected || likedSongsCount === 0 ? 'incomplete' : 
             (unmappedCount === 0 ? 'complete' : 'warning'),
      count: unmappedCount,
      action: !isConnected || likedSongsCount === 0 ? undefined : {
        label: 'Manage Genres',
        href: '/genre-mapping'
      }
    }
  ];

  const getStatusIcon = (status: ChecklistItem['status']) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <XCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (item: ChecklistItem) => {
    switch (item.status) {
      case 'complete':
        return <Badge variant="secondary" className="bg-green-500/10 text-green-400 border-green-500/30">Complete</Badge>;
      case 'warning':
        return (
          <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
            {item.count} Unmapped
          </Badge>
        );
      default:
        return <Badge variant="outline" className="bg-gray-500/10 text-gray-400 border-gray-500/30">Pending</Badge>;
    }
  };

  if (loading || spotifyLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading setup status...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Setup Checklist
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {checklist.map((item) => (
            <div 
              key={item.id} 
              className="flex items-center justify-between p-4 border border-border/50 rounded-lg"
            >
              <div className="flex items-start gap-3 flex-1">
                {getStatusIcon(item.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-foreground">{item.title}</h4>
                    {getStatusBadge(item)}
                  </div>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                  {item.count !== undefined && item.count > 0 && item.status === 'complete' && (
                    <p className="text-xs text-green-400 mt-1">{item.count.toLocaleString()} songs synced</p>
                  )}
                </div>
              </div>
              {item.action && (
                <div className="ml-4">
                  {item.action.href ? (
                    <Button asChild variant="outline" size="sm">
                      <Link to={item.action.href} className="flex items-center gap-2">
                        {item.action.label}
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={item.action.onClick}
                      disabled={isSyncing && item.id === 'sync-liked-songs'}
                    >
                      {item.action.label}
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};