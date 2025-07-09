
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Music, Download, Zap, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const StatsOverview = () => {
  const [likedSongsCount, setLikedSongsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLikedSongsCount();
    
    // Set up real-time subscription for updates
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
          fetchLikedSongsCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    }
  }, []);

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
  const stats = [
    {
      title: "Liked Songs",
      value: loading ? "..." : likedSongsCount.toLocaleString(),
      icon: Music,
      color: "text-green-400",
      bgColor: "bg-green-400/10"
    },
    {
      title: "Metadata Extracted",
      value: loading ? "..." : likedSongsCount.toLocaleString(),
      icon: Download,
      color: "text-blue-400",
      bgColor: "bg-blue-400/10"
    },
    {
      title: "Make Webhooks",
      value: "0",
      icon: Zap,
      color: "text-purple-400",
      bgColor: "bg-purple-400/10"
    },
    {
      title: "Last Sync",
      value: "Just now",
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
