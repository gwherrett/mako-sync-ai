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
   * Get current session
   */
  static async getCurrentSession(): Promise<{ session: Session | null; error: AuthError | null }> {
    try {
      const { data, error } = await supabase.auth.getSession();
      return {
        session: data.session,
        error
      };
    } catch (error) {
      console.error('AuthService.getCurrentSession error:', error);
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