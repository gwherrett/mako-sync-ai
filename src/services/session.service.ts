import { supabase } from '@/integrations/supabase/client';
import { Session, AuthError } from '@supabase/supabase-js';

export interface SessionState {
  session: Session | null;
  isExpired: boolean;
  expiresAt: Date | null;
}

export class SessionService {
  /**
   * Get current session with expiry check
   */
  static async getSessionState(): Promise<{ sessionState: SessionState; error: AuthError | null }> {
    try {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        return {
          sessionState: {
            session: null,
            isExpired: true,
            expiresAt: null
          },
          error
        };
      }

      const session = data.session;
      let isExpired = false;
      let expiresAt: Date | null = null;

      if (session) {
        expiresAt = new Date(session.expires_at! * 1000);
        isExpired = expiresAt <= new Date();
      }

      return {
        sessionState: {
          session,
          isExpired,
          expiresAt
        },
        error: null
      };
    } catch (error) {
      console.error('SessionService.getSessionState error:', error);
      return {
        sessionState: {
          session: null,
          isExpired: true,
          expiresAt: null
        },
        error: error as AuthError
      };
    }
  }

  /**
   * Refresh the current session
   */
  static async refreshSession(): Promise<{ session: Session | null; error: AuthError | null }> {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      return {
        session: data.session,
        error
      };
    } catch (error) {
      console.error('SessionService.refreshSession error:', error);
      return {
        session: null,
        error: error as AuthError
      };
    }
  }

  /**
   * Check if session needs refresh (within 5 minutes of expiry)
   */
  static needsRefresh(session: Session | null): boolean {
    if (!session?.expires_at) return false;
    
    const expiresAt = new Date(session.expires_at * 1000);
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    
    return expiresAt <= fiveMinutesFromNow;
  }

  /**
   * Auto-refresh session if needed
   */
  static async autoRefreshIfNeeded(session: Session | null): Promise<{ session: Session | null; wasRefreshed: boolean; error: AuthError | null }> {
    if (!session || !this.needsRefresh(session)) {
      return {
        session,
        wasRefreshed: false,
        error: null
      };
    }

    const { session: newSession, error } = await this.refreshSession();
    
    return {
      session: newSession || session,
      wasRefreshed: !error,
      error
    };
  }

  /**
   * Calculate time until session expires
   */
  static getTimeUntilExpiry(session: Session | null): number | null {
    if (!session?.expires_at) return null;
    
    const expiresAt = new Date(session.expires_at * 1000);
    return expiresAt.getTime() - Date.now();
  }

  /**
   * Set up automatic session refresh
   */
  static setupAutoRefresh(
    session: Session | null, 
    onRefresh: (session: Session | null) => void,
    onError: (error: AuthError) => void
  ): (() => void) | null {
    const timeUntilExpiry = this.getTimeUntilExpiry(session);
    
    if (!timeUntilExpiry || timeUntilExpiry <= 0) return null;
    
    // Refresh 2 minutes before expiry
    const refreshTime = Math.max(timeUntilExpiry - (2 * 60 * 1000), 0);
    
    const timeoutId = setTimeout(async () => {
      const { session: newSession, error } = await this.refreshSession();
      
      if (error) {
        onError(error);
      } else {
        onRefresh(newSession);
      }
    }, refreshTime);
    
    return () => clearTimeout(timeoutId);
  }

  /**
   * Validate session is still active
   */
  static async validateSession(session: Session | null): Promise<{ isValid: boolean; error: AuthError | null }> {
    if (!session) {
      return { isValid: false, error: null };
    }

    try {
      const { data, error } = await supabase.auth.getUser();
      
      return {
        isValid: !error && !!data.user,
        error
      };
    } catch (error) {
      console.error('SessionService.validateSession error:', error);
      return {
        isValid: false,
        error: error as AuthError
      };
    }
  }
}