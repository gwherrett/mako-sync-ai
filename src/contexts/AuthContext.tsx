
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
    console.log('🔄 AuthProvider: Initializing auth state...');
    
    let mounted = true;

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔔 Auth state change:', {
          event,
          hasSession: !!session,
          userId: session?.user?.id,
          provider: session?.user?.app_metadata?.provider,
          hasAccessToken: !!session?.access_token,
          hasProviderToken: !!session?.provider_token
        });
        
        if (!mounted) {
          console.log('⚠️ Component unmounted, ignoring auth state change');
          return;
        }
        
        // Update state immediately
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Handle Spotify OAuth connection storage
        if (event === 'SIGNED_IN' && session?.user?.app_metadata?.provider === 'spotify') {
          console.log('🎵 Spotify OAuth detected, calling handler...');
          
          // Call handler without any delays
          supabase.functions.invoke('spotify-oauth-handler', {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }).then(response => {
            console.log('✅ OAuth handler response:', response);
            if (response.error) {
              console.error('❌ OAuth handler error:', response.error);
            }
          }).catch(error => {
            console.error('❌ Error calling spotify-oauth-handler:', error);
          });
        }
        
        if (event === 'SIGNED_OUT') {
          console.log('👋 User signed out');
        }
      }
    );

    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log('🔍 Checking for initial session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        console.log('📋 Initial session result:', { 
          hasSession: !!session, 
          userId: session?.user?.id,
          provider: session?.user?.app_metadata?.provider,
          error: error?.message,
          hasAccessToken: !!session?.access_token
        });
        
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      } catch (error) {
        console.error('❌ Error getting initial session:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    return () => {
      mounted = false;
      console.log('🧹 Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    console.log('🚪 Starting sign out process...');
    try {
      setLoading(true);
      
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) {
        console.error('❌ Supabase sign out error:', error);
      }
      
      // Clear state
      setSession(null);
      setUser(null);
      
      console.log('✅ Sign out complete');
      
    } catch (error) {
      console.error('❌ Error during sign out:', error);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    session,
    loading,
    signOut,
  };

  console.log('🎯 AuthProvider render state:', { 
    hasUser: !!user, 
    hasSession: !!session, 
    loading,
    userId: user?.id,
    provider: user?.app_metadata?.provider
  });

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
