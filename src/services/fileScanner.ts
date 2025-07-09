/**
 * Service for scanning directories and collecting MP3 files
 */

export interface ScanOptions {
  onProgress?: (current: number, total: number) => void;
}

/**
 * Shows directory picker and collects all MP3 files recursively
 */
export const scanDirectoryForMP3s = async (options?: ScanOptions): Promise<File[]> => {
  // Check if File System Access API is supported
  if (!('showDirectoryPicker' in window)) {
    throw new Error("Your browser doesn't support the File System Access API. Please use Chrome, Edge, or another Chromium-based browser.");
  }

  // Check if we're in an iframe (like Lovable preview)
  if (window.self !== window.top) {
    throw new Error("File picker doesn't work in preview. Please open your deployed app in a new tab to test local file scanning.");
  }

  console.log('📂 About to show directory picker');
  
  // Let user select a directory
  const dirHandle = await (window as any).showDirectoryPicker({
    mode: 'read'
  });

  console.log(`📁 Directory selected: ${dirHandle.name}`);

  const mp3Files: File[] = [];
  
  // Recursively collect MP3 files
  const collectMP3Files = async (dirHandle: any, path = '') => {
    console.log(`🔍 Collecting files from: ${path || 'root'}`);
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.mp3')) {
        const file = await entry.getFile();
        console.log(`🎵 Found MP3: ${entry.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`);
        mp3Files.push(file);
        
        // Report progress if callback provided
        if (options?.onProgress) {
          options.onProgress(mp3Files.length, mp3Files.length);
        }
      } else if (entry.kind === 'directory') {
        await collectMP3Files(entry, `${path}/${entry.name}`);
      }
    }
  };

  await collectMP3Files(dirHandle);
  
  console.log(`📊 Total MP3 files found: ${mp3Files.length}`);
  
  if (mp3Files.length === 0) {
    throw new Error("No MP3 files were found in the selected directory.");
  }

  return mp3Files;
};