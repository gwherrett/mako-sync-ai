
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, session, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);

  console.log('=== PROTECTED ROUTE CHECK ===', { 
    hasUser: !!user, 
    hasSession: !!session,
    loading, 
    isChecking,
    currentPath: location.pathname,
    timestamp: new Date().toISOString()
  });

  useEffect(() => {
    if (!loading) {
      // Give a brief moment for the auth state to settle
      const timer = setTimeout(() => {
        console.log('ProtectedRoute: Auth check completed');
        setIsChecking(false);
        
        // If no user/session after loading completes, redirect to auth
        if (!user || !session) {
          console.log('ProtectedRoute: No auth found, redirecting to /auth');
          navigate('/auth', { replace: true });
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [loading, user, session, navigate]);

  // Show loading while auth is initializing or we're checking
  if (loading || isChecking) {
    console.log('ProtectedRoute: Showing loading state');
    return (
      <div className="min-h-screen bg-gradient-to-br from-serato-dark via-serato-dark-elevated to-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-400 mx-auto mb-4" />
          <p className="text-white text-sm">
            {loading ? 'Loading...' : 'Checking authentication...'}
          </p>
        </div>
      </div>
    );
  }

  // If we have user and session, render the protected content
  if (user && session) {
    console.log('ProtectedRoute: User authenticated, rendering children');
    return <>{children}</>;
  }

  // This should not happen due to the redirect above, but just in case
  console.log('ProtectedRoute: Fallback - no auth, should redirect');
  return (
    <div className="min-h-screen bg-gradient-to-br from-serato-dark via-serato-dark-elevated to-black flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-400 mx-auto mb-4" />
        <p className="text-white text-sm">Redirecting...</p>
      </div>
    </div>
  );
};

export default ProtectedRoute;
