
import React from 'react';
import { Music2, Settings, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const SpotifyHeader = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    console.log('=== HEADER SIGN OUT CLICKED ===');
    try {
      await signOut();
      navigate('/auth', { replace: true });
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  return (
    <header className="bg-spotify-dark border-b border-white/10 p-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
            <Music2 className="w-6 h-6 text-black" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Groove Sync</h1>
            <p className="text-sm text-gray-400">
              Music metadata sync for Serato
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="text-sm text-gray-400">
            Welcome, {user?.email}
          </div>
          
          <Button variant="outline" size="sm" className="text-white border-white/20 hover:bg-white/10">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
          
          <Button
            onClick={handleSignOut}
            variant="outline"
            size="sm"
            className="text-white border-white/20 hover:bg-white/10"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
};

export default SpotifyHeader;
