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
import { useAuthErrors } from '@/hooks/useAuthErrors';
import { useToast } from '@/hooks/use-toast';

export interface AuthContextType {
  // Core state
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  role: 'admin' | 'user' | null;
  loading: boolean;
  
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
  
  // Error handling
  const { error, setError, clearError, setLoading: setErrorLoading, handleError } = useAuthErrors();
  const { toast } = useToast();
  const initializationRef = useRef(false);
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

  // Clear user data
  const clearUserData = useCallback(() => {
    console.log('🔴 DEBUG: clearUserData called');
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    console.log('🔴 DEBUG: clearUserData completed - all state cleared');
  }, []);

  // Initialize auth state
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
      const { session, error } = await AuthService.getCurrentSession();
      
      console.log('📡 INIT DEBUG: Got session from AuthService', {
        hasSession: !!session,
        hasUser: !!session?.user,
        error: error?.message,
        userId: session?.user?.id
      });
      
      if (error) {
        console.error('❌ INIT DEBUG: Error getting session:', error);
        clearUserData();
        return;
      }

      if (session?.user) {
        console.log('✅ INIT DEBUG: Valid session found, setting user state');
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
      clearUserData();
    } finally {
      console.log('🏁 INIT DEBUG: Setting loading to false');
      setLoading(false);
    }
  }, [clearUserData, loadUserData]);

  // Auth state change handler
  useEffect(() => {
    console.log('🔍 AUTH DEBUG: Setting up auth state change handler');
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔴 AUTH STATE CHANGE:', {
          event,
          userId: session?.user?.id,
          hasSession: !!session,
          timestamp: new Date().toISOString(),
          currentLoading: loading,
          initializationComplete: initializationRef.current
        });
        
        // Prevent race conditions during initialization
        if (!initializationRef.current && event !== 'INITIAL_SESSION') {
          console.log('⚠️ AUTH DEBUG: Ignoring auth change during initialization');
          return;
        }
        
        // Update state synchronously
        setSession(session);
        setUser(session?.user ?? null);
        
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('✅ AUTH DEBUG: SIGNED_IN event - loading user data');
          // Defer data loading to prevent deadlocks
          setTimeout(() => {
            loadUserData(session.user.id);
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          console.log('🚪 AUTH DEBUG: SIGNED_OUT event - clearing user data');
          clearUserData();
        }
        
        console.log('🔄 AUTH DEBUG: Setting loading to false after auth change');
        setLoading(false);
      }
    );

    // Initialize auth state
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
    setErrorLoading(true);
    clearError();

    try {
      console.log('🔴 DEBUG: Calling AuthService.signOut()');
      const { error } = await AuthService.signOut();
      console.log('🔴 DEBUG: AuthService.signOut() result:', { error });
      
      if (error) {
        console.log('🔴 DEBUG: SignOut error detected:', error);
        handleError(error, 'Failed to sign out. Please try again.');
        return;
      }

      console.log('🔴 DEBUG: No error, calling clearUserData()');
      clearUserData();
      console.log('🔴 DEBUG: Showing success toast');
      toast({
        title: 'Signed Out',
        description: 'You have been successfully signed out.',
      });
    } catch (error) {
      console.log('🔴 DEBUG: SignOut caught exception:', error);
      handleError(error as AuthError);
    } finally {
      console.log('🔴 DEBUG: SignOut finally block, setting loading false');
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