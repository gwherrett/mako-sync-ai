
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
    console.log('=== AuthProvider: Setting up auth state listener ===');
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('=== AUTH STATE CHANGE ===', event, {
          hasSession: !!session,
          userId: session?.user?.id,
          provider: session?.user?.app_metadata?.provider
        });
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // When user signs in via OAuth, store their Spotify connection
        if (event === 'SIGNED_IN' && session?.user?.app_metadata?.provider === 'spotify') {
          console.log('=== SPOTIFY OAUTH DETECTED ===');
          console.log('User metadata:', JSON.stringify(session.user.user_metadata, null, 2));
          console.log('App metadata:', JSON.stringify(session.user.app_metadata, null, 2));
          
          // Use setTimeout to ensure the session is fully established
          setTimeout(async () => {
            try {
              console.log('=== CALLING OAUTH HANDLER ===');
              const response = await supabase.functions.invoke('spotify-oauth-handler', {
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                },
              });
              
              console.log('=== OAUTH HANDLER RESPONSE ===', response);
              
              if (response.error) {
                console.error('Failed to store Spotify connection:', response.error);
              } else {
                console.log('Spotify connection stored successfully');
              }
            } catch (error) {
              console.error('Error calling spotify-oauth-handler:', error);
            }
          }, 2000); // Increased delay to 2 seconds
        }

        // Handle sign out event
        if (event === 'SIGNED_OUT') {
          console.log('=== USER SIGNED OUT ===');
          setSession(null);
          setUser(null);
        }
      }
    );

    // Check for existing session
    console.log('=== Checking for existing session ===');
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Error getting session:', error);
      } else {
        console.log('Initial session check:', {
          hasSession: !!session,
          userId: session?.user?.id,
          provider: session?.user?.app_metadata?.provider
        });
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      console.log('=== Cleaning up auth subscription ===');
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    console.log('=== CONTEXT SIGNING OUT ===');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error during sign out:', error);
        throw error;
      }
      
      // Clear local state
      setSession(null);
      setUser(null);
      
      console.log('=== CONTEXT SIGN OUT COMPLETE ===');
      
      // Force redirect to auth page
      window.location.href = '/auth';
    } catch (error) {
      console.error('Error during sign out:', error);
      throw error;
    }
  };

  const value = {
    user,
    session,
    loading,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
