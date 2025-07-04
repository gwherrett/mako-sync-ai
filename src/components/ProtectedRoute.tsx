
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, session, loading } = useAuth();
  const location = useLocation();
  const [hasWaited, setHasWaited] = useState(false);

  console.log('=== PROTECTED ROUTE CHECK ===', { 
    hasUser: !!user, 
    hasSession: !!session,
    loading, 
    hasWaited,
    currentPath: location.pathname,
    timestamp: new Date().toISOString()
  });

  // Add a delay to allow session to fully establish
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        console.log('ProtectedRoute: Wait period completed');
        setHasWaited(true);
      }, 1500); // Wait 1.5 seconds after loading completes

      return () => clearTimeout(timer);
    }
  }, [loading]);

  // Still loading auth state or waiting for session confirmation
  if (loading || !hasWaited) {
    console.log('ProtectedRoute: Still loading or waiting for session confirmation');
    return (
      <div className="min-h-screen bg-gradient-to-br from-serato-dark via-serato-dark-elevated to-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-400 mx-auto mb-4" />
          <p className="text-white text-sm">
            {loading ? 'Loading...' : 'Confirming authentication...'}
          </p>
        </div>
      </div>
    );
  }

  // No user or session after waiting - redirect to auth
  if (!user || !session) {
    console.log('ProtectedRoute: No user or session found after waiting, redirecting...');
    // Use window.location to ensure clean redirect without React Router loops
    if (location.pathname !== '/auth') {
      window.location.href = '/auth';
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-serato-dark via-serato-dark-elevated to-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-400 mx-auto mb-4" />
          <p className="text-white text-sm">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  console.log('ProtectedRoute: User authenticated, rendering children');
  return <>{children}</>;
};

export default ProtectedRoute;
