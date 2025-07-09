import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { scanDirectoryForMP3s } from '@/services/fileScanner';
import { extractMetadataBatch, ScannedTrack } from '@/services/metadataExtractor';

export const useLocalMp3Scanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);

  // Get user on mount
  React.useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  const scanLocalFiles = async () => {
    console.log('🎯 SCAN STARTED: scanLocalFiles function called');
    
    if (!user) {
      console.log('❌ No user found, aborting scan');
      toast({
        title: "Authentication Required",
        description: "Please sign in to scan local files.",
        variant: "destructive",
      });
      return;
    }

    console.log('✅ All checks passed, proceeding with scan');
    setIsScanning(true);
    setScanProgress({ current: 0, total: 0 });
    
    try {
      // Scan directory for MP3 files
      const mp3Files = await scanDirectoryForMP3s();
      
      toast({
        title: "Scan Started",
        description: `Found ${mp3Files.length} MP3 files. Extracting metadata...`,
      });

      setScanProgress({ current: 0, total: mp3Files.length });

      // Extract metadata from all files
      const scannedTracks = await extractMetadataBatch(
        mp3Files,
        (current, total) => setScanProgress({ current, total })
      );

      console.log(`💾 Inserting ${scannedTracks.length} tracks into database...`);
      
      // Insert tracks into database
      const { error } = await supabase
        .from('local_mp3s')
        .insert(scannedTracks);

      if (error) {
        console.error('❌ Database insertion error:', error);
        throw error;
      }

      console.log('✅ Database insertion successful');
      toast({
        title: "Scan Complete",
        description: `Successfully scanned ${scannedTracks.length} MP3 files.`,
      });

    } catch (error: any) {
      console.error('❌ Scan error:', error);
      toast({
        title: "Scan Failed",
        description: error.message || "Failed to scan local files.",
        variant: "destructive",
      });
    } finally {
      console.log('🏁 Scan process finished, cleaning up...');
      setIsScanning(false);
      setScanProgress({ current: 0, total: 0 });
    }
  };

  return {
    isScanning,
    scanLocalFiles,
    scanProgress,
  };
};