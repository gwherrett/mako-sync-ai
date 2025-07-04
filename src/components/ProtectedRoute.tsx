
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, session, loading } = useAuth();
  const location = useLocation();

  console.log('=== PROTECTED ROUTE CHECK ===', { 
    hasUser: !!user, 
    hasSession: !!session,
    loading, 
    currentPath: location.pathname,
    timestamp: new Date().toISOString()
  });

  // Still loading - show loading state
  if (loading) {
    console.log('ProtectedRoute: Still loading auth state');
    return (
      <div className="min-h-screen bg-gradient-to-br from-serato-dark via-serato-dark-elevated to-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-400" />
      </div>
    );
  }

  // No user or session - redirect to auth but prevent render loops
  if (!user || !session) {
    console.log('ProtectedRoute: No user or session found, redirecting...');
    // Use window.location to ensure clean redirect without React Router loops
    if (location.pathname !== '/auth') {
      window.location.href = '/auth';
    }
    return null;
  }

  console.log('ProtectedRoute: User authenticated, rendering children');
  return <>{children}</>;
};

export default ProtectedRoute;
