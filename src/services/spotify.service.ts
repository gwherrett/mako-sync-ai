import { supabase } from '@/integrations/supabase/client';
import type { SpotifyConnection } from '@/types/spotify';

export class SpotifyService {
  static async checkConnection(): Promise<{ connection: SpotifyConnection | null; isConnected: boolean }> {
    try {
      console.log('🔍 SPOTIFY SERVICE: Starting connection check...');
      
      // Get session without artificial timeout - let Supabase handle its own timeouts
      console.log('🔍 SPOTIFY SERVICE: Getting session...');
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      console.log('🔍 SPOTIFY SERVICE: Session result:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id,
        sessionError: sessionError?.message
      });
      
      if (sessionError || !session?.user) {
        console.log('❌ SPOTIFY SERVICE: No valid session, returning disconnected');
        return { connection: null, isConnected: false };
      }

      const user = session.user;
      console.log('🔍 SPOTIFY SERVICE: Querying spotify_connections table for user:', user.id);
      
      // Query database without artificial timeout
      const { data, error } = await supabase
        .from('spotify_connections')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      console.log('🔍 SPOTIFY SERVICE: Database query result:', {
        hasData: !!data,
        hasError: !!error,
        errorMessage: error?.message,
        errorCode: error?.code,
        dataKeys: data ? Object.keys(data) : []
      });

      if (error) {
        console.error('❌ SPOTIFY SERVICE ERROR: Database query failed:', error);
        return { connection: null, isConnected: false };
      }

      if (data) {
        console.log('✅ SPOTIFY SERVICE: Connection found, returning connected');
        return { connection: data as SpotifyConnection, isConnected: true };
      }

      console.log('✅ SPOTIFY SERVICE: No connection found, returning disconnected');
      return { connection: null, isConnected: false };
      
    } catch (error) {
      console.error('❌ SPOTIFY SERVICE CRITICAL ERROR:', error);
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
      console.log('🔵 SPOTIFY AUTH DEBUG: Starting connection process...');
      console.log('🔍 ENVIRONMENT DEBUG:', {
        origin: window.location.origin,
        hostname: window.location.hostname,
        protocol: window.location.protocol,
        userAgent: navigator.userAgent.substring(0, 50)
      });
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('❌ SPOTIFY AUTH ERROR: User not authenticated');
        return { success: false, error: 'Please log in to connect Spotify' };
      }

      console.log('✅ SPOTIFY AUTH: User authenticated, user ID:', user.id);

      const state = Math.random().toString(36).substring(7);
      
      // Store state in localStorage for validation after redirect
      localStorage.setItem('spotify_auth_state', state);
      console.log('🔵 SPOTIFY AUTH: Generated and stored auth state:', state);
      
      const scopes = [
        'user-read-private',
        'user-read-email',
        'user-library-read',
        'playlist-read-private',
        'playlist-read-collaborative',
        'user-top-read'  // Required for audio features
      ].join(' ');

      // Use environment variable for redirect URI or fallback to current origin
      const redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI || `${window.location.origin}/spotify-callback`;
      console.log('🔵 SPOTIFY AUTH: Using redirect URI:', redirectUri);
      console.log('🔍 REDIRECT URI DEBUG:', {
        redirectUri,
        hasEnvRedirectUri: !!import.meta.env.VITE_SPOTIFY_REDIRECT_URI,
        envRedirectUri: import.meta.env.VITE_SPOTIFY_REDIRECT_URI,
        currentOrigin: window.location.origin,
        isProduction: window.location.hostname !== 'localhost'
      });
      
      // Get client ID from environment or use fallback
      const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID || '3bac088a26d64ddfb49d57fb5d451d71';
      console.log('🔍 SPOTIFY CLIENT ID DEBUG:', {
        clientId,
        isProduction: window.location.hostname !== 'localhost',
        hostname: window.location.hostname,
        hasEnvClientId: !!import.meta.env.VITE_SPOTIFY_CLIENT_ID,
        envClientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID?.substring(0, 8) + '...'
      });
      
      const authUrl = new URL('https://accounts.spotify.com/authorize');
      authUrl.searchParams.append('client_id', clientId);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('redirect_uri', redirectUri);
      authUrl.searchParams.append('scope', scopes);
      authUrl.searchParams.append('state', state);
      // Add cache-busting parameter to ensure fresh request
      authUrl.searchParams.append('t', Date.now().toString());

      console.log('🔵 SPOTIFY AUTH: Constructed auth URL');
      console.log('🔍 AUTH URL DEBUG:', {
        url: authUrl.toString(),
        urlLength: authUrl.toString().length,
        redirectUri,
        clientId,
        state,
        scopes: scopes.split(' ').length + ' scopes'
      });

      // Add a delay to ensure logs are captured before redirect
      console.log('🔵 SPOTIFY AUTH: Redirecting to Spotify in 100ms...');
      setTimeout(() => {
        console.log('🔵 SPOTIFY AUTH: REDIRECTING NOW to:', authUrl.toString().substring(0, 100) + '...');
        window.location.href = authUrl.toString();
      }, 100);
      
      // This return won't execute because we're redirecting
      return { success: true };
    } catch (error: any) {
      console.error('❌ SPOTIFY AUTH CRITICAL ERROR:', error);
      console.error('❌ ERROR STACK:', error.stack);
      throw new Error(`Spotify auth failed: ${error.message}`);
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

  static async syncLikedSongs(forceFullSync: boolean = false): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        return { success: false, error: 'Please log in to sync liked songs' };
      }

      const response = await supabase.functions.invoke('spotify-sync-liked', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          force_full_sync: forceFullSync
        }
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