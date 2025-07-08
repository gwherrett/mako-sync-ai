import { supabase } from '@/integrations/supabase/client';
import type { SpotifyConnection } from '@/types/spotify';

export class SpotifyService {
  static async checkConnection(): Promise<{ connection: SpotifyConnection | null; isConnected: boolean }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return { connection: null, isConnected: false };
      }

      // Use .maybeSingle() instead of .single() to avoid 406 error when no connection exists
      const { data, error } = await supabase
        .from('spotify_connections')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking Spotify connection:', error);
        return { connection: null, isConnected: false };
      }

      if (data) {
        return { connection: data as SpotifyConnection, isConnected: true };
      }

      return { connection: null, isConnected: false };
    } catch (error) {
      console.error('Error checking connection:', error);
      return { connection: null, isConnected: false };
    }
  }

  static async refreshTokens(): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        return { success: false, error: 'Please log in to refresh tokens' };
      }

      // Call the sync function to trigger token refresh
      const response = await supabase.functions.invoke('spotify-sync-liked', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return { success: true };
    } catch (error: any) {
      console.error('Token refresh error:', error);
      return { success: false, error: error.message };
    }
  }

  static async connectSpotify(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔵 Step 1: Starting Spotify connection process...');
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('❌ Step 1 Failed: User not authenticated');
        return { success: false, error: 'Please log in to connect Spotify' };
      }

      console.log('✅ Step 1 Complete: User authenticated, user ID:', user.id);

      const state = Math.random().toString(36).substring(7);
      
      // Store state in localStorage for validation after redirect
      localStorage.setItem('spotify_auth_state', state);
      console.log('🔵 Step 2: Generated and stored auth state:', state);
      
      const scopes = [
        'user-read-private',
        'user-read-email', 
        'user-library-read',
        'playlist-read-private',
        'playlist-read-collaborative',
        'user-top-read'  // Required for audio features
      ].join(' ');

      // Use current origin for redirect URI
      const redirectUri = `${window.location.origin}/spotify-callback`;
      console.log('🔵 Step 3: Using redirect URI:', redirectUri);
      
      const authUrl = new URL('https://accounts.spotify.com/authorize');
      authUrl.searchParams.append('client_id', '3bac088a26d64ddfb49d57fb5d451d71');
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('redirect_uri', redirectUri);
      authUrl.searchParams.append('scope', scopes);
      authUrl.searchParams.append('state', state);
      // Add cache-busting parameter to ensure fresh request
      authUrl.searchParams.append('t', Date.now().toString());

      console.log('🔵 Step 4: Opening Spotify auth URL:', authUrl.toString());

      // Force close any existing popup with this name first
      const existingWindow = window.open('', 'spotify-auth');
      if (existingWindow) {
        console.log('🔵 Step 4a: Closing existing popup window');
        existingWindow.close();
      }

      // Open Spotify auth in popup - use unique name each time to force fresh window
      const authWindow = window.open(
        authUrl.toString(), 
        `spotify-auth-${Date.now()}`, // Unique name to force fresh popup
        'width=500,height=600,scrollbars=yes,resizable=yes,location=yes,menubar=no,toolbar=no,status=no'
      );
      
      if (!authWindow) {
        console.log('❌ Step 4 Failed: Popup blocked');
        throw new Error('Popup blocked. Please allow popups for this site and try again.');
      }

      console.log('✅ Step 4 Complete: Popup window opened successfully');
      console.log('🔵 Step 5: Waiting for auth completion message from popup...');

      // Listen for auth completion message from popup
      return new Promise((resolve, reject) => {
        const messageListener = (event: MessageEvent) => {
          console.log('🔵 Step 6: Received message from popup:', event.data);
          
          if (event.origin !== window.location.origin) {
            console.log('⚠️ Ignoring message from different origin:', event.origin);
            return;
          }
          
          if (event.data.type === 'spotify-auth-success') {
            console.log('✅ Step 6 Complete: Received success message from popup');
            window.removeEventListener('message', messageListener);
            authWindow.close();
            console.log('✅ Step 7 Complete: Popup closed, authentication successful!');
            resolve({ success: true });
          } else if (event.data.type === 'spotify-auth-error') {
            console.log('❌ Step 6 Failed: Received error message from popup:', event.data.error);
            window.removeEventListener('message', messageListener);
            authWindow.close();
            reject(new Error(event.data.error));
          }
        };

        window.addEventListener('message', messageListener);
        console.log('🔵 Step 5a: Message listener added');

        // Handle popup being closed manually
        const checkClosed = setInterval(() => {
          if (authWindow.closed) {
            console.log('⚠️ Step 6 Alternative: Popup was closed manually by user');
            clearInterval(checkClosed);
            window.removeEventListener('message', messageListener);
            reject(new Error('Authentication cancelled'));
          }
        }, 1000);
      });
    } catch (error: any) {
      console.error('❌ Connect Spotify error:', error);
      throw new Error(error.message);
    }
  }

  static async disconnectSpotify(): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return { success: false, error: 'No user found' };
      }

      const { error } = await supabase
        .from('spotify_connections')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      // Clear any stored state
      localStorage.removeItem('spotify_auth_state');
      
      return { success: true };
    } catch (error: any) {
      console.error('Error disconnecting Spotify:', error);
      return { success: false, error: error.message };
    }
  }

  static async syncLikedSongs(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        return { success: false, error: 'Please log in to sync liked songs' };
      }

      const response = await supabase.functions.invoke('spotify-sync-liked', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return { success: true, message: response.data.message };
    } catch (error: any) {
      console.error('Sync error:', error);
      return { success: false, error: error.message };
    }
  }
}