
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, session, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  console.log('=== PROTECTED ROUTE CHECK ===', { 
    hasUser: !!user, 
    hasSession: !!session,
    loading, 
    currentPath: location.pathname,
    timestamp: new Date().toISOString()
  });

  // Add a small delay to prevent race conditions
  React.useEffect(() => {
    if (!loading && !user && location.pathname !== '/auth') {
      console.log('ProtectedRoute: No user found after loading complete, scheduling redirect...');
      // Use a small timeout to avoid race conditions
      setTimeout(() => {
        console.log('ProtectedRoute: Executing redirect to auth');
        navigate('/auth', { replace: true });
      }, 100);
    }
  }, [user, loading, location.pathname, navigate]);

  if (loading) {
    console.log('ProtectedRoute: Still loading auth state');
    return (
      <div className="min-h-screen bg-gradient-to-br from-serato-dark via-serato-dark-elevated to-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-400" />
      </div>
    );
  }

  if (!user || !session) {
    console.log('ProtectedRoute: No user or session found');
    return null; // Let the useEffect handle the redirect
  }

  console.log('ProtectedRoute: User authenticated, rendering children');
  return <>{children}</>;
};

export default ProtectedRoute;
