/**
 * Auth Debugger Utility
 * Provides comprehensive debugging tools for auth issues
 */

import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';

export interface AuthDebugInfo {
  timestamp: string;
  userAgent: string;
  url: string;
  session: Session | null;
  user: User | null;
  localStorage: Record<string, any>;
  sessionStorage: Record<string, any>;
  cookies: string;
  supabaseConfig: {
    url: string;
    anonKey: string;
  };
}

export class AuthDebugger {
  private static logs: AuthDebugInfo[] = [];

  /**
   * Capture comprehensive auth state
   */
  static async captureAuthState(context: string = 'unknown'): Promise<AuthDebugInfo> {
    console.log(`🔍 AUTH DEBUG: Capturing state for ${context}`);

    // Get current session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    // Capture browser storage
    const localStorage: Record<string, any> = {};
    const sessionStorage: Record<string, any> = {};

    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key) {
          localStorage[key] = window.localStorage.getItem(key);
        }
      }

      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        if (key) {
          sessionStorage[key] = window.sessionStorage.getItem(key);
        }
      }
    } catch (error) {
      console.warn('Could not access browser storage:', error);
    }

    const debugInfo: AuthDebugInfo = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      session: sessionData.session,
      user: userData.user,
      localStorage,
      sessionStorage,
      cookies: document.cookie,
      supabaseConfig: {
        url: import.meta.env.VITE_SUPABASE_URL || 'NOT_SET',
        anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'NOT_SET',
      }
    };

    // Log errors if any
    if (sessionError) {
      console.error('🔴 Session Error:', sessionError);
    }
    if (userError) {
      console.error('🔴 User Error:', userError);
    }

    // Store for analysis
    this.logs.push(debugInfo);

    // Log summary
    console.log('🔍 AUTH DEBUG SUMMARY:', {
      context,
      hasSession: !!debugInfo.session,
      hasUser: !!debugInfo.user,
      sessionExpired: debugInfo.session ? new Date(debugInfo.session.expires_at! * 1000) < new Date() : null,
      userEmail: debugInfo.user?.email,
      userConfirmed: debugInfo.user?.email_confirmed_at,
      browser: this.getBrowserInfo(),
      supabaseKeys: debugInfo.supabaseConfig
    });

    return debugInfo;
  }

  /**
   * Test auth endpoints directly
   */
  static async testAuthEndpoints(): Promise<void> {
    console.log('🧪 Testing Auth Endpoints...');

    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!baseUrl || !anonKey) {
      console.error('❌ Missing Supabase configuration');
      return;
    }

    // Test 1: Health check
    try {
      const response = await fetch(`${baseUrl}/rest/v1/`, {
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`
        }
      });
      console.log('✅ Health Check:', response.status, response.statusText);
    } catch (error) {
      console.error('❌ Health Check Failed:', error);
    }

    // Test 2: Auth user endpoint
    try {
      const response = await fetch(`${baseUrl}/auth/v1/user`, {
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`
        }
      });
      const data = await response.json();
      console.log('🔐 Auth User Endpoint:', response.status, data);
    } catch (error) {
      console.error('❌ Auth User Endpoint Failed:', error);
    }

    // Test 3: Current session via Supabase client
    try {
      const { data, error } = await supabase.auth.getSession();
      console.log('📱 Supabase Client Session:', { data, error });
    } catch (error) {
      console.error('❌ Supabase Client Session Failed:', error);
    }
  }

  /**
   * Test sign in flow
   */
  static async testSignIn(email: string, password: string): Promise<void> {
    console.log('🔑 Testing Sign In Flow...');

    try {
      // Capture state before
      await this.captureAuthState('before-signin');

      // Attempt sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      console.log('🔑 Sign In Result:', { data, error });

      // Capture state after
      await this.captureAuthState('after-signin');

      if (error) {
        console.error('❌ Sign In Error:', error);
      } else {
        console.log('✅ Sign In Success:', data.user?.email);
      }
    } catch (error) {
      console.error('❌ Sign In Exception:', error);
    }
  }

  /**
   * Test sign out flow
   */
  static async testSignOut(): Promise<void> {
    console.log('🚪 Testing Sign Out Flow...');

    try {
      // Capture state before
      await this.captureAuthState('before-signout');

      // Attempt sign out
      const { error } = await supabase.auth.signOut();

      console.log('🚪 Sign Out Result:', { error });

      // Capture state after
      await this.captureAuthState('after-signout');

      if (error) {
        console.error('❌ Sign Out Error:', error);
      } else {
        console.log('✅ Sign Out Success');
      }
    } catch (error) {
      console.error('❌ Sign Out Exception:', error);
    }
  }

  /**
   * Get browser information
   */
  static getBrowserInfo(): Record<string, any> {
    return {
      userAgent: navigator.userAgent,
      isEdge: navigator.userAgent.includes('Edg'),
      isChrome: navigator.userAgent.includes('Chrome'),
      isFirefox: navigator.userAgent.includes('Firefox'),
      isSafari: navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome'),
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      language: navigator.language,
      platform: navigator.platform
    };
  }

  /**
   * Export debug logs
   */
  static exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Clear debug logs
   */
  static clearLogs(): void {
    this.logs = [];
    console.log('🧹 Debug logs cleared');
  }

  /**
   * Monitor auth state changes
   */
  static startMonitoring(): () => void {
    console.log('👁️ Starting auth state monitoring...');

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth State Change:', event, session?.user?.email);
        await this.captureAuthState(`auth-change-${event}`);
      }
    );

    return () => {
      subscription.unsubscribe();
      console.log('👁️ Auth monitoring stopped');
    };
  }
}

// Global access for debugging
(window as any).AuthDebugger = AuthDebugger;