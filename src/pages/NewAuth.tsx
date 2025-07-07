import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/NewAuthContext';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Music2, Loader2, Eye, EyeOff, Mail } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const NewAuth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResendConfirmation, setShowResendConfirmation] = useState(false);

  const { 
    user, 
    loading, 
    isAuthenticated,
    isEmailVerified,
    signUp, 
    signIn, 
    resendConfirmation,
    error,
    clearError
  } = useAuth();

  // Redirect authenticated users
  useAuthRedirect({
    user,
    loading,
    redirectTo: '/',
    loginPath: '/auth'
  });

  useEffect(() => {
    // Clear error when switching between login/signup
    clearError();
  }, [isLogin, clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    clearError();

    try {
      if (isLogin) {
        const success = await signIn({ email, password });
        if (success) {
          // Redirect will be handled by useAuthRedirect
        } else {
          // Check if the error is related to email confirmation
          if (error?.message?.includes('Email not confirmed')) {
            setShowResendConfirmation(true);
          }
        }
      } else {
        const success = await signUp({ email, password, displayName: displayName || undefined });
        if (success) {
          setIsLogin(true);
          setPassword('');
          setDisplayName('');
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendConfirmation = async () => {
    setIsSubmitting(true);
    try {
      await resendConfirmation(email);
      setShowResendConfirmation(false);
    } catch (error) {
      console.error('Resend confirmation error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setShowPassword(false);
    setShowResendConfirmation(false);
    clearError();
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    resetForm();
  };

  // Show loading while auth state is being determined
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-serato-dark via-serato-dark-elevated to-black flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-400 mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show email verification notice for unverified users
  if (isAuthenticated && !isEmailVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-serato-dark via-serato-dark-elevated to-black flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-spotify-dark border-white/10">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-yellow-400" />
            </div>
            <CardTitle className="text-2xl text-white">
              Verify Your Email
            </CardTitle>
            <CardDescription className="text-gray-400">
              We've sent a verification link to {user?.email}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription className="text-gray-300">
                Please check your email and click the verification link to complete your account setup.
              </AlertDescription>
            </Alert>
            
            <div className="flex flex-col space-y-2">
              <Button 
                onClick={() => resendConfirmation(user?.email || '')}
                variant="outline"
                className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Resend Verification Email'
                )}
              </Button>
              
              <Button 
                onClick={() => window.location.reload()}
                variant="ghost"
                className="w-full text-gray-400 hover:text-white"
              >
                I've verified my email
              </Button>
            </div>
          </CardContent>
        </Card>
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
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </CardTitle>
          <CardDescription className="text-gray-400">
            {isLogin 
              ? 'Sign in to access your music library' 
              : 'Join us to start syncing your music'
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {error && (
            <Alert className="mb-4 border-red-500/20 bg-red-500/10">
              <AlertDescription className="text-red-400">
                {error.message}
              </AlertDescription>
            </Alert>
          )}

          {showResendConfirmation && (
            <Alert className="mb-4 border-yellow-500/20 bg-yellow-500/10">
              <AlertDescription className="text-yellow-400 space-y-2">
                <p>Your email address needs to be verified.</p>
                <Button 
                  onClick={handleResendConfirmation}
                  variant="outline"
                  size="sm"
                  className="bg-yellow-500/20 border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/30"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Resend verification email'
                  )}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="displayName" className="text-white">Display Name (Optional)</Label>
                <Input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder-gray-400"
                  placeholder="Enter your display name"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/10 border-white/20 text-white placeholder-gray-400"
                placeholder="Enter your email"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="bg-white/10 border-white/20 text-white placeholder-gray-400 pr-10"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full spotify-gradient text-black font-medium"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isLogin ? 'Signing in...' : 'Creating account...'}
                </>
              ) : (
                isLogin ? 'Sign In' : 'Create Account'
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center space-y-2">
            <button
              type="button"
              onClick={switchMode}
              className="text-green-400 hover:text-green-300 text-sm transition-colors"
            >
              {isLogin 
                ? "Don't have an account? Sign up" 
                : "Already have an account? Sign in"
              }
            </button>
            
            {isLogin && (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    // This would open a password reset modal or redirect
                    console.log('Password reset requested for:', email);
                  }}
                  className="text-gray-400 hover:text-gray-300 text-xs transition-colors"
                >
                  Forgot your password?
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NewAuth;