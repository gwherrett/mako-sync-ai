
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Music2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/');
      }
    };
    checkUser();
  }, [navigate]);

  const handleSpotifySignIn = async () => {
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'spotify',
        options: {
          scopes: 'user-read-private user-read-email user-library-read playlist-read-private playlist-read-collaborative',
          redirectTo: `${window.location.origin}/`
        }
      });
      
      if (error) throw error;
      
      // The redirect will happen automatically, so we don't need to do anything else here
    } catch (error: any) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-serato-dark via-serato-dark-elevated to-black flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-spotify-dark border-white/10">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Music2 className="w-8 h-8 text-black" />
          </div>
          <CardTitle className="text-2xl text-white">
            Welcome to Groove Sync
          </CardTitle>
          <CardDescription className="text-gray-400">
            Sign in with your Spotify account to sync your music library
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleSpotifySignIn}
            className="w-full spotify-gradient text-black font-medium"
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
                Sign in with Spotify
              </>
            )}
          </Button>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">
              By signing in, you agree to sync your Spotify library data
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
