
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Music, Download, Zap, Clock } from 'lucide-react';

const StatsOverview = () => {
  const stats = [
    {
      title: "Liked Songs",
      value: "1,247",
      icon: Music,
      color: "text-green-400",
      bgColor: "bg-green-400/10"
    },
    {
      title: "Extracted",
      value: "892",
      icon: Download,
      color: "text-blue-400",
      bgColor: "bg-blue-400/10"
    },
    {
      title: "Make Webhooks",
      value: "3",
      icon: Zap,
      color: "text-purple-400",
      bgColor: "bg-purple-400/10"
    },
    {
      title: "Last Sync",
      value: "2h ago",
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
