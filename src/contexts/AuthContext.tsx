
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
    
    let mounted = true;

    // Set up auth state change listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, { 
          hasSession: !!session,
          userId: session?.user?.id,
          provider: session?.user?.app_metadata?.provider
        });
        
        if (!mounted) return;
        
        // Update state immediately
        setSession(session);
        setUser(session?.user ?? null);
        
        if (event === 'SIGNED_IN' && session) {
          console.log('User signed in successfully');
          
          // Handle Spotify OAuth connection storage with minimal delay
          if (session.user?.app_metadata?.provider === 'spotify') {
            console.log('Spotify OAuth detected, calling handler...');
            
            // Call the oauth handler immediately without setTimeout
            try {
              const response = await supabase.functions.invoke('spotify-oauth-handler', {
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json',
                },
              });
              
              console.log('OAuth handler response:', response);
              
              if (response.error) {
                console.error('OAuth handler error:', response.error);
              }
            } catch (error) {
              console.error('Error calling spotify-oauth-handler:', error);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out');
          setSession(null);
          setUser(null);
        }
        
        setLoading(false);
      }
    );

    // Get initial session after setting up the listener
    const getInitialSession = async () => {
      try {
        console.log('Checking for initial session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        console.log('Initial session check result:', { 
          hasSession: !!session, 
          userId: session?.user?.id,
          provider: session?.user?.app_metadata?.provider,
          error: error?.message 
        });
        
        if (!mounted) return;
        
        if (session) {
          console.log('Found existing session, setting state');
          setSession(session);
          setUser(session.user);
        } else {
          console.log('No existing session found');
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error getting initial session:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    return () => {
      mounted = false;
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
      
      // Clear all auth-related storage
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
