import { useState, useEffect, useCallback, useRef } from 'react';
import { Session, AuthError } from '@supabase/supabase-js';
import { SessionService, SessionState } from '@/services/session.service';
import { useToast } from '@/hooks/use-toast';

export interface UseSessionReturn {
  session: Session | null;
  sessionState: SessionState | null;
  isValidating: boolean;
  isExpired: boolean;
  expiresAt: Date | null;
  timeUntilExpiry: number | null;
  refreshSession: () => Promise<void>;
  validateSession: () => Promise<boolean>;
}

export const useSession = (): UseSessionReturn => {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const clearRefreshTimeout = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  }, []);

  const handleRefreshError = useCallback((error: AuthError) => {
    console.error('Session refresh error:', error);
    toast({
      title: 'Session Refresh Failed',
      description: 'Your session could not be refreshed. Please sign in again.',
      variant: 'destructive',
    });
  }, [toast]);

  const handleRefreshSuccess = useCallback((newSession: Session | null) => {
    setSession(newSession);
    if (newSession) {
      toast({
        title: 'Session Refreshed',
        description: 'Your session has been automatically refreshed.',
      });
    }
  }, [toast]);

  const setupAutoRefresh = useCallback((currentSession: Session | null) => {
    clearRefreshTimeout();
    
    const cleanup = SessionService.setupAutoRefresh(
      currentSession,
      handleRefreshSuccess,
      handleRefreshError
    );
    
    if (cleanup) {
      refreshTimeoutRef.current = setTimeout(cleanup, 0) as NodeJS.Timeout;
    }
  }, [handleRefreshSuccess, handleRefreshError, clearRefreshTimeout]);

  const refreshSession = useCallback(async () => {
    setIsValidating(true);
    
    try {
      const { session: newSession, error } = await SessionService.refreshSession();
      
      if (error) {
        handleRefreshError(error);
      } else {
        setSession(newSession);
        setupAutoRefresh(newSession);
      }
    } catch (error) {
      console.error('Manual session refresh error:', error);
    } finally {
      setIsValidating(false);
    }
  }, [handleRefreshError, setupAutoRefresh]);

  const validateSession = useCallback(async (): Promise<boolean> => {
    setIsValidating(true);
    
    try {
      const { isValid, error } = await SessionService.validateSession(session);
      
      if (error) {
        console.error('Session validation error:', error);
      }
      
      return isValid;
    } catch (error) {
      console.error('Session validation error:', error);
      return false;
    } finally {
      setIsValidating(false);
    }
  }, [session]);

  const loadSessionState = useCallback(async () => {
    try {
      const { sessionState, error } = await SessionService.getSessionState();
      
      if (error) {
        console.error('Session state loading error:', error);
        return;
      }
      
      setSessionState(sessionState);
      setSession(sessionState.session);
      
      // Set up auto-refresh for valid sessions
      if (sessionState.session && !sessionState.isExpired) {
        setupAutoRefresh(sessionState.session);
      }
    } catch (error) {
      console.error('Session state loading error:', error);
    }
  }, [setupAutoRefresh]);

  // Load initial session state
  useEffect(() => {
    loadSessionState();
    
    return () => {
      clearRefreshTimeout();
    };
  }, [loadSessionState, clearRefreshTimeout]);

  // Auto-refresh check when session changes
  useEffect(() => {
    const checkAndRefresh = async () => {
      if (session && !sessionState?.isExpired) {
        const { session: refreshedSession, wasRefreshed } = await SessionService.autoRefreshIfNeeded(session);
        
        if (wasRefreshed && refreshedSession) {
          setSession(refreshedSession);
          setupAutoRefresh(refreshedSession);
        }
      }
    };
    
    checkAndRefresh();
  }, [session, sessionState?.isExpired, setupAutoRefresh]);

  const timeUntilExpiry = SessionService.getTimeUntilExpiry(session);
  
  return {
    session,
    sessionState,
    isValidating,
    isExpired: sessionState?.isExpired || false,
    expiresAt: sessionState?.expiresAt || null,
    timeUntilExpiry,
    refreshSession,
    validateSession,
  };
};