
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
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.id);
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // When user signs in via OAuth, store their Spotify connection
        if (event === 'SIGNED_IN' && session?.user?.app_metadata?.provider === 'spotify') {
          console.log('Spotify OAuth sign in detected, storing connection...');
          
          // Use setTimeout to ensure the session is fully established
          setTimeout(async () => {
            try {
              console.log('Calling spotify-oauth-handler with session token...');
              const response = await supabase.functions.invoke('spotify-oauth-handler', {
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                },
              });
              
              console.log('OAuth handler response:', response);
              
              if (response.error) {
                console.error('Failed to store Spotify connection:', response.error);
              } else {
                console.log('Spotify connection stored successfully:', response.data);
              }
            } catch (error) {
              console.error('Error calling spotify-oauth-handler:', error);
            }
          }, 1000); // Wait 1 second for session to stabilize
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', session?.user?.id);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
    loading,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
