/**
 * Service Worker Cleanup Utility
 * 
 * This utility helps clean up any existing service workers that might be
 * causing aggressive caching issues with authentication flows.
 */

export const unregisterServiceWorkers = async (): Promise<void> => {
  if ('serviceWorker' in navigator) {
    try {
      // Get all registrations
      const registrations = await navigator.serviceWorker.getRegistrations();
      
      // Unregister all service workers
      const unregisterPromises = registrations.map(registration => {
        console.log('Unregistering service worker:', registration.scope);
        return registration.unregister();
      });
      
      await Promise.all(unregisterPromises);
      
      if (registrations.length > 0) {
        console.log(`Successfully unregistered ${registrations.length} service worker(s)`);
      }
    } catch (error) {
      console.warn('Failed to unregister service workers:', error);
    }
  }
};

export const clearAllCaches = async (): Promise<void> => {
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      const deletePromises = cacheNames.map(cacheName => {
        console.log('Deleting cache:', cacheName);
        return caches.delete(cacheName);
      });
      
      await Promise.all(deletePromises);
      
      if (cacheNames.length > 0) {
        console.log(`Successfully cleared ${cacheNames.length} cache(s)`);
      }
    } catch (error) {
      console.warn('Failed to clear caches:', error);
    }
  }
};

export const performFullCleanup = async (): Promise<void> => {
  console.log('Starting service worker and cache cleanup...');
  
  await Promise.all([
    unregisterServiceWorkers(),
    clearAllCaches()
  ]);
  
  // Clear localStorage and sessionStorage for auth-related data
  try {
    // Clear specific auth-related storage
    const authKeys = Object.keys(localStorage).filter(key => 
      key.includes('auth') || 
      key.includes('token') || 
      key.includes('session') ||
      key.includes('supabase')
    );
    
    authKeys.forEach(key => {
      localStorage.removeItem(key);
      console.log('Cleared localStorage key:', key);
    });
    
    const sessionAuthKeys = Object.keys(sessionStorage).filter(key => 
      key.includes('auth') || 
      key.includes('token') || 
      key.includes('session') ||
      key.includes('supabase')
    );
    
    sessionAuthKeys.forEach(key => {
      sessionStorage.removeItem(key);
      console.log('Cleared sessionStorage key:', key);
    });
    
  } catch (error) {
    console.warn('Failed to clear storage:', error);
  }
  
  console.log('Service worker and cache cleanup completed');
};

// Auto-cleanup on page load in development
if (import.meta.env.DEV) {
  // Only run cleanup in development to avoid affecting production users
  performFullCleanup().catch(console.warn);
}