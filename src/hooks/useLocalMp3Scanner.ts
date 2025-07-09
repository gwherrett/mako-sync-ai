import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { parseBlob } from 'music-metadata-browser';
import { supabase } from '@/integrations/supabase/client';

interface ScannedTrack {
  file_path: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  year: number | null;
  genre: string | null;
  bpm: number | null;
  key: string | null;
  hash: string | null;
  last_modified: string;
}

export const useLocalMp3Scanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);

  // Get user on mount
  React.useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  const generateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const extractMetadata = async (file: File): Promise<ScannedTrack> => {
    try {
      const metadata = await parseBlob(file);
      const hash = await generateFileHash(file);
      
      return {
        file_path: file.name, // In real implementation, this would be the full path
        title: metadata.common.title || null,
        artist: metadata.common.artist || null,
        album: metadata.common.album || null,
        year: metadata.common.year || null,
        genre: metadata.common.genre?.[0] || null,
        bpm: null, // Would need additional processing for BPM detection
        key: null, // Would need additional processing for key detection
        hash,
        last_modified: new Date(file.lastModified).toISOString(),
      };
    } catch (error) {
      console.error(`Failed to extract metadata from ${file.name}:`, error);
      return {
        file_path: file.name,
        title: file.name.replace(/\.[^/.]+$/, ""), // Use filename without extension as fallback
        artist: null,
        album: null,
        year: null,
        genre: null,
        bpm: null,
        key: null,
        hash: await generateFileHash(file),
        last_modified: new Date(file.lastModified).toISOString(),
      };
    }
  };

  const scanLocalFiles = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to scan local files.",
        variant: "destructive",
      });
      return;
    }

    // Check if we're in an iframe (like Lovable preview)
    if (window.self !== window.top) {
      toast({
        title: "Preview Limitation",
        description: "File picker doesn't work in preview. Please open your deployed app in a new tab to test local file scanning.",
        variant: "destructive",
      });
      return;
    }

    // Check if File System Access API is supported
    if (!('showDirectoryPicker' in window)) {
      toast({
        title: "Browser Not Supported",
        description: "Your browser doesn't support the File System Access API. Please use Chrome, Edge, or another Chromium-based browser.",
        variant: "destructive",
      });
      return;
    }

    setIsScanning(true);
    setScanProgress({ current: 0, total: 0 });
    
    try {
      // Let user select a directory
      const dirHandle = await (window as any).showDirectoryPicker({
        mode: 'read'
      });

      toast({
        title: "Scan Started",
        description: `Scanning directory: ${dirHandle.name}`,
      });

      const mp3Files: File[] = [];
      
      // Recursively collect MP3 files
      const collectMP3Files = async (dirHandle: any, path = '') => {
        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.mp3')) {
            const file = await entry.getFile();
            mp3Files.push(file);
          } else if (entry.kind === 'directory') {
            await collectMP3Files(entry, `${path}/${entry.name}`);
          }
        }
      };

      await collectMP3Files(dirHandle);
      
      if (mp3Files.length === 0) {
        toast({
          title: "No MP3 Files Found",
          description: "No MP3 files were found in the selected directory.",
          variant: "destructive",
        });
        return;
      }

      setScanProgress({ current: 0, total: mp3Files.length });

      const scannedTracks: ScannedTrack[] = [];
      
      // Process files in batches
      const batchSize = 5;
      for (let i = 0; i < mp3Files.length; i += batchSize) {
        const batch = mp3Files.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (file, index) => {
            const track = await extractMetadata(file);
            setScanProgress({ current: i + index + 1, total: mp3Files.length });
            return track;
          })
        );
        scannedTracks.push(...batchResults);
      }

      // Insert tracks into database
      const { error } = await supabase
        .from('local_mp3s')
        .insert(scannedTracks);

      if (error) {
        throw error;
      }

      toast({
        title: "Scan Complete",
        description: `Successfully scanned ${scannedTracks.length} MP3 files.`,
      });

    } catch (error: any) {
      console.error('Scan error:', error);
      toast({
        title: "Scan Failed",
        description: error.message || "Failed to scan local files.",
        variant: "destructive",
      });
    } finally {
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