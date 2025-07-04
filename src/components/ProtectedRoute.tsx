
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
  const [hasChecked, setHasChecked] = useState(false);

  console.log('ProtectedRoute render:', { 
    hasUser: !!user, 
    hasSession: !!session,
    loading, 
    hasChecked,
    currentPath: location.pathname 
  });

  useEffect(() => {
    console.log('ProtectedRoute useEffect:', { loading, user: !!user, session: !!session });
    
    if (!loading) {
      console.log('Auth loading complete, checking authentication...');
      
      if (!user || !session) {
        console.log('No authentication found, redirecting to /auth');
        navigate('/auth', { replace: true });
      } else {
        console.log('User authenticated, allowing access');
      }
      
      setHasChecked(true);
    }
  }, [loading, user, session, navigate]);

  // Show loading while auth is still loading or we haven't checked yet
  if (loading || !hasChecked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-serato-dark via-serato-dark-elevated to-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-400 mx-auto mb-4" />
          <p className="text-white text-sm">
            {loading ? 'Loading authentication...' : 'Checking access...'}
          </p>
        </div>
      </div>
    );
  }

  // If we have authentication, render the protected content
  if (user && session) {
    console.log('Rendering protected content for authenticated user');
    return <>{children}</>;
  }

  // This should not happen due to the redirect above, but just in case
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
