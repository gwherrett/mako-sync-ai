
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Music2, Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, session, loading } = useAuth();
  const signedOut = searchParams.get('signedOut') === 'true';

  console.log('🔐 Auth page state:', { 
    hasUser: !!user, 
    hasSession: !!session, 
    loading, 
    signedOut,
    currentPath: window.location.pathname,
    userId: user?.id
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && user && session) {
      console.log('✅ User already authenticated, redirecting to home');
      navigate('/', { replace: true });
    }
  }, [user, session, loading, navigate]);

  const handleSpotifySignIn = async () => {
    console.log('🎵 Starting Spotify sign in process...');
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'spotify',
        options: {
          scopes: 'user-read-private user-read-email user-library-read playlist-read-private playlist-read-collaborative',
          redirectTo: `${window.location.origin}/`,
        }
      });
      
      if (error) {
        console.error('❌ OAuth error:', error);
        throw error;
      }
      
      console.log('🔄 OAuth redirect initiated...');
    } catch (error: any) {
      console.error('❌ Sign in error:', error);
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  // Show loading while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-serato-dark via-serato-dark-elevated to-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-400 mx-auto mb-4" />
          <p className="text-white text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render auth form if user is already authenticated
  if (user && session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-serato-dark via-serato-dark-elevated to-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-400 mx-auto mb-4" />
          <p className="text-white text-sm">Redirecting to app...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-serato-dark via-serato-dark-elevated to-black flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-spotify-dark border-white/10">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Music2 className="w-8 h-8 text-black" />
          </div>
          <CardTitle className="text-2xl text-white">
            {signedOut ? 'You\'ve been signed out' : 'Welcome to Groove Sync'}
          </CardTitle>
          <CardDescription className="text-gray-400">
            {signedOut 
              ? 'Thanks for using Groove Sync. Sign in again to continue syncing your music library.'
              : 'Sign in with your Spotify account to sync your music library and extract metadata for Serato'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleSpotifySignIn}
            className="w-full spotify-gradient text-black font-medium hover:opacity-90 transition-opacity"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting to Spotify...
              </>
            ) : (
              <>
                <Music2 className="w-4 h-4 mr-2" />
                {signedOut ? 'Sign in again with Spotify' : 'Sign in with Spotify'}
              </>
            )}
          </Button>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">
              By signing in, you agree to sync your Spotify library data for use with Serato DJ software
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
