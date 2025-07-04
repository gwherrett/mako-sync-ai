
import React, { useEffect } from 'react';
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

  console.log('🛡️ ProtectedRoute state:', { 
    hasUser: !!user, 
    hasSession: !!session,
    loading,
    currentPath: location.pathname,
    userId: user?.id
  });

  useEffect(() => {
    if (!loading) {
      console.log('🔍 ProtectedRoute: Auth loading complete, checking authentication...');
      
      if (!user || !session) {
        console.log('🚫 No authentication found, redirecting to /auth');
        navigate('/auth', { replace: true });
      } else {
        console.log('✅ User authenticated, allowing access to:', location.pathname);
      }
    }
  }, [loading, user, session, navigate, location.pathname]);

  // Show loading while auth is still loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-serato-dark via-serato-dark-elevated to-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-400 mx-auto mb-4" />
          <p className="text-white text-sm">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // If authenticated, render protected content
  if (user && session) {
    console.log('✅ Rendering protected content for user:', user.id);
    return <>{children}</>;
  }

  // Fallback loading while redirect happens
  return (
    <div className="min-h-screen bg-gradient-to-br from-serato-dark via-serato-dark-elevated to-black flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-400 mx-auto mb-4" />
        <p className="text-white text-sm">Redirecting to sign in...</p>
      </div>
    </div>
  );
};

export default ProtectedRoute;
