
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
      <Card className="glass-card border-expos-blue/20">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-gray-900">
            <Zap className="w-5 h-5 text-expos-blue" />
            <span>Make Integration</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Make Webhook URL
              </label>
              <Input
                placeholder="https://hook.integromat.com/your-webhook-url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="bg-white border-gray-300 text-gray-900 placeholder-gray-500"
              />
            </div>
            <div className="flex space-x-3">
              <Button 
                onClick={handleMakeWebhook}
                disabled={isLoading || !selectedTrack}
                className="expos-gradient text-white font-medium hover:opacity-90"
              >
                <Zap className="w-4 h-4 mr-2" />
                {isLoading ? "Sending..." : "Send to Make"}
              </Button>
              <Button 
                onClick={exportToJSON}
                disabled={!selectedTrack}
                variant="outline" 
                className="border-expos-blue/30 text-expos-blue hover:bg-expos-blue/10"
              >
                <Download className="w-4 h-4 mr-2" />
                Export JSON
              </Button>
            </div>
            {!selectedTrack && (
              <p className="text-sm text-gray-500">Select a track to enable Make integration and export</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MetadataExtractor;
