import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { scanDirectoryForLocalFiles } from '@/services/fileScanner';
import { extractMetadataBatch, ScannedTrack } from '@/services/metadataExtractor';

export const useLocalScanner = (onScanComplete?: () => void) => {
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
      
      // Import normalization
      const { NormalizationService } = await import('@/services/normalization.service');
      const normalizer = new NormalizationService();
      
      // Add user_id and normalize each track before inserting
      const tracksWithUserId = scannedTracks.map(track => {
        const normalized = normalizer.processMetadata(track.title, track.artist);
        return {
          ...track,
          user_id: user.id,
          normalized_title: normalized.normalizedTitle,
          normalized_artist: normalized.normalizedArtist,
          core_title: normalized.coreTitle,
          version_info: normalized.versionInfo,
          primary_artist: normalized.primaryArtist,
          featured_artists: normalized.featuredArtists,
          mix: normalized.mix,
        };
      });
      
      console.log('🔄 Tracks normalized during scan');
      
      // Deduplicate by hash to avoid "ON CONFLICT DO UPDATE command cannot affect row a second time" error
      const uniqueTracks = tracksWithUserId.reduce((acc, track) => {
        if (track.hash && !acc.some(existing => existing.hash === track.hash)) {
          acc.push(track);
        } else if (!track.hash) {
          // Keep tracks without hash (they'll be handled by database constraints)
          acc.push(track);
        }
        return acc;
      }, [] as typeof tracksWithUserId);
      
      console.log(`💾 Inserting ${uniqueTracks.length} unique tracks (${scannedTracks.length - uniqueTracks.length} duplicates removed)...`);
      
      // Insert tracks into database using upsert to handle duplicates
      const { error } = await supabase
        .from('local_mp3s')
        .upsert(uniqueTracks, { 
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

      // Trigger refresh callback
      if (onScanComplete) {
        onScanComplete();
      }

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