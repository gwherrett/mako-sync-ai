
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Music, Database, RefreshCw, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

const StatsOverview = () => {
  const [likedSongsCount, setLikedSongsCount] = useState<number>(0);
  const [localFilesCount, setLocalFilesCount] = useState<number>(0);
  const [lastSpotifySync, setLastSpotifySync] = useState<string | null>(null);
  const [lastLocalSync, setLastLocalSync] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInitialData();
    setupRealtimeSubscription();

    return () => {
      supabase.removeChannel('schema-db-changes');
    };
  }, []);

  const fetchInitialData = async () => {
    await fetchLikedSongsCount();
    await fetchLocalFilesCount();
    await fetchLastSpotifySync();
    await fetchLastLocalSync();
  };

  const setupRealtimeSubscription = () => {
    supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'spotify_liked'
        },
        () => {
          fetchLikedSongsCount();
          fetchLastSpotifySync();
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
          fetchLocalFilesCount();
          fetchLastLocalSync();
        }
      )
      .subscribe();
  };

  const fetchLikedSongsCount = async () => {
    try {
      const { count, error } = await supabase
        .from('spotify_liked')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error('Error fetching liked songs count:', error);
        return;
      }

      setLikedSongsCount(count || 0);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLocalFilesCount = async () => {
    try {
      const { count, error } = await supabase
        .from('local_mp3s')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error('Error fetching local files count:', error);
        return;
      }

      setLocalFilesCount(count || 0);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLastSpotifySync = async () => {
    try {
      const { data, error } = await supabase
        .from('spotify_liked')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error fetching last Spotify sync:', error);
        return;
      }

      if (data && data.length > 0) {
        setLastSpotifySync(data[0].created_at);
      } else {
        setLastSpotifySync(null);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLastLocalSync = async () => {
    try {
      const { data, error } = await supabase
        .from('local_mp3s')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error fetching last local sync:', error);
        return;
      }

      if (data && data.length > 0) {
        setLastLocalSync(data[0].created_at);
      } else {
        setLastLocalSync(null);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    {
      title: "Liked Songs",
      value: loading ? "..." : likedSongsCount.toLocaleString(),
      icon: Music,
      color: "text-green-400",
      bgColor: "bg-green-400/10"
    },
    {
      title: "Last Spotify Sync",
      value: loading ? "..." : (lastSpotifySync ? formatDistanceToNow(new Date(lastSpotifySync), { addSuffix: true }) : "Never"),
      icon: RefreshCw,
      color: "text-blue-400",
      bgColor: "bg-blue-400/10"
    },
    {
      title: "Local Files",
      value: loading ? "..." : localFilesCount.toLocaleString(),
      icon: Database,
      color: "text-purple-400",
      bgColor: "bg-purple-400/10"
    },
    {
      title: "Last Local Sync",
      value: loading ? "..." : (lastLocalSync ? formatDistanceToNow(new Date(lastLocalSync), { addSuffix: true }) : "Never"),
      icon: Clock,
      color: "text-orange-400",
      bgColor: "bg-orange-400/10"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => (
        <Card key={index} className="glass-card border-white/10 hover:border-white/20 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">{stat.title}</CardTitle>
            <div className={`p-2 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default StatsOverview;
