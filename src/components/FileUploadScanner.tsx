import React, { useState, useRef } from 'react';
import { Upload, X, Music, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
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
      
      // Add user_id to each track before inserting
      const tracksWithUserId = scannedTracks.map(track => ({
        ...track,
        user_id: user.id,
        file_path: `[TEST] ${track.file_path}` // Mark as test data
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

  const formatFileSize = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(1);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Test Data Upload
        </CardTitle>
        <CardDescription>
          Upload MP3 files for testing metadata extraction and sync functionality
        </CardDescription>
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