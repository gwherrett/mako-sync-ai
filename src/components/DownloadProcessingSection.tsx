/**
 * DownloadProcessingSection Component
 *
 * Processes downloaded MP3 files from slskd:
 * - Folder selection via webkitdirectory input
 * - Extracts metadata and maps genres to SuperGenre
 * - Inline genre mapping for unmapped genres
 * - Saves new mappings to spotify_genre_map_overrides
 *
 * Tag writing (TXXX:CUSTOM1) is deferred to a future update.
 */

import { useState, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FolderOpen,
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Music,
} from 'lucide-react';
import { useDownloadProcessor } from '@/hooks/useDownloadProcessor';
import { useSlskdConfig } from '@/hooks/useSlskdConfig';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SUPER_GENRES } from '@/types/genreMapping';
import type { ProcessedFile } from '@/types/slskd';

// Extend input element to support webkitdirectory
declare module 'react' {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}

export function DownloadProcessingSection() {
  const { toast } = useToast();
  const { config } = useSlskdConfig();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savingGenre, setSavingGenre] = useState<string | null>(null);

  const {
    processFiles,
    reprocessFiles,
    reset,
    result,
    progress,
    isProcessing,
    isGenreMapLoading,
    refetchGenreMap,
    updateFileSuperGenre,
  } = useDownloadProcessor();

  // Handle folder selection
  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    await processFiles(files);

    // Reset input so same folder can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Save a new genre mapping and update the file
  const handleSaveMapping = async (
    file: ProcessedFile,
    superGenre: string
  ) => {
    if (file.genres.length === 0) return;

    const genreToMap = file.genres[0]; // Use first genre for mapping
    setSavingGenre(genreToMap);

    try {
      // Call the genre-mapping edge function to save the override
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/genre-mapping`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.session.access_token}`,
          },
          body: JSON.stringify({
            spotify_genre: genreToMap,
            super_genre: superGenre,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save mapping');
      }

      // Update local state immediately
      updateFileSuperGenre(file.filename, superGenre);

      // Refetch genre map so future files use the new mapping
      await refetchGenreMap();

      toast({
        title: 'Mapping Saved',
        description: `"${genreToMap}" → ${superGenre}`,
      });
    } catch (error) {
      console.error('Failed to save genre mapping:', error);
      toast({
        title: 'Failed to Save Mapping',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSavingGenre(null);
    }
  };

  // Get status badge variant
  const getStatusBadge = (status: ProcessedFile['status']) => {
    switch (status) {
      case 'mapped':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Mapped
          </Badge>
        );
      case 'unmapped':
        return (
          <Badge variant="secondary" className="bg-yellow-500 text-white">
            <AlertCircle className="h-3 w-3 mr-1" />
            Unmapped
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
    }
  };

  const progressPercent = progress
    ? (progress.current / progress.total) * 100
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          Process Downloads
        </CardTitle>
        <CardDescription>
          Scan downloaded files from slskd, map genres to SuperGenre for
          organizing in MediaMonkey.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Downloads folder info */}
        {config.downloadsFolder && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Configured downloads folder:{' '}
              <code className="bg-muted px-1 rounded">{config.downloadsFolder}</code>
              <br />
              <span className="text-xs text-muted-foreground">
                Select this folder below to process downloaded files.
              </span>
            </AlertDescription>
          </Alert>
        )}

        {/* Folder selection */}
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <Input
              ref={fileInputRef}
              type="file"
              webkitdirectory=""
              directory=""
              multiple
              onChange={handleFolderSelect}
              disabled={isProcessing || isGenreMapLoading}
              className="max-w-md"
            />
            {result && (
              <Button variant="outline" size="sm" onClick={reset}>
                Clear Results
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Select your slskd downloads folder. All MP3 files (including
            subfolders) will be scanned.
          </p>
        </div>

        {/* Processing progress */}
        {isProcessing && progress && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">
                Processing {progress.current} of {progress.total}...
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            <p className="text-xs text-muted-foreground truncate">
              {progress.currentFile}
            </p>
          </div>
        )}

        {/* Genre map loading */}
        {isGenreMapLoading && !isProcessing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading genre mappings...
          </div>
        )}

        {/* Results */}
        {result && (
          <>
            {/* Summary */}
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Music className="h-4 w-4" />
                <span>Total: {result.summary.total}</span>
              </div>
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>Mapped: {result.summary.mapped}</span>
              </div>
              <div className="flex items-center gap-2 text-yellow-600">
                <AlertCircle className="h-4 w-4" />
                <span>Unmapped: {result.summary.unmapped}</span>
              </div>
              <div className="flex items-center gap-2 text-red-600">
                <XCircle className="h-4 w-4" />
                <span>Errors: {result.summary.errors}</span>
              </div>
              {result.summary.unmapped > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reprocessFiles}
                  className="ml-auto"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Re-check Mappings
                </Button>
              )}
            </div>

            {/* Unmapped genres alert */}
            {result.unmappedGenres.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <span className="font-medium">
                    {result.unmappedGenres.length} unmapped genre(s):
                  </span>{' '}
                  {result.unmappedGenres.slice(0, 5).join(', ')}
                  {result.unmappedGenres.length > 5 &&
                    ` and ${result.unmappedGenres.length - 5} more`}
                  <br />
                  <span className="text-xs">
                    Use the dropdown below to assign SuperGenres. Mappings are
                    saved for future use.
                  </span>
                </AlertDescription>
              </Alert>
            )}

            {/* Files table */}
            {result.files.length > 0 && (
              <div className="border rounded-lg max-h-96 overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-[300px]">Track</TableHead>
                      <TableHead>ID3 Genre(s)</TableHead>
                      <TableHead>SuperGenre</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.files.map((file) => (
                      <TableRow key={file.filename}>
                        <TableCell>
                          <div className="font-medium truncate max-w-[280px]">
                            {file.artist} - {file.title}
                          </div>
                          {file.album && (
                            <div className="text-xs text-muted-foreground truncate">
                              {file.album}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {file.genres.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {file.genres.map((genre, idx) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {genre}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              No genre tag
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {file.status === 'mapped' && file.superGenre ? (
                            <Badge>{file.superGenre}</Badge>
                          ) : file.status === 'unmapped' ? (
                            <Select
                              onValueChange={(value) =>
                                handleSaveMapping(file, value)
                              }
                              disabled={
                                savingGenre === file.genres[0] ||
                                file.genres.length === 0
                              }
                            >
                              <SelectTrigger className="w-36 h-8">
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
                              <SelectContent>
                                {[...SUPER_GENRES].sort().map((sg) => (
                                  <SelectItem key={sg} value={sg}>
                                    {sg}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : file.status === 'error' ? (
                            <span
                              className="text-xs text-destructive truncate"
                              title={file.error}
                            >
                              {file.error}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(file.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* MediaMonkey instructions */}
            <p className="text-sm text-muted-foreground">
              After reviewing, use MediaMonkey to organize files into your
              Supercrates/[genre]/ folders, then re-scan in Mako Sync.
            </p>
          </>
        )}

        {/* Empty state */}
        {!result && !isProcessing && (
          <div className="text-center py-8 text-muted-foreground">
            <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Select your slskd downloads folder to process files.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
