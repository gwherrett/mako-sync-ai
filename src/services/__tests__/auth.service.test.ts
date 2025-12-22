import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../auth.service';
import { supabase } from '@/integrations/supabase/client';

// Mock the sessionCache
vi.mock('@/services/sessionCache.service', () => ({
  sessionCache: {
    getSession: vi.fn().mockResolvedValue({ session: null, error: null }),
    clearCache: vi.fn(),
  },
}));

// Mock promiseUtils
vi.mock('@/utils/promiseUtils', () => ({
  withTimeout: vi.fn((promise) => promise),
}));

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('signUp', () => {
    it('should sign up a new user successfully', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockSession = { access_token: 'token', user: mockUser };
      
      vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
        data: { user: mockUser as any, session: mockSession as any },
        error: null,
      });

      const result = await AuthService.signUp({
        email: 'test@example.com',
        password: 'password123',
        displayName: 'Test User',
      });

      expect(result.user).toEqual(mockUser);
      expect(result.session).toEqual(mockSession);
      expect(result.error).toBeNull();
    });

    it('should handle sign up error', async () => {
      const mockError = { message: 'User already exists', status: 400 };
      
      vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: mockError as any,
      });

      const result = await AuthService.signUp({
        email: 'existing@example.com',
        password: 'password123',
      });

      expect(result.user).toBeNull();
      expect(result.session).toBeNull();
      expect(result.error).toEqual(mockError);
    });

    it('should handle thrown exceptions', async () => {
      vi.mocked(supabase.auth.signUp).mockRejectedValueOnce(new Error('Network error'));

      const result = await AuthService.signUp({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.user).toBeNull();
      expect(result.session).toBeNull();
      expect(result.error).toBeDefined();
    });
  });

  describe('signIn', () => {
    it('should sign in an existing user successfully', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockSession = { access_token: 'token', user: mockUser };
      
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
        data: { user: mockUser as any, session: mockSession as any },
        error: null,
      });

      const result = await AuthService.signIn({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.user).toEqual(mockUser);
      expect(result.session).toEqual(mockSession);
      expect(result.error).toBeNull();
    });

    it('should handle invalid credentials', async () => {
      const mockError = { message: 'Invalid login credentials', status: 401 };
      
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: mockError as any,
      });

      const result = await AuthService.signIn({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      expect(result.user).toBeNull();
      expect(result.session).toBeNull();
      expect(result.error).toEqual(mockError);
    });

    it('should handle thrown exceptions', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockRejectedValueOnce(new Error('Network error'));

      const result = await AuthService.signIn({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.user).toBeNull();
      expect(result.session).toBeNull();
      expect(result.error).toBeDefined();
    });
  });

  describe('signOut', () => {
    it('should sign out successfully', async () => {
      vi.mocked(supabase.auth.signOut).mockResolvedValueOnce({ error: null });

      const result = await AuthService.signOut();

      expect(result.error).toBeNull();
    });

    it('should handle sign out error and fallback to local signout', async () => {
      const { withTimeout } = await import('@/utils/promiseUtils');
      vi.mocked(withTimeout).mockRejectedValueOnce(new Error('Timeout'));
      vi.mocked(supabase.auth.signOut).mockResolvedValueOnce({ error: null });

      const result = await AuthService.signOut();

      // Should succeed after fallback
      expect(result.error).toBeNull();
    });
  });

  describe('getCurrentSession', () => {
    it('should return session from cache', async () => {
      const { sessionCache } = await import('@/services/sessionCache.service');
      const mockSession = { access_token: 'token', user: { id: 'user-123' } };
      
      vi.mocked(sessionCache.getSession).mockResolvedValueOnce({
        session: mockSession as any,
        error: null,
      });

      const result = await AuthService.getCurrentSession();

      expect(result.session).toEqual(mockSession);
      expect(result.error).toBeNull();
    });

    it('should handle cache error', async () => {
      const { sessionCache } = await import('@/services/sessionCache.service');
      const mockError = { message: 'Cache error' };
      
      vi.mocked(sessionCache.getSession).mockResolvedValueOnce({
        session: null,
        error: mockError,
      });

      const result = await AuthService.getCurrentSession();

      expect(result.session).toBeNull();
      expect(result.error).toEqual(mockError);
    });

    it('should use initialization priority for initialization context', async () => {
      const { sessionCache } = await import('@/services/sessionCache.service');
      
      await AuthService.getCurrentSession('initialization');

      expect(sessionCache.getSession).toHaveBeenCalledWith(
        false,
        'auth-service-initialization',
        'initialization'
      );
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      
      vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
        data: { user: mockUser as any },
        error: null,
      });

      const result = await AuthService.getCurrentUser();

      expect(result.user).toEqual(mockUser);
      expect(result.error).toBeNull();
    });

    it('should handle error', async () => {
      const mockError = { message: 'Not authenticated' };
      
      vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
        data: { user: null },
        error: mockError as any,
      });

      const result = await AuthService.getCurrentUser();

      expect(result.user).toBeNull();
      expect(result.error).toEqual(mockError);
    });
  });

  describe('resetPassword', () => {
    it('should send reset password email', async () => {
      vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValueOnce({
        data: {},
        error: null,
      });

      const result = await AuthService.resetPassword('test@example.com');

      expect(result.error).toBeNull();
      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({ redirectTo: expect.stringContaining('/reset-password') })
      );
    });

    it('should handle error', async () => {
      const mockError = { message: 'User not found' };
      
      vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValueOnce({
        data: {},
        error: mockError as any,
      });

      const result = await AuthService.resetPassword('nonexistent@example.com');

      expect(result.error).toEqual(mockError);
    });
  });

  describe('updatePassword', () => {
    it('should update password successfully', async () => {
      vi.mocked(supabase.auth.updateUser).mockResolvedValueOnce({
        data: { user: { id: 'user-123' } as any },
        error: null,
      });

      const result = await AuthService.updatePassword('newpassword123');

      expect(result.error).toBeNull();
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'newpassword123' });
    });

    it('should handle error', async () => {
      const mockError = { message: 'Password too weak' };
      
      vi.mocked(supabase.auth.updateUser).mockResolvedValueOnce({
        data: { user: null },
        error: mockError as any,
      });

      const result = await AuthService.updatePassword('weak');

      expect(result.error).toEqual(mockError);
    });
  });

  describe('resendConfirmation', () => {
    it('should resend confirmation email', async () => {
      vi.mocked(supabase.auth.resend).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: null,
      });

      const result = await AuthService.resendConfirmation('test@example.com');

      expect(result.error).toBeNull();
      expect(supabase.auth.resend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'test@example.com',
        options: expect.objectContaining({ emailRedirectTo: expect.any(String) }),
      });
    });

    it('should handle error', async () => {
      const mockError = { message: 'Rate limited' };
      
      vi.mocked(supabase.auth.resend).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: mockError as any,
      });

      const result = await AuthService.resendConfirmation('test@example.com');

      expect(result.error).toEqual(mockError);
    });
  });

  describe('clearAuthCache', () => {
    it('should clear localStorage auth keys', () => {
      localStorage.setItem('sb-test-auth-token', 'token');
      localStorage.setItem('auth-state', 'state');
      
      AuthService.clearAuthCache();

      expect(localStorage.removeItem).toHaveBeenCalled();
    });

    it('should clear sessionStorage', () => {
      sessionStorage.setItem('test', 'value');
      
      AuthService.clearAuthCache();

      expect(sessionStorage.clear).toHaveBeenCalled();
    });
  });

  describe('refreshSession', () => {
    it('should refresh session successfully', async () => {
      const mockSession = { access_token: 'new-token', user: { id: 'user-123' } };
      
      vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
        data: { session: mockSession as any },
        error: null,
      });

      const result = await AuthService.refreshSession();

      expect(result.session).toEqual(mockSession);
      expect(result.error).toBeNull();
    });

    it('should handle refresh error', async () => {
      const mockError = { message: 'Session expired' };
      
      vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
        data: { session: null },
        error: mockError as any,
      });

      const result = await AuthService.refreshSession();

      expect(result.session).toBeNull();
      expect(result.error).toEqual(mockError);
    });
  });
});
