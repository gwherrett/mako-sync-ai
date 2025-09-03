import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { scanDirectoryForLocalFiles } from '@/services/fileScanner';
import { extractMetadataBatch, ScannedTrack } from '@/services/metadataExtractor';

export const useLocalScanner = () => {
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
      // Scan directory for local files
      const localFiles = await scanDirectoryForLocalFiles();
      
      toast({
        title: "Scan Started",
        description: `Found ${localFiles.length} local files. Extracting metadata...`,
      });

      setScanProgress({ current: 0, total: localFiles.length });

      // Extract metadata from all files
      const scannedTracks = await extractMetadataBatch(
        localFiles,
        (current, total) => setScanProgress({ current, total })
      );

      console.log(`💾 Inserting ${scannedTracks.length} tracks into database...`);
      
      // Add user_id to each track before inserting
      const tracksWithUserId = scannedTracks.map(track => ({
        ...track,
        user_id: user.id
      }));
      
      // Insert tracks into database using upsert to handle duplicates
      const { error } = await supabase
        .from('local_mp3s')
        .upsert(tracksWithUserId, { 
          onConflict: 'hash',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error('❌ Database insertion error:', error);
        throw error;
      }

      console.log('✅ Database insertion successful');
      toast({
        title: "Scan Complete",
        description: `Successfully scanned ${scannedTracks.length} local files.`,
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