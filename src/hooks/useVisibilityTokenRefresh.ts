import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to proactively refresh auth tokens when the tab becomes visible
 * after being hidden. This helps prevent stale token issues when users
 * return to the app after an idle period.
 *
 * Console log prefix: 🔐 VISIBILITY
 */

// Token is considered "expiring soon" if it expires within this time
const EXPIRY_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if a session's token is expiring soon
 */
function isTokenExpiringSoon(session: { expires_at?: number }): boolean {
  if (!session.expires_at) {
    return false;
  }

  const expiresAtMs = session.expires_at * 1000;
  const now = Date.now();
  const timeUntilExpiry = expiresAtMs - now;

  return timeUntilExpiry < EXPIRY_THRESHOLD_MS;
}

/**
 * Hook that listens for tab visibility changes and refreshes the auth token
 * when the tab becomes visible if the token is expiring soon.
 */
export function useVisibilityTokenRefresh(): void {
  useEffect(() => {
    let lastVisibilityChange = Date.now();

    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      const timeSinceLastChange = Date.now() - lastVisibilityChange;
      lastVisibilityChange = Date.now();

      // Only check if tab was hidden for at least 30 seconds
      // This prevents unnecessary refreshes for quick tab switches
      if (timeSinceLastChange < 30000) {
        return;
      }

      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.warn('🔐 VISIBILITY: Error getting session:', error.message);
          return;
        }

        if (!data.session) {
          // No session, nothing to refresh
          return;
        }

        if (isTokenExpiringSoon(data.session)) {
          console.log('🔐 VISIBILITY: Token expiring soon, refreshing...', {
            expiresAt: data.session.expires_at
              ? new Date(data.session.expires_at * 1000).toISOString()
              : 'unknown'
          });

          const { error: refreshError } = await supabase.auth.refreshSession();

          if (refreshError) {
            console.warn('🔐 VISIBILITY: Token refresh failed:', refreshError.message);
          } else {
            console.log('🔐 VISIBILITY: Token refreshed successfully');
          }
        }
      } catch (error) {
        console.warn('🔐 VISIBILITY: Error in visibility handler:', error);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}

export default useVisibilityTokenRefresh;
