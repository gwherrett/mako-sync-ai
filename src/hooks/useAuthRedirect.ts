import { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User } from '@supabase/supabase-js';

export interface UseAuthRedirectOptions {
  user: User | null;
  loading: boolean;
  redirectTo?: string;
  loginPath?: string;
  allowedRoles?: ('admin' | 'user')[];
  userRole?: 'admin' | 'user' | null;
}

export const useAuthRedirect = ({
  user,
  loading,
  redirectTo = '/',
  loginPath = '/auth',
  allowedRoles,
  userRole
}: UseAuthRedirectOptions) => {
  const navigate = useNavigate();
  const location = useLocation();

  const redirectToLogin = useCallback(() => {
    // Store the attempted URL for redirect after login
    const returnTo = location.pathname !== loginPath ? location.pathname : redirectTo;
    navigate(loginPath, { 
      state: { returnTo },
      replace: true 
    });
  }, [navigate, location.pathname, loginPath, redirectTo]);

  const redirectToDestination = useCallback(() => {
    // Check if there's a return URL from login
    const returnTo = (location.state as any)?.returnTo || redirectTo;
    navigate(returnTo, { replace: true });
  }, [navigate, location.state, redirectTo]);

  const checkRoleAccess = useCallback((requiredRoles?: ('admin' | 'user')[]) => {
    if (!requiredRoles || requiredRoles.length === 0) return true;
    if (!userRole) return false;
    
    return requiredRoles.includes(userRole);
  }, [userRole]);

  useEffect(() => {
    console.log('🔄 REDIRECT DEBUG: useAuthRedirect effect triggered', {
      hasUser: !!user,
      loading,
      currentPath: location.pathname,
      loginPath,
      allowedRoles,
      userRole,
      timestamp: new Date().toISOString()
    });

    // Don't redirect while loading
    if (loading) {
      console.log('⏳ REDIRECT DEBUG: Skipping redirect - still loading');
      return;
    }

    // If user is not authenticated and not on login page, redirect to login
    if (!user && location.pathname !== loginPath) {
      console.log('🔐 REDIRECT DEBUG: User not authenticated, redirecting to login', {
        from: location.pathname,
        to: loginPath
      });
      redirectToLogin();
      return;
    }

    // If user is authenticated and on login page, redirect to main app
    if (user && location.pathname === loginPath) {
      console.log('✅ REDIRECT DEBUG: User authenticated on login page, redirecting to app', {
        userId: user.id,
        from: loginPath,
        returnTo: (location.state as any)?.returnTo || redirectTo
      });
      redirectToDestination();
      return;
    }

    // Check role-based access
    if (user && allowedRoles && !checkRoleAccess(allowedRoles)) {
      console.log('🚫 REDIRECT DEBUG: User lacks required role, redirecting to home', {
        userId: user.id,
        userRole,
        requiredRoles: allowedRoles
      });
      // Redirect to unauthorized page or main page
      navigate('/', { replace: true });
      return;
    }

    console.log('✅ REDIRECT DEBUG: No redirect needed - user in correct state');
  }, [
    user,
    loading,
    location.pathname,
    loginPath,
    allowedRoles,
    redirectToLogin,
    redirectToDestination,
    checkRoleAccess,
    navigate
  ]);

  return {
    redirectToLogin,
    redirectToDestination,
    checkRoleAccess,
    isAuthenticated: !!user,
    hasRoleAccess: checkRoleAccess(allowedRoles)
  };
};