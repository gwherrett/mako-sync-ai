import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthService, SignUpData, SignInData } from '@/services/auth.service';
import { UserService, UserProfile } from '@/services/user.service';
import { SessionService } from '@/services/session.service';
import { AuthRetryService } from '@/services/authRetry.service';
import { AuthStateRecoveryService } from '@/services/authStateRecovery.service';
import { ErrorHandlingService } from '@/services/errorHandling.service';
import { ErrorLoggingService } from '@/services/errorLogging.service';
import { sessionCache } from '@/services/sessionCache.service';
import { startupSessionValidator } from '@/services/startupSessionValidator.service';
import { useAuthErrors } from '@/hooks/useAuthErrors';
import { useToast } from '@/hooks/use-toast';

export interface AuthContextType {
  // Core state
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  role: 'admin' | 'user' | null;
  loading: boolean;
  initialDataReady: boolean; // Signals that auth initialization is complete and data queries can start
  
  // Auth states
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  isOnboardingComplete: boolean;
  
  // Auth actions
  signUp: (data: SignUpData) => Promise<boolean>;
  signIn: (data: SignInData) => Promise<boolean>;
  signOut: () => Promise<void>;
  resendConfirmation: (email: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  updatePassword: (password: string) => Promise<boolean>;
  
  // Profile actions
  updateProfile: (updates: Partial<UserProfile>) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  
  // Session actions
  refreshSession: () => Promise<void>;
  
  // Recovery actions
  recoverAuthState: () => Promise<boolean>;
  
  // Role checks
  hasRole: (role: 'admin' | 'user') => boolean;
  isAdmin: boolean;
  
  // Error handling
  error: AuthError | null;
  clearError: () => void;
  
  // Enhanced error info
  lastErrorContext: any;
  errorRecoveryAvailable: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within a NewAuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const NewAuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Core state
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<'admin' | 'user' | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialDataReady, setInitialDataReady] = useState(false); // Signals data queries can start
  
  // Update refs when state changes
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { profileRef.current = profile; }, [profile]);
  useEffect(() => { roleRef.current = role; }, [role]);
  
  // Error handling
  const { error, setError, clearError, setLoading: setErrorLoading, handleError } = useAuthErrors();
  const { toast } = useToast();
  const initializationRef = useRef(false);
  const sessionValidatedRef = useRef(false); // Track if session has been validated with server
  
  // Refs for logging without causing re-renders
  const userRef = useRef<User | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const profileRef = useRef<UserProfile | null>(null);
  const roleRef = useRef<'admin' | 'user' | null>(null);
  const [lastErrorContext, setLastErrorContext] = useState<any>(null);
  const [errorRecoveryAvailable, setErrorRecoveryAvailable] = useState(false);
  
  // Initialize enhanced error handling services
  useEffect(() => {
    ErrorLoggingService.initialize({
      enableConsoleLogging: true,
      enableLocalStorage: true,
      logLevels: ['info', 'warn', 'error', 'critical']
    });
    
    // Setup auto backup
    const cleanupBackup = AuthStateRecoveryService.setupAutoBackup();
    
    return cleanupBackup;
  }, []);

  // Load user profile and role
  const loadUserData = useCallback(async (userId: string) => {
    try {
      const [profileResult, roleResult] = await Promise.all([
        UserService.getUserProfile(userId),
        UserService.getUserRole(userId)
      ]);

      if (profileResult.profile) {
        setProfile(profileResult.profile);
      }

      if (roleResult.role) {
        setRole(roleResult.role);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }, []);

  // Clear user data - stabilized with no state dependencies
  const clearUserData = useCallback(() => {
    console.log('🔴 DEBUG: clearUserData called');
    
    // SESSION DEBUG: Log session state before clearing using refs
    console.log('🔍 SESSION DEBUG (Clear User Data): Session state before clearing user data', {
      hadUser: !!userRef.current,
      hadSession: !!sessionRef.current,
      userId: userRef.current?.id,
      userEmail: userRef.current?.email,
      sessionExpiry: sessionRef.current?.expires_at,
      hadProfile: !!profileRef.current,
      hadRole: !!roleRef.current,
      clearingReason: 'User data being cleared - session will be nullified',
      timestamp: new Date().toISOString()
    });
    
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    
    // SESSION DEBUG: Confirm session cleared
    console.log('🔍 SESSION DEBUG (Clear User Data): Session state after clearing user data', {
      userCleared: true,
      sessionCleared: true,
      profileCleared: true,
      roleCleared: true,
      authStateReset: 'All authentication state has been reset to null',
      timestamp: new Date().toISOString()
    });
    
    console.log('🔴 DEBUG: clearUserData completed - all state cleared');
  }, []); // Empty dependency array - no state dependencies

  // Initialize auth state with aggressive startup validation
  const initializeAuth = useCallback(async () => {
    console.log('🚀 INIT DEBUG: initializeAuth called', {
      alreadyInitialized: initializationRef.current,
      timestamp: new Date().toISOString()
    });
    
    if (initializationRef.current) {
      console.log('⚠️ INIT DEBUG: Already initialized, skipping');
      return;
    }
    
    initializationRef.current = true;
    console.log('🔄 INIT DEBUG: Starting auth initialization');

    try {
      // AGGRESSIVE VALIDATION: Validate cached tokens BEFORE processing any auth state
      // This prevents stale localStorage tokens from causing authenticated UI with invalid sessions
      console.log('🔐 INIT DEBUG: Running aggressive startup validation...');
      const validationResult = await startupSessionValidator.validateOnStartup();
      
      console.log('🔐 INIT DEBUG: Startup validation complete', {
        isValid: validationResult.isValid,
        wasCleared: validationResult.wasCleared,
        reason: validationResult.reason
      });

      // If tokens were cleared due to staleness, show notification and exit early
      if (validationResult.wasCleared) {
        console.log('🔐 INIT DEBUG: Stale tokens were cleared, user needs to re-authenticate');
        
        toast({
          title: 'Session Expired',
          description: 'Your previous session has expired. Please sign in again.',
          variant: 'destructive'
        });
        
        clearUserData();
        sessionValidatedRef.current = true; // Mark as validated (no valid session)
        return;
      }

      // Now proceed with normal session check (tokens are validated)
      const { session, error } = await AuthService.getCurrentSession('initialization');
      
      console.log('📡 INIT DEBUG: Got session from AuthService', {
        hasSession: !!session,
        hasUser: !!session?.user,
        error: error?.message,
        userId: session?.user?.id
      });
      
      // CRITICAL FIX: Mark session as validated IMMEDIATELY after server check
      // This prevents race conditions where UI updates before validation completes
      sessionValidatedRef.current = true;
      console.log('✅ INIT DEBUG: Session validation flag set - UI updates now safe');
      
      if (error) {
        const isTimeoutError = error.message?.includes('timeout');
        const isStaleTokenError = error.message?.includes('Stale token detected');
        console.error('❌ INIT DEBUG: Error getting session:', error);
        
        if (isStaleTokenError) {
          console.log('🔄 INIT DEBUG: Stale token detected, clearing session and showing login');
          
          // Clear any cached session data
          sessionCache.clearCache();
          
          // Show user-friendly stale token message
          toast({
            title: 'Session Expired',
            description: 'Your session has expired. Please sign in again.',
            variant: 'destructive'
          });
          
          clearUserData();
          return;
        }
        
        if (isTimeoutError) {
          console.log('⏳ INIT DEBUG: Timeout detected, attempting recovery...');
          
          // Try to recover from local storage or use guest mode
          try {
            const recoveryResult = await AuthStateRecoveryService.recoverAuthState();
            if (recoveryResult.success && recoveryResult.newState?.session) {
              console.log('✅ INIT DEBUG: Session recovered from backup');
              setSession(recoveryResult.newState.session);
              setUser(recoveryResult.newState.user);
              setProfile(recoveryResult.newState.profile);
              setRole(recoveryResult.newState.role);
              return;
            }
          } catch (recoveryError) {
            console.error('❌ INIT DEBUG: Recovery failed:', recoveryError);
          }
          
          // Show user-friendly timeout message
          toast({
            title: 'Connection Timeout',
            description: 'Having trouble connecting. You can continue in offline mode or try refreshing.',
            variant: 'destructive'
          });
        }
        
        clearUserData();
        return;
      }
      
      if (session?.user) {
        console.log('✅ INIT DEBUG: Valid session found, setting user state AFTER validation');
        setSession(session);
        setUser(session.user);
        
        // Load user data after session is established
        setTimeout(() => {
          console.log('📊 INIT DEBUG: Loading user data for:', session.user.id);
          loadUserData(session.user.id);
        }, 0);
      } else {
        console.log('🚫 INIT DEBUG: No valid session, clearing user data');
        clearUserData();
      }
    } catch (error) {
      console.error('💥 INIT DEBUG: Auth initialization error:', error);
      
      // Mark as validated even on error to prevent hanging UI
      sessionValidatedRef.current = true;
      
      // Enhanced error handling for timeout scenarios
      const isTimeoutError = error instanceof Error && error.message?.includes('timeout');
      if (isTimeoutError) {
        console.log('⏳ INIT DEBUG: Initialization timeout, showing user notification');
        toast({
          title: 'Slow Connection Detected',
          description: 'Authentication is taking longer than usual. Please check your internet connection.',
          variant: 'destructive'
        });
      }
      
      clearUserData();
    } finally {
      console.log('🏁 INIT DEBUG: Setting loading to false and initialDataReady to true');
      setLoading(false);
      setInitialDataReady(true); // Signal that data queries can now start
    }
  }, [loadUserData, toast, clearUserData]);

  // Auth state change handler with enhanced race condition protection
  useEffect(() => {
    console.log('🔍 AUTH DEBUG: Setting up auth state change handler');
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("[AUTH EVENT]", event, session?.user?.id);
        console.log('🔴 AUTH STATE CHANGE:', {
          event,
          userId: session?.user?.id,
          hasSession: !!session,
          timestamp: new Date().toISOString(),
          sessionValidated: sessionValidatedRef.current,
          initializationComplete: initializationRef.current
        });
        
        // ENHANCED RACE CONDITION PROTECTION
        // Block ALL auth state changes until initialization completes server validation
        if (!sessionValidatedRef.current) {
          // Only allow critical auth events that bypass initialization
          const isCriticalEvent = ['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED', 'TOKEN_REFRESHED'].includes(event);
          
          if (!isCriticalEvent) {
            console.log('🛡️ AUTH DEBUG: Blocking auth state change - server validation incomplete', {
              event,
              reason: 'Preventing race condition - waiting for server validation',
              timestamp: new Date().toISOString()
            });
            return;
          }
          
          // For critical events, mark as validated to allow processing
          console.log('🚨 AUTH DEBUG: Critical auth event bypassing validation check', {
            event,
            timestamp: new Date().toISOString()
          });
          sessionValidatedRef.current = true;
        }
        
        // Additional protection: Ensure initialization has started
        if (!initializationRef.current && event === 'INITIAL_SESSION') {
          console.log('⚠️ AUTH DEBUG: INITIAL_SESSION before initialization - deferring');
          return;
        }
        
        // SESSION DEBUG: Log detailed session state during auth changes
        console.log('🔍 SESSION DEBUG (Auth State Change): Processing validated session change', {
          event,
          previousUser: user?.id,
          newUser: session?.user?.id,
          timestamp: new Date().toISOString()
        });
        
        // ATOMIC STATE UPDATE: Update all auth state together to prevent partial updates
        const updateAuthState = () => {
          setSession(session);
          setUser(session?.user ?? null);
          
          // Only update loading state if not during initialization
          if (initializationRef.current) {
            setLoading(false);
          }
        };
        
        // Handle specific auth events with proper sequencing
        switch (event) {
          case 'SIGNED_IN':
            if (session?.user) {
              console.log('✅ AUTH DEBUG: SIGNED_IN event - updating state and loading user data');
              updateAuthState();
              setInitialDataReady(true); // Allow data queries to start
              
              // Defer data loading to prevent deadlocks
              setTimeout(() => {
                loadUserData(session.user.id);
              }, 0);
            }
            break;
            
          case 'SIGNED_OUT':
            console.log('🚪 AUTH DEBUG: SIGNED_OUT event - clearing all user data');
            clearUserData();
            setLoading(false);
            setInitialDataReady(true); // Allow UI to reset properly
            break;
            
          case 'TOKEN_REFRESHED':
            if (session) {
              // CRITICAL: Mark startup validator as externally validated
              // This prevents the validator from clearing tokens if it times out after this refresh
              startupSessionValidator.markAsValidated();
              
              console.log('🔍 SESSION DEBUG (Token Refresh): Session refreshed', {
                userId: session.user?.id,
                newTokenExpiry: session.expires_at,
                timestamp: new Date().toISOString()
              });
              updateAuthState();
              setInitialDataReady(true); // Allow data queries to start
            }
            break;
            
          case 'USER_UPDATED':
            console.log('👤 AUTH DEBUG: USER_UPDATED event - refreshing user data');
            updateAuthState();
            if (session?.user) {
              setTimeout(() => {
                loadUserData(session.user.id);
              }, 0);
            }
            break;
            
          default:
            // For other events, just update state if we have a session
            if (session) {
              updateAuthState();
            } else {
              clearUserData();
              setLoading(false);
            }
        }
        
        console.log('🔄 AUTH DEBUG: Auth state change processing complete', {
          event,
          finalState: {
            hasUser: !!session?.user,
            hasSession: !!session,
            loading: false
          }
        });
      }
    );

    // Initialize auth state - this performs server-side validation
    console.log('🚀 AUTH DEBUG: Calling initializeAuth');
    initializeAuth();

    return () => {
      console.log('🧹 AUTH DEBUG: Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, [initializeAuth, loadUserData, clearUserData]);

  // Auth actions
  const signUp = useCallback(async (data: SignUpData): Promise<boolean> => {
    setErrorLoading(true);
    clearError();

    try {
      ErrorLoggingService.logAuthEvent('signUp_attempt', 'info', {
        operation: 'signUp',
        component: 'NewAuthContext'
      });

      const result = await AuthRetryService.signUpWithRetry(data);
      
      if (!result.success || result.error) {
        const errorResult = ErrorHandlingService.handleError(result.error!, {
          operation: 'signUp',
          component: 'NewAuthContext',
          additionalData: { email: data.email, attempts: result.attempts }
        });
        
        setLastErrorContext(errorResult);
        handleError(result.error as AuthError);
        
        ErrorLoggingService.logAuthEvent('signUp_failed', 'error', {
          operation: 'signUp',
          component: 'NewAuthContext'
        }, { attempts: result.attempts, totalTime: result.totalTime });
        
        return false;
      }

      if (result.data?.user) {
        toast({
          title: 'Account Created',
          description: 'Please check your email to verify your account.',
        });
        
        ErrorLoggingService.logAuthEvent('signUp_success', 'info', {
          operation: 'signUp',
          component: 'NewAuthContext'
        }, { attempts: result.attempts, totalTime: result.totalTime });
        
        return true;
      }

      return false;
    } catch (error) {
      const errorResult = ErrorHandlingService.handleError(error as AuthError, {
        operation: 'signUp',
        component: 'NewAuthContext'
      });
      
      setLastErrorContext(errorResult);
      handleError(error as AuthError);
      return false;
    } finally {
      setErrorLoading(false);
    }
  }, [setErrorLoading, clearError, handleError, toast]);

  const signIn = useCallback(async (data: SignInData): Promise<boolean> => {
    console.log('🔑 SIGNIN DEBUG: signIn called', {
      email: data.email,
      timestamp: new Date().toISOString()
    });
    
    setErrorLoading(true);
    clearError();

    try {
      ErrorLoggingService.logAuthEvent('signIn_attempt', 'info', {
        operation: 'signIn',
        component: 'NewAuthContext'
      });

      console.log('📡 SIGNIN DEBUG: Calling AuthRetryService.signInWithRetry');
      const result = await AuthRetryService.signInWithRetry(data);
      
      console.log('📡 SIGNIN DEBUG: AuthRetryService result', {
        success: result.success,
        hasError: !!result.error,
        hasUser: !!result.data?.user,
        hasSession: !!result.data?.session,
        attempts: result.attempts
      });
      
      if (!result.success || result.error) {
        console.log('❌ SIGNIN DEBUG: Sign in failed', {
          error: result.error?.message,
          attempts: result.attempts
        });
        
        const errorResult = ErrorHandlingService.handleError(result.error!, {
          operation: 'signIn',
          component: 'NewAuthContext',
          additionalData: { email: data.email, attempts: result.attempts }
        });
        
        setLastErrorContext(errorResult);
        setErrorRecoveryAvailable(errorResult.shouldRetry);
        handleError(result.error as AuthError);
        
        ErrorLoggingService.logAuthEvent('signIn_failed', 'error', {
          operation: 'signIn',
          component: 'NewAuthContext'
        }, { attempts: result.attempts, totalTime: result.totalTime });
        
        return false;
      }

      if (result.data?.user && result.data?.session) {
        console.log('✅ SIGNIN DEBUG: Sign in successful', {
          userId: result.data.user.id,
          sessionId: result.data.session.access_token.substring(0, 10) + '...'
        });
        
        toast({
          title: 'Welcome back!',
          description: 'Successfully signed in.',
        });
        
        ErrorLoggingService.logAuthEvent('signIn_success', 'info', {
          operation: 'signIn',
          component: 'NewAuthContext'
        }, { attempts: result.attempts, totalTime: result.totalTime });
        
        return true;
      }

      console.log('⚠️ SIGNIN DEBUG: Sign in returned success but no user/session data');
      return false;
    } catch (error) {
      console.log('💥 SIGNIN DEBUG: Sign in threw exception', error);
      
      const errorResult = ErrorHandlingService.handleError(error as AuthError, {
        operation: 'signIn',
        component: 'NewAuthContext'
      });
      
      setLastErrorContext(errorResult);
      handleError(error as AuthError);
      return false;
    } finally {
      console.log('🏁 SIGNIN DEBUG: Setting error loading to false');
      setErrorLoading(false);
    }
  }, [setErrorLoading, clearError, handleError, toast]);

  const signOut = useCallback(async (): Promise<void> => {
    console.log('🔴 DEBUG: signOut called');
    
    // SESSION DEBUG: Log session state before sign out using refs to avoid stale closures
    console.log('🔍 SESSION DEBUG (Sign Out Start): Session state before sign out process', {
      hasUser: !!userRef.current,
      hasSession: !!sessionRef.current,
      userId: userRef.current?.id,
      userEmail: userRef.current?.email,
      sessionExpiry: sessionRef.current?.expires_at,
      hasProfile: !!profileRef.current,
      hasRole: !!roleRef.current,
      signOutInitiated: true,
      timestamp: new Date().toISOString()
    });
    
    try {
      setErrorLoading(true);
      clearError();
      
      const { error } = await AuthService.signOut();
      
      if (error) {
        console.error('🔴 DEBUG: SignOut error:', error);
        handleError(error, 'Failed to sign out. Please try again.');
        return;
      }
      
      // Clear user data and cache
      clearUserData();
      sessionCache.clearCache();
      
      toast({
        title: 'Signed Out',
        description: 'You have been successfully signed out.',
      });
      
    } catch (error) {
      console.error('🔴 DEBUG: SignOut exception:', error);
      handleError(error as AuthError);
      
      // Even if signOut fails, clear local state and navigate
      clearUserData();
      sessionCache.clearCache();
    } finally {
      setErrorLoading(false);
    }
  }, [setErrorLoading, clearError, handleError, toast, clearUserData]);

  const resendConfirmation = useCallback(async (email: string): Promise<boolean> => {
    setErrorLoading(true);
    clearError();

    try {
      const { error } = await AuthService.resendConfirmation(email);
      
      if (error) {
        handleError(error);
        return false;
      }

      toast({
        title: 'Email Sent',
        description: 'Confirmation email has been sent. Please check your inbox.',
      });
      return true;
    } catch (error) {
      handleError(error as AuthError);
      return false;
    } finally {
      setErrorLoading(false);
    }
  }, [setErrorLoading, clearError, handleError, toast]);

  const resetPassword = useCallback(async (email: string): Promise<boolean> => {
    setErrorLoading(true);
    clearError();

    try {
      const { error } = await AuthService.resetPassword(email);
      
      if (error) {
        handleError(error);
        return false;
      }

      toast({
        title: 'Password Reset Sent',
        description: 'Check your email for password reset instructions.',
      });
      return true;
    } catch (error) {
      handleError(error as AuthError);
      return false;
    } finally {
      setErrorLoading(false);
    }
  }, [setErrorLoading, clearError, handleError, toast]);

  const updatePassword = useCallback(async (password: string): Promise<boolean> => {
    setErrorLoading(true);
    clearError();

    try {
      const { error } = await AuthService.updatePassword(password);
      
      if (error) {
        handleError(error);
        return false;
      }

      toast({
        title: 'Password Updated',
        description: 'Your password has been successfully updated.',
      });
      return true;
    } catch (error) {
      handleError(error as AuthError);
      return false;
    } finally {
      setErrorLoading(false);
    }
  }, [setErrorLoading, clearError, handleError, toast]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>): Promise<boolean> => {
    if (!user) return false;

    setErrorLoading(true);
    clearError();

    try {
      const { profile: updatedProfile, error } = await UserService.updateProfile(user.id, updates);
      
      if (error) {
        handleError(error as AuthError, 'Failed to update profile');
        return false;
      }

      if (updatedProfile) {
        setProfile(updatedProfile);
        toast({
          title: 'Profile Updated',
          description: 'Your profile has been successfully updated.',
        });
        return true;
      }

      return false;
    } catch (error) {
      handleError(error as AuthError);
      return false;
    } finally {
      setErrorLoading(false);
    }
  }, [user, setErrorLoading, clearError, handleError, toast]);

  const refreshProfile = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      await loadUserData(user.id);
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  }, [user, loadUserData]);

  const refreshSession = useCallback(async (): Promise<void> => {
    try {
      const { session: newSession, error } = await SessionService.refreshSession();
      
      if (error) {
        console.error('Session refresh error:', error);
        return;
      }

      if (newSession) {
        setSession(newSession);
        setUser(newSession.user);
      }
    } catch (error) {
      console.error('Session refresh error:', error);
    }
  }, []);

  // Enhanced auth state recovery
  const recoverAuthState = useCallback(async (): Promise<boolean> => {
    try {
      ErrorLoggingService.logAuthEvent('recovery_attempt', 'info', {
        operation: 'recoverAuthState',
        component: 'NewAuthContext'
      });

      const result = await AuthStateRecoveryService.recoverAuthState();
      
      if (result.success && result.newState) {
        if (result.newState.user && result.newState.session) {
          setUser(result.newState.user);
          setSession(result.newState.session);
          setProfile(result.newState.profile);
          setRole(result.newState.role);
        }
        
        toast({
          title: 'Session Recovered',
          description: result.fallbackUsed ? 'Using guest mode' : 'Your session has been restored.',
        });
        
        ErrorLoggingService.logAuthEvent('recovery_success', 'info', {
          operation: 'recoverAuthState',
          component: 'NewAuthContext'
        }, {
          method: result.recoveryMethod,
          fallbackUsed: result.fallbackUsed
        });
        
        return true;
      }
      
      ErrorLoggingService.logAuthEvent('recovery_failed', 'warn', {
        operation: 'recoverAuthState',
        component: 'NewAuthContext'
      }, { error: result.error?.message });
      
      return false;
    } catch (error) {
      ErrorLoggingService.logError(error as Error, {
        operation: 'recoverAuthState',
        component: 'NewAuthContext'
      });
      
      return false;
    }
  }, [toast]);

  // Computed values
  const isAuthenticated = !!user;
  const isEmailVerified = user?.email_confirmed_at != null;
  const isOnboardingComplete = profile?.onboarding_completed || false;
  const isAdmin = role === 'admin';

  const hasRole = useCallback((checkRole: 'admin' | 'user'): boolean => {
    return role === checkRole;
  }, [role]);

  const value: AuthContextType = {
    // Core state
    user,
    session,
    profile,
    role,
    loading,
    initialDataReady,
    
    // Auth states
    isAuthenticated,
    isEmailVerified,
    isOnboardingComplete,
    
    // Auth actions
    signUp,
    signIn,
    signOut,
    resendConfirmation,
    resetPassword,
    updatePassword,
    
    // Profile actions
    updateProfile,
    refreshProfile,
    
    // Session actions
    refreshSession,
    
    // Recovery actions
    recoverAuthState,
    
    // Role checks
    hasRole,
    isAdmin,
    
    // Error handling
    error,
    clearError,
    lastErrorContext,
    errorRecoveryAvailable,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};