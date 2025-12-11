import { supabase } from '@/integrations/supabase/client';
import { User, Session, AuthError } from '@supabase/supabase-js';

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
   * Sign out the current user
   */
  static async signOut(): Promise<{ error: AuthError | null }> {
    try {
      console.log('🔴 DEBUG: AuthService.signOut - Browser:', navigator.userAgent.includes('Edg') ? 'Edge' : 'Other');
      console.log('🔴 DEBUG: AuthService.signOut - calling supabase.auth.signOut() with global scope');
      
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      console.log('🔴 DEBUG: AuthService.signOut - supabase result:', { error });
      
      if (error) {
        console.log('🔴 DEBUG: SignOut failed with global scope, trying local scope for Edge compatibility');
        const { error: localError } = await supabase.auth.signOut({ scope: 'local' });
        console.log('🔴 DEBUG: AuthService.signOut - local scope result:', { error: localError });
        return { error: localError };
      }
      
      return { error };
    } catch (error) {
      console.error('🔴 DEBUG: AuthService.signOut error:', error);
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
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        const validationTime = Date.now() - validationStart;
        
        if (userError || !user) {
          console.log(`❌ AUTH SERVICE: Session validation failed after ${validationTime}ms`, {
            error: userError?.message,
            hasUser: !!user,
            sessionExpiry: data.session.expires_at ? new Date(data.session.expires_at * 1000).toISOString() : null,
            staleTokenDetected: true,
            browserReopen: 'Likely stale token from browser storage'
          });
          
          // Clear stale session
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
      } catch (validationError) {
        console.error('❌ AUTH SERVICE: Session validation error:', validationError);
        
        // If validation fails, treat as stale token
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