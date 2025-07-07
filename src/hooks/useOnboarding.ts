import { useState, useEffect, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { UserService, UserProfile } from '@/services/user.service';
import { useToast } from '@/hooks/use-toast';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  required: boolean;
}

export interface UseOnboardingReturn {
  isOnboardingComplete: boolean;
  currentStep: number;
  totalSteps: number;
  steps: OnboardingStep[];
  profile: UserProfile | null;
  isLoading: boolean;
  completeStep: (stepId: string) => void;
  completeOnboarding: () => Promise<void>;
  skipOnboarding: () => Promise<void>;
}

const defaultSteps: OnboardingStep[] = [
  {
    id: 'profile',
    title: 'Complete Profile',
    description: 'Add your display name and avatar',
    completed: false,
    required: true
  },
  {
    id: 'spotify',
    title: 'Connect Spotify',
    description: 'Connect your Spotify account to sync your liked songs',
    completed: false,
    required: false
  }
];

export const useOnboarding = (user: User | null): UseOnboardingReturn => {
  const [steps, setSteps] = useState<OnboardingStep[]>(defaultSteps);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const loadProfile = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { profile, error } = await UserService.getUserProfile(user.id);
      
      if (error) {
        console.error('Error loading profile:', error);
        return;
      }

      setProfile(profile);
      
      // Update steps based on profile data
      if (profile) {
        setSteps(prevSteps => prevSteps.map(step => {
          switch (step.id) {
            case 'profile':
              return {
                ...step,
                completed: !!(profile.display_name)
              };
            case 'spotify':
              // This would be checked against spotify_connections table
              return step; // For now, leave as is
            default:
              return step;
          }
        }));
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const completeStep = useCallback((stepId: string) => {
    setSteps(prevSteps =>
      prevSteps.map(step =>
        step.id === stepId ? { ...step, completed: true } : step
      )
    );
  }, []);

  const completeOnboarding = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { success, error } = await UserService.completeOnboarding(user.id);
      
      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to complete onboarding. Please try again.',
          variant: 'destructive'
        });
        return;
      }

      if (success) {
        setProfile(prev => prev ? { ...prev, onboarding_completed: true } : null);
        toast({
          title: 'Welcome!',
          description: 'Your account setup is complete. Welcome to the app!',
        });
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete onboarding. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  const skipOnboarding = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { success, error } = await UserService.completeOnboarding(user.id);
      
      if (error) {
        console.error('Error skipping onboarding:', error);
        return;
      }

      if (success) {
        setProfile(prev => prev ? { ...prev, onboarding_completed: true } : null);
        toast({
          title: 'Onboarding Skipped',
          description: 'You can complete your profile setup later in settings.',
        });
      }
    } catch (error) {
      console.error('Error skipping onboarding:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const completedSteps = steps.filter(step => step.completed).length;
  const requiredSteps = steps.filter(step => step.required);
  const completedRequiredSteps = requiredSteps.filter(step => step.completed).length;
  const isOnboardingComplete = profile?.onboarding_completed || completedRequiredSteps === requiredSteps.length;

  const currentStep = steps.findIndex(step => !step.completed);

  return {
    isOnboardingComplete,
    currentStep: currentStep === -1 ? steps.length : currentStep,
    totalSteps: steps.length,
    steps,
    profile,
    isLoading,
    completeStep,
    completeOnboarding,
    skipOnboarding
  };
};