// Debug utilities for authentication and Spotify issues
import { supabase } from '@/integrations/supabase/client';

export class DebugHelpers {
  /**
   * Test logout functionality step by step
   */
  static async testLogout() {
    console.log('🔴 LOGOUT DEBUG: Starting logout test...');
    
    // Check initial state
    const { data: { session: initialSession } } = await supabase.auth.getSession();
    console.log('🔴 LOGOUT DEBUG: Initial session:', {
      hasSession: !!initialSession,
      userId: initialSession?.user?.id,
      expiresAt: initialSession?.expires_at
    });

    // Check localStorage before logout
    const localStorageKeys = Object.keys(localStorage);
    const authKeys = localStorageKeys.filter(key => 
      key.includes('auth') || key.includes('supabase') || key.includes('spotify')
    );
    console.log('🔴 LOGOUT DEBUG: Auth-related localStorage keys before logout:', authKeys);

    try {
      // Test different logout approaches
      console.log('🔴 LOGOUT DEBUG: Testing global scope logout...');
      const { error: globalError } = await supabase.auth.signOut({ scope: 'global' });
      console.log('🔴 LOGOUT DEBUG: Global logout result:', { error: globalError?.message });

      // Wait a moment for state to update
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check session after logout
      const { data: { session: afterSession } } = await supabase.auth.getSession();
      console.log('🔴 LOGOUT DEBUG: Session after logout:', {
        hasSession: !!afterSession,
        userId: afterSession?.user?.id
      });

      // Check localStorage after logout
      const afterKeys = Object.keys(localStorage);
      const afterAuthKeys = afterKeys.filter(key => 
        key.includes('auth') || key.includes('supabase') || key.includes('spotify')
      );
      console.log('🔴 LOGOUT DEBUG: Auth-related localStorage keys after logout:', afterAuthKeys);

      return {
        success: !afterSession,
        initialSession: !!initialSession,
        finalSession: !!afterSession,
        error: globalError?.message
      };

    } catch (error: any) {
      console.error('🔴 LOGOUT DEBUG: Exception during logout test:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test Spotify connection prerequisites
   */
  static async testSpotifyPrerequisites() {
    console.log('🔵 SPOTIFY DEBUG: Testing connection prerequisites...');

    // Check environment variables
    const envVars = {
      clientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID,
      redirectUri: import.meta.env.VITE_SPOTIFY_REDIRECT_URI,
      hasClientId: !!import.meta.env.VITE_SPOTIFY_CLIENT_ID,
      hasRedirectUri: !!import.meta.env.VITE_SPOTIFY_REDIRECT_URI
    };
    console.log('🔵 SPOTIFY DEBUG: Environment variables:', envVars);

    // Check current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('🔵 SPOTIFY DEBUG: Current session:', {
      hasSession: !!session,
      userId: session?.user?.id,
      sessionError: sessionError?.message
    });

    // Test database connection
    try {
      const { data, error } = await supabase
        .from('spotify_connections')
        .select('count')
        .limit(1);
      
      console.log('🔵 SPOTIFY DEBUG: Database connection test:', {
        success: !error,
        error: error?.message
      });
    } catch (dbError: any) {
      console.error('🔵 SPOTIFY DEBUG: Database connection failed:', dbError);
    }

    // Check localStorage state
    const spotifyState = localStorage.getItem('spotify_auth_state');
    console.log('🔵 SPOTIFY DEBUG: Stored auth state:', spotifyState);

    return {
      envVars,
      hasSession: !!session,
      sessionError: sessionError?.message,
      storedState: spotifyState
    };
  }

  /**
   * Test edge function connectivity
   */
  static async testEdgeFunctions() {
    console.log('🔧 EDGE FUNCTION DEBUG: Testing connectivity...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.log('🔧 EDGE FUNCTION DEBUG: No session for testing');
        return { success: false, error: 'No session' };
      }

      // Test spotify-auth function with a dummy call
      const response = await supabase.functions.invoke('spotify-auth', {
        body: { test: true },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log('🔧 EDGE FUNCTION DEBUG: spotify-auth response:', {
        hasError: !!response.error,
        errorMessage: response.error?.message
      });

      return {
        success: !response.error,
        error: response.error?.message
      };

    } catch (error: any) {
      console.error('🔧 EDGE FUNCTION DEBUG: Exception:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Force cleanup of all auth-related storage
   */
  static forceCleanup() {
    console.log('🧹 CLEANUP DEBUG: Starting force cleanup...');

    // Clear all localStorage keys that might be auth-related
    const keysToRemove = Object.keys(localStorage).filter(key =>
      key.includes('auth') || 
      key.includes('supabase') || 
      key.includes('spotify') ||
      key.includes('mako')
    );

    console.log('🧹 CLEANUP DEBUG: Removing keys:', keysToRemove);
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Clear sessionStorage too
    const sessionKeysToRemove = Object.keys(sessionStorage).filter(key =>
      key.includes('auth') || 
      key.includes('supabase') || 
      key.includes('spotify') ||
      key.includes('mako')
    );

    console.log('🧹 CLEANUP DEBUG: Removing session keys:', sessionKeysToRemove);
    sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));

    console.log('🧹 CLEANUP DEBUG: Force cleanup completed');
  }

  /**
   * Run comprehensive diagnostic
   */
  static async runDiagnostic() {
    console.log('🔍 DIAGNOSTIC: Starting comprehensive debug...');
    
    const results = {
      logout: await this.testLogout(),
      spotify: await this.testSpotifyPrerequisites(),
      edgeFunctions: await this.testEdgeFunctions(),
      timestamp: new Date().toISOString()
    };

    console.log('🔍 DIAGNOSTIC: Complete results:', results);
    return results;
  }
}

// Make available globally for console debugging
(window as any).DebugHelpers = DebugHelpers;