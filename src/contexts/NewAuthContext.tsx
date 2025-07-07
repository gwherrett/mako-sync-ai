import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthService, SignUpData, SignInData } from '@/services/auth.service';
import { UserService, UserProfile } from '@/services/user.service';
import { SessionService } from '@/services/session.service';
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
  
  // Role checks
  hasRole: (role: 'admin' | 'user') => boolean;
  isAdmin: boolean;
  
  // Error handling
  error: AuthError | null;
  clearError: () => void;
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
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  }, []);

  // Initialize auth state
  const initializeAuth = useCallback(async () => {
    if (initializationRef.current) return;
    initializationRef.current = true;

    try {
      const { session, error } = await AuthService.getCurrentSession();
      
      if (error) {
        console.error('Error getting session:', error);
        clearUserData();
        return;
      }

      if (session?.user) {
        setSession(session);
        setUser(session.user);
        
        // Load user data after session is established
        setTimeout(() => {
          loadUserData(session.user.id);
        }, 0);
      } else {
        clearUserData();
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      clearUserData();
    } finally {
      setLoading(false);
    }
  }, [clearUserData, loadUserData]);

  // Auth state change handler
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);
        
        // Update state synchronously
        setSession(session);
        setUser(session?.user ?? null);
        
        if (event === 'SIGNED_IN' && session?.user) {
          // Defer data loading to prevent deadlocks
          setTimeout(() => {
            loadUserData(session.user.id);
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          clearUserData();
        }
        
        setLoading(false);
      }
    );

    // Initialize auth state
    initializeAuth();

    return () => subscription.unsubscribe();
  }, [initializeAuth, loadUserData, clearUserData]);

  // Auth actions
  const signUp = useCallback(async (data: SignUpData): Promise<boolean> => {
    setErrorLoading(true);
    clearError();

    try {
      const { user, session, error } = await AuthService.signUp(data);
      
      if (error) {
        handleError(error);
        return false;
      }

      if (user) {
        toast({
          title: 'Account Created',
          description: 'Please check your email to verify your account.',
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
  }, [setErrorLoading, clearError, handleError, toast]);

  const signIn = useCallback(async (data: SignInData): Promise<boolean> => {
    setErrorLoading(true);
    clearError();

    try {
      const { user, session, error } = await AuthService.signIn(data);
      
      if (error) {
        handleError(error);
        return false;
      }

      if (user && session) {
        toast({
          title: 'Welcome back!',
          description: 'Successfully signed in.',
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
  }, [setErrorLoading, clearError, handleError, toast]);

  const signOut = useCallback(async (): Promise<void> => {
    setErrorLoading(true);
    clearError();

    try {
      const { error } = await AuthService.signOut();
      
      if (error) {
        handleError(error, 'Failed to sign out. Please try again.');
        return;
      }

      clearUserData();
      toast({
        title: 'Signed Out',
        description: 'You have been successfully signed out.',
      });
    } catch (error) {
      handleError(error as AuthError);
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
    
    // Role checks
    hasRole,
    isAdmin,
    
    // Error handling
    error,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};