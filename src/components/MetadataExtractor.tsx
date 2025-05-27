
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Play, Download, ExternalLink, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const MetadataExtractor = () => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Mock data for demonstration
  const mockSongs = [
    {
      id: 1,
      title: "Bohemian Rhapsody",
      artist: "Queen",
      album: "A Night at the Opera",
      duration: "5:55",
      bpm: 72,
      key: "Bb Major",
      energy: 0.7,
      danceability: 0.6
    },
    {
      id: 2,
      title: "Billie Jean",
      artist: "Michael Jackson",
      album: "Thriller",
      duration: "4:54",
      bpm: 117,
      key: "F# Minor",
      energy: 0.8,
      danceability: 0.9
    },
    {
      id: 3,
      title: "Hotel California",
      artist: "Eagles",
      album: "Hotel California",
      duration: "6:30",
      bpm: 75,
      key: "B Minor",
      energy: 0.6,
      danceability: 0.4
    }
  ];

  const handleMakeWebhook = async () => {
    if (!webhookUrl) {
      toast({
        title: "Error",
        description: "Please enter your Make webhook URL",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    console.log("Triggering Make webhook:", webhookUrl);

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        mode: "no-cors",
        body: JSON.stringify({
          songs: mockSongs,
          timestamp: new Date().toISOString(),
          source: "spotify-metadata-sync",
          total_songs: mockSongs.length
        }),
      });

      toast({
        title: "Webhook Triggered!",
        description: "Song metadata has been sent to Make. Check your scenario for processing.",
      });
    } catch (error) {
      console.error("Error triggering webhook:", error);
      toast({
        title: "Error",
        description: "Failed to trigger the Make webhook. Please check the URL and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const exportToJSON = () => {
    const dataStr = JSON.stringify(mockSongs, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'spotify-metadata.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    toast({
      title: "Export Complete",
      description: "Metadata exported to JSON file successfully!",
    });
  };

  return (
    <div className="space-y-6">
      {/* Make Integration */}
      <Card className="glass-card border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-white">
            <Zap className="w-5 h-5 text-purple-400" />
            <span>Make Integration</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                Make Webhook URL
              </label>
              <Input
                placeholder="https://hook.integromat.com/your-webhook-url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="bg-white/5 border-white/20 text-white placeholder-gray-400"
              />
            </div>
            <div className="flex space-x-3">
              <Button 
                onClick={handleMakeWebhook}
                disabled={isLoading}
                className="spotify-gradient text-black font-medium hover:opacity-90"
              >
                <Zap className="w-4 h-4 mr-2" />
                {isLoading ? "Sending..." : "Send to Make"}
              </Button>
              <Button 
                onClick={exportToJSON}
                variant="outline" 
                className="border-white/20 text-white hover:bg-white/10"
              >
                <Download className="w-4 h-4 mr-2" />
                Export JSON
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Songs List */}
      <Card className="glass-card border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Extracted Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockSongs.map((song) => (
              <div key={song.id} className="p-4 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition-all duration-300">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-white text-lg">{song.title}</h3>
                    <p className="text-gray-300">{song.artist} • {song.album}</p>
                  </div>
                  <Button size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10">
                    <Play className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                  <div>
                    <span className="text-xs text-gray-400 block">Duration</span>
                    <span className="text-sm text-white">{song.duration}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">BPM</span>
                    <span className="text-sm text-white">{song.bpm}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Key</span>
                    <span className="text-sm text-white">{song.key}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Energy</span>
                    <span className="text-sm text-white">{(song.energy * 100).toFixed(0)}%</span>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Badge variant="outline" className="border-green-400/30 text-green-400">
                    Danceability: {(song.danceability * 100).toFixed(0)}%
                  </Badge>
                  <Badge variant="outline" className="border-blue-400/30 text-blue-400">
                    Serato Ready
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MetadataExtractor;
