import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Music, Database, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/NewAuthContext';

// Add debounce helper
let fetchDebounceTimer: NodeJS.Timeout | null = null;

const debouncedFetch = (fn: () => void, delay: number = 1000) => {
  if (fetchDebounceTimer) clearTimeout(fetchDebounceTimer);
  fetchDebounceTimer = setTimeout(fn, delay);
};

export const StatsOverview = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [likedSongsCount, setLikedSongsCount] = useState<number>(0);
  const [localFilesCount, setLocalFilesCount] = useState<number>(0);
  const [lastSpotifySync, setLastSpotifySync] = useState<string | null>(null);
  const [lastLocalSync, setLastLocalSync] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !user) {
      setLikedSongsCount(0);
      setLocalFilesCount(0);
      setLastSpotifySync(null);
      setLastLocalSync(null);
      setLoading(false);
      return;
    }

    fetchInitialData();
    const channel = setupRealtimeSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [authLoading, isAuthenticated, user?.id]);

  const fetchInitialData = async () => {
    if (!user || !isAuthenticated) return;

    await fetchLikedSongsCount(user.id);
    await fetchLocalFilesCount(user.id);
    await fetchLastSpotifySync(user.id);
    await fetchLastLocalSync(user.id);
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'spotify_liked'
        },
        () => {
          debouncedFetch(() => {
            fetchLikedSongsCount();
            fetchLastSpotifySync();
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'local_mp3s'
        },
        () => {
          debouncedFetch(() => {
            fetchLocalFilesCount();
            fetchLastLocalSync();
          });
        }
      )
      .subscribe();

    return channel;
  };

  const fetchLikedSongsCount = async (userId?: string) => {
    const effectiveUserId = userId ?? user?.id;

    if (!effectiveUserId) {
      console.log('❌ StatsOverview: No user for liked songs count');
      setLikedSongsCount(0);
      setLoading(false);
      return;
    }

    try {
      console.log('📊 StatsOverview: Fetching liked songs count...', { userId: effectiveUserId });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const { count, error } = await supabase
        .from('spotify_liked')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', effectiveUserId)
        .abortSignal(controller.signal);

      clearTimeout(timeoutId);

      console.log('📊 StatsOverview: Liked songs count result:', { count, error: error?.message });

      if (error) {
        console.error('❌ StatsOverview: Error fetching liked songs count:', error);
        setLoading(false);
        return;
      }

      setLikedSongsCount(count || 0);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('⏱️ StatsOverview: Query timed out after 10s');
      } else {
        console.error('💥 StatsOverview: Error:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchLocalFilesCount = async (userId?: string) => {
    const effectiveUserId = userId ?? user?.id;

    if (!effectiveUserId) {
      console.log('❌ StatsOverview: No user for local files count');
      setLocalFilesCount(0);
      return;
    }

    try {
      console.log('📊 StatsOverview: Fetching local files count...', { userId: effectiveUserId });

      const { count, error } = await supabase
        .from('local_mp3s')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', effectiveUserId);

      console.log('📊 StatsOverview: Local files count result:', { count, error: error?.message });

      if (error) {
        console.error('❌ StatsOverview: Error fetching local files count:', error);
        return;
      }

      setLocalFilesCount(count || 0);
    } catch (error) {
      console.error('💥 StatsOverview: Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLastSpotifySync = async (userId?: string) => {
    const effectiveUserId = userId ?? user?.id;

    if (!effectiveUserId) {
      setLastSpotifySync(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('spotify_liked')
        .select('created_at')
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('❌ StatsOverview: Error fetching last Spotify sync:', error);
        return;
      }

      if (data && data.length > 0) {
        setLastSpotifySync(data[0].created_at);
      } else {
        setLastSpotifySync(null);
      }
    } catch (error) {
      console.error('💥 StatsOverview: Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLastLocalSync = async (userId?: string) => {
    const effectiveUserId = userId ?? user?.id;

    if (!effectiveUserId) {
      setLastLocalSync(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('local_mp3s')
        .select('created_at')
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('❌ StatsOverview: Error fetching last local sync:', error);
        return;
      }

      if (data && data.length > 0) {
        setLastLocalSync(data[0].created_at);
      } else {
        setLastLocalSync(null);
      }
    } catch (error) {
      console.error('💥 StatsOverview: Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const collections = [
    {
      title: 'Spotify Collection',
      count: likedSongsCount,
      lastSync: lastSpotifySync,
      icon: Music,
      color: 'text-green-400',
      bgColor: 'bg-green-400/10',
      borderColor: 'hover:border-green-400/30',
      shadowColor: 'hover:shadow-green-400/10',
    },
    {
      title: 'Local Collection',
      count: localFilesCount,
      lastSync: lastLocalSync,
      icon: Database,
      color: 'text-purple-400',
      bgColor: 'bg-purple-400/10',
      borderColor: 'hover:border-purple-400/30',
      shadowColor: 'hover:shadow-purple-400/10',
    },
  ];

  return (
    <div className="space-y-4">
      {collections.map((collection, index) => (
        <Card 
          key={index} 
          className={`glass-card border-white/10 ${collection.borderColor} transition-all duration-300 hover:shadow-lg ${collection.shadowColor}`}
        >
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${collection.bgColor} ring-1 ring-white/10`}>
                <collection.icon className={`h-6 w-6 ${collection.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-1">
                  {collection.title}
                </div>
                <div className="text-3xl font-bold text-white mb-2">
                  {loading ? '...' : collection.count.toLocaleString()}
                </div>
                <div className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Last synced: {loading ? '...' : (collection.lastSync ? formatDistanceToNow(new Date(collection.lastSync), { addSuffix: true }) : 'Never')}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
