
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AuthProvider: Initializing auth state...');
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('Initial session check:', { 
        hasSession: !!session, 
        userId: session?.user?.id,
        error: error?.message 
      });
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state change:', event, { 
          hasSession: !!session,
          userId: session?.user?.id,
          provider: session?.user?.app_metadata?.provider
        });
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (event === 'SIGNED_IN') {
          console.log('User signed in successfully');
          
          // Handle Spotify OAuth connection storage
          if (session?.user?.app_metadata?.provider === 'spotify') {
            console.log('Spotify OAuth detected, calling handler...');
            
            setTimeout(async () => {
              try {
                const response = await supabase.functions.invoke('spotify-oauth-handler', {
                  headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                  },
                  body: {
                    sessionData: {
                      provider_token: session.provider_token,
                      provider_refresh_token: session.provider_refresh_token,
                      user_metadata: session.user.user_metadata
                    }
                  }
                });
                
                console.log('OAuth handler response:', response);
              } catch (error) {
                console.error('Error calling spotify-oauth-handler:', error);
              }
            }, 500);
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out');
          setSession(null);
          setUser(null);
        }
        
        setLoading(false);
      }
    );

    return () => {
      console.log('Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    console.log('Starting sign out process...');
    try {
      // Clear local state immediately
      setSession(null);
      setUser(null);
      
      // Clear local storage
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          localStorage.removeItem(key);
        }
      });

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) {
        console.error('Supabase sign out error:', error);
      }
      
      console.log('Sign out complete, redirecting...');
      
      // Force redirect to auth page
      window.location.href = '/auth?signedOut=true';
      
    } catch (error) {
      console.error('Error during sign out:', error);
      // Still redirect even if there's an error
      window.location.href = '/auth?signedOut=true';
    }
  };

  const value = {
    user,
    session,
    loading,
    signOut,
  };

  console.log('AuthProvider render:', { 
    hasUser: !!user, 
    hasSession: !!session, 
    loading 
  });

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
