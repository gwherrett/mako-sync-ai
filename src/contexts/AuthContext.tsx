
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
          provider: session?.user?.app_metadata?.provider,
          hasProviderToken: !!session?.provider_token,
          currentPath: window.location.pathname
        });
        
        // Set state immediately
        console.log('Setting session and user state...');
        setSession(session);
        setUser(session?.user ?? null);
        
        // Handle different auth events
        if (event === 'SIGNED_IN') {
          console.log('User signed in successfully');
          
          // When user signs in via OAuth, store their Spotify connection
          if (session?.user?.app_metadata?.provider === 'spotify') {
            console.log('=== SPOTIFY OAUTH DETECTED ===');
            
            // Call the OAuth handler with a delay to ensure session is established
            setTimeout(async () => {
              try {
                console.log('=== CALLING OAUTH HANDLER ===');
                
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
                
                console.log('=== OAUTH HANDLER RESPONSE ===', {
                  error: response.error,
                  data: response.data
                });
                
                if (response.error) {
                  console.error('Failed to store Spotify connection:', response.error);
                } else {
                  console.log('Spotify connection stored successfully:', response.data);
                }
              } catch (error) {
                console.error('Error calling spotify-oauth-handler:', error);
              }
            }, 1000);
          }
          
          // Set loading to false after a brief delay to allow everything to settle
          setTimeout(() => {
            setLoading(false);
          }, 1000);
        } else if (event === 'SIGNED_OUT') {
          console.log('=== USER SIGNED OUT ===');
          setSession(null);
          setUser(null);
          setLoading(false);
        } else {
          setLoading(false);
        }
      }
    );

    // Check for existing session
    console.log('=== Checking for existing session ===');
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Error getting session:', error);
        setLoading(false);
      } else {
        console.log('Initial session check:', {
          hasSession: !!session,
          userId: session?.user?.id,
          provider: session?.user?.app_metadata?.provider,
          currentPath: window.location.pathname
        });
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    return () => {
      console.log('=== Cleaning up auth subscription ===');
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    console.log('=== SIGN OUT PROCESS STARTING ===');
    try {
      // Clear local storage of any auth-related data
      console.log('Clearing local storage...');
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          localStorage.removeItem(key);
        }
      });

      // Clear local state immediately
      setSession(null);
      setUser(null);
      
      // Sign out from Supabase with global scope
      console.log('Calling Supabase signOut...');
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) {
        console.error('Supabase sign out error:', error);
      }
      
      console.log('=== SIGN OUT COMPLETE ===');
      
      // Redirect to auth page with signedOut parameter
      window.location.href = '/auth?signedOut=true';
      
    } catch (error) {
      console.error('Error during sign out process:', error);
      // Even if there's an error, still redirect to auth page
      window.location.href = '/auth?signedOut=true';
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
