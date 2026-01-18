import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { scanDirectoryForLocalFiles } from '@/services/fileScanner';
import { extractMetadataBatch } from '@/services/metadataExtractor';
import { withTimeout } from '@/utils/promiseUtils';

const DB_UPSERT_TIMEOUT_MS = 120000; // 120 seconds per batch for database operations
const DB_BATCH_SIZE = 50; // Insert 50 tracks at a time to avoid timeouts

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

      // Insert tracks in batches to avoid timeout on large collections
      const totalBatches = Math.ceil(uniqueTracks.length / DB_BATCH_SIZE);
      let insertedCount = 0;

      for (let i = 0; i < uniqueTracks.length; i += DB_BATCH_SIZE) {
        const batch = uniqueTracks.slice(i, i + DB_BATCH_SIZE);
        const batchNumber = Math.floor(i / DB_BATCH_SIZE) + 1;

        console.log(`📦 Inserting batch ${batchNumber}/${totalBatches} (${batch.length} tracks)...`);

        const upsertPromise = supabase
          .from('local_mp3s')
          .upsert(batch, {
            onConflict: 'hash',
            ignoreDuplicates: false
          });

        const result = await withTimeout(
          Promise.resolve(upsertPromise),
          DB_UPSERT_TIMEOUT_MS,
          `Database upsert batch ${batchNumber} timed out after ${DB_UPSERT_TIMEOUT_MS / 1000}s`
        );

        if (result.error) {
          console.error(`❌ Database insertion error (batch ${batchNumber}):`, result.error);
          throw result.error;
        }

        insertedCount += batch.length;
        console.log(`✅ Batch ${batchNumber}/${totalBatches} complete (${insertedCount}/${uniqueTracks.length} total)`);
      }

      console.log('✅ All database insertions successful');
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