import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Music, Database, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

// Add debounce helper
let fetchDebounceTimer: NodeJS.Timeout | null = null;

const debouncedFetch = (fn: () => void, delay: number = 1000) => {
  if (fetchDebounceTimer) clearTimeout(fetchDebounceTimer);
  fetchDebounceTimer = setTimeout(fn, delay);
};

export const StatsOverview = () => {
  const [likedSongsCount, setLikedSongsCount] = useState<number>(0);
  const [localFilesCount, setLocalFilesCount] = useState<number>(0);
  const [lastSpotifySync, setLastSpotifySync] = useState<string | null>(null);
  const [lastLocalSync, setLastLocalSync] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInitialData();
    const channel = setupRealtimeSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const fetchInitialData = async () => {
    await fetchLikedSongsCount();
    await fetchLocalFilesCount();
    await fetchLastSpotifySync();
    await fetchLastLocalSync();
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

  const fetchLikedSongsCount = async () => {
    try {
      console.log('📊 StatsOverview: Fetching liked songs count...');
      
      // Get current session to ensure proper auth context
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('📊 StatsOverview: Current session for liked songs:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id,
        sessionError: sessionError?.message
      });
      
      if (!session?.user) {
        console.log('❌ StatsOverview: No session for liked songs count');
        setLikedSongsCount(0);
        return;
      }
      
      const user = session.user;
      
      const { count, error } = await supabase
        .from('spotify_liked')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      console.log('📊 StatsOverview: Liked songs count result:', { count, error: error?.message });

      if (error) {
        console.error('❌ StatsOverview: Error fetching liked songs count:', error);
        return;
      }

      setLikedSongsCount(count || 0);
    } catch (error) {
      console.error('💥 StatsOverview: Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLocalFilesCount = async () => {
    try {
      console.log('📊 StatsOverview: Fetching local files count...');
      
      // Get current session to ensure proper auth context
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('📊 StatsOverview: Current session for local files:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id,
        sessionError: sessionError?.message
      });
      
      if (!session?.user) {
        console.log('❌ StatsOverview: No session for local files count');
        setLocalFilesCount(0);
        return;
      }
      
      const user = session.user;
      
      const { count, error } = await supabase
        .from('local_mp3s')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

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

  const fetchLastSpotifySync = async () => {
    try {
      // Get current session to ensure proper auth context
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setLastSpotifySync(null);
        return;
      }
      
      const user = session.user;
      
      const { data, error } = await supabase
        .from('spotify_liked')
        .select('created_at')
        .eq('user_id', user.id)
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

  const fetchLastLocalSync = async () => {
    try {
      // Get current session to ensure proper auth context
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setLastLocalSync(null);
        return;
      }
      
      const user = session.user;
      
      const { data, error } = await supabase
        .from('local_mp3s')
        .select('created_at')
        .eq('user_id', user.id)
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
