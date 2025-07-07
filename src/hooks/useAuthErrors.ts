import { useState, useCallback } from 'react';
import { AuthError } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';

export interface AuthErrorState {
  error: AuthError | null;
  isLoading: boolean;
  hasError: boolean;
}

export interface AuthErrorActions {
  setError: (error: AuthError | null) => void;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
  handleError: (error: AuthError | null, customMessage?: string) => void;
}

export const useAuthErrors = (): AuthErrorState & AuthErrorActions => {
  const [error, setErrorState] = useState<AuthError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const setError = useCallback((error: AuthError | null) => {
    setErrorState(error);
  }, []);

  const clearError = useCallback(() => {
    setErrorState(null);
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setIsLoading(loading);
  }, []);

  const getErrorMessage = useCallback((error: AuthError): string => {
    // Common Supabase auth error messages with user-friendly alternatives
    const errorMap: Record<string, string> = {
      'Invalid login credentials': 'Invalid email or password. Please check your credentials and try again.',
      'Email not confirmed': 'Please check your email and click the confirmation link before signing in.',
      'User already registered': 'An account with this email already exists. Please sign in instead.',
      'Password should be at least 6 characters': 'Password must be at least 6 characters long.',
      'Unable to validate email address: invalid format': 'Please enter a valid email address.',
      'signup_disabled': 'New account registration is currently disabled.',
      'email_address_not_authorized': 'This email address is not authorized to create an account.',
      'weak_password': 'Please choose a stronger password with at least 6 characters.',
      'session_not_found': 'Your session has expired. Please sign in again.',
      'invalid_request': 'Invalid request. Please try again.',
      'too_many_requests': 'Too many requests. Please wait a moment before trying again.',
    };

    return errorMap[error.message] || error.message || 'An unexpected error occurred. Please try again.';
  }, []);

  const handleError = useCallback((error: AuthError | null, customMessage?: string) => {
    setErrorState(error);
    setIsLoading(false);

    if (error) {
      const message = customMessage || getErrorMessage(error);
      
      toast({
        title: 'Authentication Error',
        description: message,
        variant: 'destructive',
      });
    }
  }, [toast, getErrorMessage]);

  return {
    error,
    isLoading,
    hasError: !!error,
    setError,
    clearError,
    setLoading,
    handleError,
  };
};