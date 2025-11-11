import React from 'react';
import { FolderSearch, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLocalScanner } from '@/hooks/useLocalScanner';

const FileUploadScanner = () => {
  const { isScanning, scanLocalFiles, scanProgress } = useLocalScanner();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderSearch className="w-5 h-5" />
          Scan Local Music Files
        </CardTitle>
        <CardDescription>
          Scan your computer's music folder to import all MP3 files automatically
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={scanLocalFiles}
          disabled={isScanning}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg"
        >
          {isScanning ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {scanProgress.total > 0 
                ? `Scanning... ${scanProgress.current}/${scanProgress.total}`
                : 'Scanning...'
              }
            </>
          ) : (
            <>
              <FolderSearch className="w-4 h-4 mr-2" />
              Scan Local Files
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default FileUploadScanner;