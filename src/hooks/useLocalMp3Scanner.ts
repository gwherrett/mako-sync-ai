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
  file_size: number;
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
    console.log(`🚀 STARTING metadata extraction for: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`);
    
    try {
      console.log(`📊 File details:`, {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: new Date(file.lastModified).toISOString()
      });

      console.log(`🔍 About to call parseBlob for: ${file.name}`);
      
      // Try parseBlob with specific error handling
      let metadata;
      try {
        metadata = await parseBlob(file, { 
          includeChapters: false,
          skipCovers: true,
          skipPostHeaders: false 
        });
        console.log(`✅ parseBlob completed successfully for: ${file.name}`);
      } catch (parseError) {
        console.error(`❌ parseBlob FAILED for ${file.name}:`, parseError);
        throw new Error(`parseBlob failed: ${parseError.message}`);
      }
      
      // Validate metadata object structure
      if (!metadata) {
        console.error(`❌ metadata is null/undefined for: ${file.name}`);
        throw new Error('Metadata object is null or undefined');
      }
      
      console.log(`📋 Raw metadata object for "${file.name}":`, JSON.stringify(metadata, null, 2));
      
      // Check for expected properties
      console.log(`📊 Metadata validation for "${file.name}":`, {
        hasFormat: !!metadata.format,
        hasCommon: !!metadata.common,
        hasNative: !!metadata.native,
        formatKeys: metadata.format ? Object.keys(metadata.format) : [],
        commonKeys: metadata.common ? Object.keys(metadata.common) : [],
        nativeKeys: metadata.native ? Object.keys(metadata.native) : []
      });
      
      // Log available tag formats
      if (metadata.native) {
        Object.keys(metadata.native).forEach(tagFormat => {
          console.log(`🏷️  ${tagFormat} tags:`, metadata.native[tagFormat]);
        });
      }
      
      const hash = await generateFileHash(file);
      
      // Enhanced metadata extraction with multiple fallback attempts
      let title = null;
      let artist = null;
      let album = null;
      let year = null;
      let genre = null;
      
      // Primary extraction from common metadata
      if (metadata.common) {
        title = metadata.common.title || null;
        artist = metadata.common.artist || null;
        album = metadata.common.album || null;
        year = metadata.common.year || null;
        genre = metadata.common.genre?.[0] || null;
        
        console.log(`📊 Common metadata for "${file.name}":`, {
          title: metadata.common.title,
          artist: metadata.common.artist,
          album: metadata.common.album,
          year: metadata.common.year,
          genre: metadata.common.genre,
          track: metadata.common.track,
          albumartist: metadata.common.albumartist
        });
      }
      
      // Fallback: Try extracting from native tags if common is missing
      if (metadata.native && (!title || !artist || !album || !year || !genre)) {
        console.log(`🔄 Attempting fallback extraction from native tags...`);
        
        // Try ID3v2.4 first, then ID3v2.3, then ID3v1
        const tagFormats = ['ID3v2.4', 'ID3v2.3', 'ID3v1', 'vorbis'];
        
        for (const format of tagFormats) {
          if (metadata.native[format]) {
            const tags = metadata.native[format];
            console.log(`🏷️  Trying ${format} tags:`, tags);
            
            // Extract from native tags
            for (const tag of tags) {
              if (!title && (tag.id === 'TIT2' || tag.id === 'TITLE' || tag.id === 'Title')) {
                title = typeof tag.value === 'string' ? tag.value : null;
              }
              if (!artist && (tag.id === 'TPE1' || tag.id === 'ARTIST' || tag.id === 'Artist')) {
                artist = typeof tag.value === 'string' ? tag.value : null;
              }
              if (!album && (tag.id === 'TALB' || tag.id === 'ALBUM' || tag.id === 'Album')) {
                album = typeof tag.value === 'string' ? tag.value : null;
              }
              if (!year && (tag.id === 'TYER' || tag.id === 'TDRC' || tag.id === 'DATE' || tag.id === 'Date')) {
                const yearValue = typeof tag.value === 'string' ? parseInt(tag.value) : 
                                  typeof tag.value === 'number' ? tag.value : null;
                if (yearValue && !isNaN(yearValue)) {
                  year = yearValue;
                }
              }
              if (!genre && (tag.id === 'TCON' || tag.id === 'GENRE' || tag.id === 'Genre')) {
                genre = typeof tag.value === 'string' ? tag.value : null;
              }
            }
            
            // If we found some data in this format, log it
            if (title || artist || album || year || genre) {
              console.log(`✅ Found metadata in ${format}:`, { title, artist, album, year, genre });
              break;
            }
          }
        }
      }
      
      const trackData = {
        file_path: file.name,
        title,
        artist,
        album,
        year,
        genre,
        bpm: null, // Would need additional processing for BPM detection
        key: null, // Would need additional processing for key detection
        hash,
        file_size: file.size,
        last_modified: new Date(file.lastModified).toISOString(),
      };

      // Final extraction results
      console.log(`🎵 Final metadata extracted for "${file.name}":`, {
        artist: trackData.artist || '❌ MISSING',
        album: trackData.album || '❌ MISSING', 
        genre: trackData.genre || '❌ MISSING',
        year: trackData.year || '❌ MISSING',
        title: trackData.title || '❌ MISSING',
        fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        hash: trackData.hash?.substring(0, 8) + '...'
      });

      return trackData;
    } catch (error) {
      console.error(`❌ Failed to extract metadata from ${file.name}:`, error);
      
      // Return track with all metadata fields as null (no filename fallback)
      return {
        file_path: file.name,
        title: null,
        artist: null,
        album: null,
        year: null,
        genre: null,
        bpm: null,
        key: null,
        hash: await generateFileHash(file),
        file_size: file.size,
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