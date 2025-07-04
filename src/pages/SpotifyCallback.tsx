
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const SpotifyCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const processCallback = async () => {
      try {
        // The OAuth flow should be handled automatically by Supabase
        // We just need to check if the user is now authenticated
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }

        if (session) {
          // User is authenticated via Spotify OAuth
          toast({
            title: "Welcome!",
            description: "Successfully signed in with Spotify",
          });
          navigate('/');
        } else {
          // No session found, redirect to auth
          toast({
            title: "Sign In Required",
            description: "Please sign in with your Spotify account",
            variant: "destructive",
          });
          navigate('/auth');
        }
      } catch (error: any) {
        console.error('Auth callback error:', error);
        toast({
          title: "Authentication Error",
          description: `Failed to complete sign in: ${error.message}`,
          variant: "destructive",
        });
        navigate('/auth');
      }
    };

    processCallback();
  }, [navigate, toast]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-serato-dark via-serato-dark-elevated to-black flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Completing sign in...</h1>
        <p className="text-gray-400">Please wait while we finish setting up your account.</p>
      </div>
    </div>
  );
};

export default SpotifyCallback;
