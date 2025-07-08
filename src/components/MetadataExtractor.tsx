
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Play, Download, ExternalLink, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  bpm: number | null;
  key: string | null;
  danceability: number | null;
  year: number | null;
  added_at: string | null;
  spotify_id: string;
}

interface MetadataExtractorProps {
  selectedTrack: SpotifyTrack | null;
}

const MetadataExtractor = ({ selectedTrack }: MetadataExtractorProps) => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const getKeyName = (key: string | null) => {
    if (!key) return 'Unknown';
    const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const keyNum = parseInt(key);
    return keys[keyNum] || 'Unknown';
  };

  const handleMakeWebhook = async () => {
    if (!webhookUrl) {
      toast({
        title: "Error",
        description: "Please enter your Make webhook URL",
        variant: "destructive",
      });
      return;
    }

    if (!selectedTrack) {
      toast({
        title: "Error",
        description: "Please select a track first",
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
          track: selectedTrack,
          timestamp: new Date().toISOString(),
          source: "serato-metadata-sync"
        }),
      });

      toast({
        title: "Webhook Triggered!",
        description: "Track metadata has been sent to Make. Check your scenario for processing.",
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
    if (!selectedTrack) {
      toast({
        title: "Error",
        description: "Please select a track first",
        variant: "destructive",
      });
      return;
    }

    const dataStr = JSON.stringify(selectedTrack, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `${selectedTrack.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-metadata.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    toast({
      title: "Export Complete",
      description: "Track metadata exported to JSON file successfully!",
    });
  };

  return (
    <div className="space-y-6">
      {/* Make Integration */}
      <Card className="glass-card border-serato-cyan/20">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-white">
            <Zap className="w-5 h-5 text-serato-cyan" />
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
                className="bg-serato-dark/30 border-serato-cyan/30 text-white placeholder-gray-400"
              />
            </div>
            <div className="flex space-x-3">
              <Button 
                onClick={handleMakeWebhook}
                disabled={isLoading}
                className="serato-gradient text-serato-dark font-medium hover:opacity-90"
              >
                <Zap className="w-4 h-4 mr-2" />
                {isLoading ? "Sending..." : "Send to Make"}
              </Button>
              <Button 
                onClick={exportToJSON}
                variant="outline" 
                className="border-serato-cyan/30 text-serato-cyan hover:bg-serato-cyan/10"
              >
                <Download className="w-4 h-4 mr-2" />
                Export JSON
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Track Details */}
      <Card className="glass-card border-serato-cyan/20">
        <CardHeader>
          <CardTitle className="text-white">Track Details</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedTrack ? (
            <div className="p-4 bg-serato-dark/20 rounded-lg border border-serato-cyan/20">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-white text-lg">{selectedTrack.title}</h3>
                  <p className="text-gray-300">{selectedTrack.artist} • {selectedTrack.album || 'Unknown Album'}</p>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="border-serato-cyan/30 text-serato-cyan hover:bg-serato-cyan/10"
                  onClick={() => window.open(`https://open.spotify.com/track/${selectedTrack.spotify_id}`, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                <div>
                  <span className="text-xs text-gray-400 block">BPM</span>
                  <span className="text-sm text-serato-cyan font-semibold">
                    {selectedTrack.bpm ? Math.round(selectedTrack.bpm) : 'Unknown'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block">Key</span>
                  <span className="text-sm text-serato-cyan font-semibold">
                    {getKeyName(selectedTrack.key)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block">Year</span>
                  <span className="text-sm text-white">{selectedTrack.year || 'Unknown'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block">Added</span>
                  <span className="text-sm text-white">
                    {selectedTrack.added_at ? new Date(selectedTrack.added_at).toLocaleDateString() : 'Unknown'}
                  </span>
                </div>
              </div>

              <div className="flex space-x-2">
                {selectedTrack.danceability && (
                  <Badge variant="outline" className="border-serato-cyan/30 text-serato-cyan">
                    Danceability: {(selectedTrack.danceability * 100).toFixed(0)}%
                  </Badge>
                )}
                <Badge variant="outline" className="border-serato-orange/30 text-serato-orange">
                  Spotify Track
                </Badge>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Select a track from the table above to view its details
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MetadataExtractor;
