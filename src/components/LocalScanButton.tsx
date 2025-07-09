import React from 'react';
import { Loader2, FolderSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocalMp3Scanner } from '@/hooks/useLocalMp3Scanner';

const LocalScanButton = () => {
  const { isScanning, scanLocalFiles, scanProgress } = useLocalMp3Scanner();

  return (
    <Button 
      onClick={scanLocalFiles}
      disabled={isScanning}
      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 transition-colors shadow-lg"
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
  );
};

export default LocalScanButton;