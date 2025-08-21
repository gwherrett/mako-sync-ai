import { toast } from "@/hooks/use-toast";

export interface OpenLinkOptions {
  url: string;
  onFallback?: () => void;
}

/**
 * Attempts to open a link in a new tab with multiple fallback strategies
 */
export const openInNewTab = async ({ url, onFallback }: OpenLinkOptions): Promise<boolean> => {
  try {
    // Strategy 1: Direct window.open
    const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
    
    // Check if window.open was blocked
    if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
      // Strategy 2: Create and click anchor element
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      
      // Temporarily add to DOM and click
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      
      // If we reach here and popup was likely blocked, use fallback
      setTimeout(() => {
        // Strategy 3: Copy to clipboard and notify user
        copyToClipboard(url);
        onFallback?.();
        
        toast({
          title: "Pop-up Blocked",
          description: "Link copied to clipboard! You can paste it in a new tab.",
          variant: "default",
        });
      }, 100);
      
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Failed to open link:', error);
    
    // Fallback: Copy to clipboard
    copyToClipboard(url);
    onFallback?.();
    
    toast({
      title: "Unable to Open Link",
      description: "Link copied to clipboard! You can paste it in a new tab.",
      variant: "destructive",
    });
    
    return false;
  }
};

/**
 * Copy text to clipboard with fallback support
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    // Modern approach
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    return success;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
};

/**
 * Detect if the app is running inside an iframe
 */
export const isInIframe = (): boolean => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true; // If we can't access window.top, we're likely in an iframe
  }
};

/**
 * Check if the current environment might block pop-ups
 */
export const isPopupBlocked = (): boolean => {
  return isInIframe(); // Simplified check - iframes often block popups
};