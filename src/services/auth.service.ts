import { supabase } from '@/integrations/supabase/client';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { withTimeout } from '@/utils/promiseUtils';

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
        localStorage.removeItem('sb-bzzstdpfmyqttnzhgaoa-auth-token');
        sessionStorage.clear();
        
        return { error: null }; // Consider success if we cleared local state
      }
    } catch (error) {
      console.error('🔴 DEBUG: AuthService.signOut error:', error);
      
      // Last resort: manually clear storage
      localStorage.removeItem('sb-bzzstdpfmyqttnzhgaoa-auth-token');
      sessionStorage.clear();
      
      return { error: error as AuthError };
    }
  }

  /**
   * Get current session with server validation to prevent stale token issues
   */
  static async getCurrentSession(): Promise<{ session: Session | null; error: AuthError | null }> {
    try {
      console.log('📡 AUTH SERVICE: Starting getCurrentSession...');
      
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.log('❌ AUTH SERVICE: Session fetch error:', error.message);
        return { session: null, error };
      }
      
      if (!data.session) {
        console.log('📡 AUTH SERVICE: No session found');
        return { session: null, error: null };
      }
      
      // Validate session with server to prevent stale token issues on browser reopen
      console.log('📡 AUTH SERVICE: Validating session with server...');
      const validationStart = Date.now();
      
      try {
        // Use withTimeout to prevent hanging validation
        const { data: { user }, error: userError } = await withTimeout(
          supabase.auth.getUser(),
          10000,
          'Session validation timeout'
        );
        const validationTime = Date.now() - validationStart;
        
        if (userError || !user) {
          // Check if this is a network/timeout error vs actual auth error
          const isNetworkError = userError?.message?.includes('timeout') ||
                                userError?.message?.includes('network') ||
                                userError?.message?.includes('fetch');
          
          if (isNetworkError) {
            console.log(`⚠️ AUTH SERVICE: Session validation failed due to network issue after ${validationTime}ms`, {
              error: userError?.message,
              networkIssue: true,
              sessionPreserved: 'Session preserved due to network error'
            });
            
            // For network errors, return the session without validation
            return { session: data.session, error: null };
          }
          
          console.log(`❌ AUTH SERVICE: Session validation failed after ${validationTime}ms`, {
            error: userError?.message,
            hasUser: !!user,
            sessionExpiry: data.session.expires_at ? new Date(data.session.expires_at * 1000).toISOString() : null,
            staleTokenDetected: true,
            browserReopen: 'Likely stale token from browser storage'
          });
          
          // Only clear session for actual auth errors, not network issues
          await supabase.auth.signOut({ scope: 'local' });
          return { session: null, error: userError || new Error('Stale token detected') as AuthError };
        }
        
        console.log(`✅ AUTH SERVICE: Session validated successfully after ${validationTime}ms`, {
          hasSession: !!data.session,
          hasUser: !!user,
          userId: user.id,
          sessionExpiry: data.session.expires_at ? new Date(data.session.expires_at * 1000).toISOString() : null
        });
        
        return {
          session: data.session,
          error: null
        };
      } catch (validationError: any) {
        const validationTime = Date.now() - validationStart;
        const isTimeoutError = validationError.message?.includes('timeout');
        const isNetworkError = validationError.message?.includes('network') ||
                              validationError.message?.includes('fetch') ||
                              validationError.name === 'AbortError';
        
        if (isTimeoutError || isNetworkError) {
          console.log(`⚠️ AUTH SERVICE: Session validation timeout/network error after ${validationTime}ms`, {
            error: validationError.message,
            timeoutError: isTimeoutError,
            networkError: isNetworkError,
            sessionPreserved: 'Session preserved due to validation timeout/network error'
          });
          
          // For timeout/network errors, return the session without validation
          return { session: data.session, error: null };
        }
        
        console.error(`❌ AUTH SERVICE: Session validation error after ${validationTime}ms:`, validationError);
        
        // Only clear session for actual auth errors, not network/timeout issues
        await supabase.auth.signOut({ scope: 'local' });
        return {
          session: null,
          error: validationError as AuthError
        };
      }
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
}