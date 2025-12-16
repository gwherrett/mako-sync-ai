import { supabase } from '@/integrations/supabase/client';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { withTimeout } from '@/utils/promiseUtils';
import { sessionCache } from '@/services/sessionCache.service';

export interface AuthResult {
  user: User | null;
  session: Session | null;
  error: AuthError | null;
}

export interface SignUpData {
  email: string;
  password: string;
  displayName?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export class AuthService {
  /**
   * Sign up a new user
   */
  static async signUp({ email, password, displayName }: SignUpData): Promise<AuthResult> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            display_name: displayName
          }
        }
      });

      return {
        user: data.user,
        session: data.session,
        error
      };
    } catch (error) {
      console.error('AuthService.signUp error:', error);
      return {
        user: null,
        session: null,
        error: error as AuthError
      };
    }
  }

  /**
   * Sign in an existing user
   */
  static async signIn({ email, password }: SignInData): Promise<AuthResult> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      return {
        user: data.user,
        session: data.session,
        error
      };
    } catch (error) {
      console.error('AuthService.signIn error:', error);
      return {
        user: null,
        session: null,
        error: error as AuthError
      };
    }
  }

  /**
   * Sign out the current user with timeout protection and local fallback
   */
  static async signOut(): Promise<{ error: AuthError | null }> {
    try {
      console.log('🔴 DEBUG: AuthService.signOut - attempting global sign out with timeout');
      
      // Try global signout with 5 second timeout
      try {
        const result = await withTimeout(
          supabase.auth.signOut({ scope: 'global' }),
          5000,
          'Sign out request timed out'
        );
        console.log('🔴 DEBUG: AuthService.signOut - global scope result:', result);
        return { error: result.error };
      } catch (timeoutError) {
        console.warn('⚠️ DEBUG: Global signout timed out, falling back to local signout');
        
        // Fallback: local signout
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) {
          console.warn('⚠️ DEBUG: Local signout also failed, forcing manual cleanup');
        }
        
        // Force clear all auth storage regardless
        this.clearAuthCache();
        
        return { error: null }; // Consider success if we cleared local state
      }
    } catch (error) {
      console.error('🔴 DEBUG: AuthService.signOut error:', error);
      
      // Last resort: manually clear storage
      this.clearAuthCache();
      
      return { error: error as AuthError };
    }
  }

  /**
   * Get current session with enhanced caching and race condition protection
   * @param context - Context for the request (initialization, normal, etc.)
   */
  static async getCurrentSession(context: 'initialization' | 'normal' | 'refresh' = 'normal'): Promise<{ session: Session | null; error: AuthError | null }> {
    try {
      console.log('📡 AUTH SERVICE: Starting getCurrentSession...', { context });
      
      // Use session cache with appropriate priority
      const priority = context === 'initialization' ? 'initialization' :
                      context === 'refresh' ? 'normal' : 'background';
      
      const result = await sessionCache.getSession(false, `auth-service-${context}`, priority);
      
      console.log('📡 AUTH SERVICE: Session cache result', {
        context,
        hasSession: !!result.session,
        hasError: !!result.error,
        userId: result.session?.user?.id
      });
      
      return {
        session: result.session,
        error: result.error as AuthError
      };
    } catch (error) {
      console.error('❌ AUTH SERVICE: getCurrentSession error:', error);
      return {
        session: null,
        error: error as AuthError
      };
    }
  }

  /**
   * Get current user
   */
  static async getCurrentUser(): Promise<{ user: User | null; error: AuthError | null }> {
    try {
      const { data, error } = await supabase.auth.getUser();
      return {
        user: data.user,
        error
      };
    } catch (error) {
      console.error('AuthService.getCurrentUser error:', error);
      return {
        user: null,
        error: error as AuthError
      };
    }
  }

  /**
   * Reset password
   */
  static async resetPassword(email: string): Promise<{ error: AuthError | null }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      return { error };
    } catch (error) {
      console.error('AuthService.resetPassword error:', error);
      return { error: error as AuthError };
    }
  }

  /**
   * Update password
   */
  static async updatePassword(password: string): Promise<{ error: AuthError | null }> {
    try {
      const { error } = await supabase.auth.updateUser({ password });
      return { error };
    } catch (error) {
      console.error('AuthService.updatePassword error:', error);
      return { error: error as AuthError };
    }
  }

  /**
   * Resend email confirmation
   */
  static async resendConfirmation(email: string): Promise<{ error: AuthError | null }> {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      });
      return { error };
    } catch (error) {
      console.error('AuthService.resendConfirmation error:', error);
      return { error: error as AuthError };
    }
  }

  /**
   * Clear all authentication-related cache and storage
   */
  static clearAuthCache(): void {
    try {
      // Clear Supabase auth token
      localStorage.removeItem('sb-bzzstdpfmyqttnzhgaoa-auth-token');
      
      // Clear all auth-related localStorage items
      const authKeys = Object.keys(localStorage).filter(key =>
        key.includes('auth') ||
        key.includes('token') ||
        key.includes('session') ||
        key.includes('supabase') ||
        key.includes('sb-')
      );
      
      authKeys.forEach(key => {
        localStorage.removeItem(key);
        console.log('🧹 Cleared localStorage key:', key);
      });
      
      // Clear all sessionStorage
      sessionStorage.clear();
      
      // Clear any cached session data
      if ('caches' in window) {
        caches.keys().then(cacheNames => {
          cacheNames.forEach(cacheName => {
            if (cacheName.includes('auth') || cacheName.includes('session')) {
              caches.delete(cacheName);
              console.log('🧹 Cleared cache:', cacheName);
            }
          });
        });
      }
      
      console.log('🧹 Auth cache cleared successfully');
    } catch (error) {
      console.warn('⚠️ Failed to clear auth cache:', error);
    }
  }

  /**
   * Force refresh session by clearing cache and fetching fresh
   */
  static async refreshSession(): Promise<{ session: Session | null; error: AuthError | null }> {
    try {
      console.log('🔄 Forcing session refresh...');
      
      // Clear any cached session data first
      this.clearAuthCache();
      
      // Add cache-busting timestamp to force fresh request
      const timestamp = Date.now();
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.log('❌ Session refresh error:', error.message);
        return { session: null, error };
      }
      
      console.log('✅ Session refreshed successfully at', new Date(timestamp).toISOString());
      return { session: data.session, error: null };
    } catch (error) {
      console.error('❌ refreshSession error:', error);
      return { session: null, error: error as AuthError };
    }
  }
}