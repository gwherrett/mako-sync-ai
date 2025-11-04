import React, { useState, useRef } from 'react';
import { Upload, X, Music, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { extractMetadataBatch, ScannedTrack } from '@/services/metadataExtractor';

const FileUploadScanner = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [user, setUser] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Get user on mount
  React.useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const mp3Files = files.filter(file => file.name.toLowerCase().endsWith('.mp3'));
    
    if (mp3Files.length !== files.length) {
      toast({
        title: "Invalid Files",
        description: `${files.length - mp3Files.length} non-MP3 files were filtered out.`,
        variant: "destructive",
      });
    }
    
    setSelectedFiles(mp3Files);
    
    if (mp3Files.length > 0) {
      toast({
        title: "Files Selected",
        description: `Selected ${mp3Files.length} MP3 file${mp3Files.length > 1 ? 's' : ''} for upload.`,
      });
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(files => files.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadAndProcess = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to upload test files.",
        variant: "destructive",
      });
      return;
    }

    if (selectedFiles.length === 0) {
      toast({
        title: "No Files Selected",
        description: "Please select MP3 files to upload.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress({ current: 0, total: selectedFiles.length });

    try {
      toast({
        title: "Processing Started",
        description: `Processing ${selectedFiles.length} test files...`,
      });

      // Extract metadata from uploaded files
      const scannedTracks = await extractMetadataBatch(
        selectedFiles,
        (current, total) => setUploadProgress({ current, total })
      );

      console.log(`💾 Inserting ${scannedTracks.length} test tracks into database...`);
      
      // Import normalization on the fly
      const { NormalizationService } = await import('@/services/normalization.service');
      const normalizer = new NormalizationService();
      
      // Add user_id and normalize each track before inserting
      const tracksWithUserId = scannedTracks.map(track => {
        const normalized = normalizer.processMetadata(track.title, track.artist);
        return {
          ...track,
          user_id: user.id,
          file_path: `[TEST] ${track.file_path}`, // Mark as test data
          normalized_title: normalized.normalizedTitle,
          normalized_artist: normalized.normalizedArtist,
          core_title: normalized.coreTitle,
          primary_artist: normalized.primaryArtist,
          featured_artists: normalized.featuredArtists,
          mix: normalized.mix,
        };
      });
      
      console.log('🔄 Tracks normalized during upload');
      
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
      
      console.log(`💾 Inserting ${uniqueTracks.length} unique tracks (${tracksWithUserId.length - uniqueTracks.length} duplicates removed)...`);
      
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

      console.log('✅ Test data insertion successful');
      toast({
        title: "Upload Complete",
        description: `Successfully processed ${scannedTracks.length} test files.`,
      });

      // Clear selected files after successful upload
      clearAllFiles();

    } catch (error: any) {
      console.error('❌ Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to process test files.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress({ current: 0, total: 0 });
    }
  };

  const deleteAllTestData = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to delete test data.",
        variant: "destructive",
      });
      return;
    }

    try {
      // First, count how many test tracks exist
      const { count } = await supabase
        .from('local_mp3s')
        .select('*', { count: 'exact', head: true })
        .like('file_path', '[TEST]%');

      if (count === 0) {
        toast({
          title: "No Test Data",
          description: "There are no test tracks to delete.",
        });
        return;
      }

      // Delete all tracks with [TEST] prefix
      const { error } = await supabase
        .from('local_mp3s')
        .delete()
        .like('file_path', '[TEST]%');

      if (error) {
        console.error('❌ Delete error:', error);
        throw error;
      }

      toast({
        title: "Success",
        description: `Deleted ${count} test track${count > 1 ? 's' : ''}.`,
      });

    } catch (error: any) {
      console.error('❌ Delete all test data error:', error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete test data.",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(1);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Test Data Upload
            </CardTitle>
            <CardDescription>
              Upload MP3 files for testing metadata extraction and sync functionality
            </CardDescription>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete All Test Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete All Test Data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all tracks with [TEST] prefix from your library. 
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={deleteAllTestData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              disabled={isUploading}
            >
              <Music className="w-4 h-4 mr-2" />
              Select MP3 Files
            </Button>
            
            {selectedFiles.length > 0 && (
              <Button
                onClick={clearAllFiles}
                variant="outline"
                size="sm"
                disabled={isUploading}
              >
                <X className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected 
                ({selectedFiles.reduce((acc, file) => acc + file.size, 0) / (1024 * 1024) | 0} MB total)
              </div>
              
              <div className="max-h-40 overflow-y-auto space-y-1">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                  >
                    <span className="truncate flex-1">
                      {file.name} ({formatFileSize(file.size)} MB)
                    </span>
                    <Button
                      onClick={() => removeFile(index)}
                      variant="ghost"
                      size="sm"
                      disabled={isUploading}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedFiles.length > 0 && (
            <Button
              onClick={uploadAndProcess}
              disabled={isUploading}
              className="w-full"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {uploadProgress.total > 0 
                    ? `Processing... ${uploadProgress.current}/${uploadProgress.total}`
                    : 'Processing...'
                  }
                </>
              ) : (
                `Process ${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''}`
              )}
            </Button>
          )}
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Upload MP3 files to test metadata extraction and sync functionality</p>
          <p>• Test files will be marked with [TEST] prefix in the database</p>
          <p>• Use this for sanity checks with smaller datasets</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default FileUploadScanner;