import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from '../user.service';
import { supabase } from '@/integrations/supabase/client';

// Mock console to reduce noise
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('UserService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserProfile', () => {
    it('should return user profile when found', async () => {
      const mockProfile = {
        id: 'profile-123',
        user_id: 'user-123',
        display_name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        bio: 'Test bio',
        onboarding_completed: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: mockProfile, error: null })
          })
        })
      } as any);

      const result = await UserService.getUserProfile('user-123');

      expect(result.profile).toEqual(mockProfile);
      expect(result.error).toBeNull();
    });

    it('should return null profile when not found', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      } as any);

      const result = await UserService.getUserProfile('user-456');

      expect(result.profile).toBeNull();
      expect(result.error).toBeNull();
    });

    it('should handle errors', async () => {
      const mockError = { message: 'Database error' };
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: mockError })
          })
        })
      } as any);

      const result = await UserService.getUserProfile('user-123');

      expect(result.profile).toBeNull();
      expect(result.error).toEqual(mockError);
    });

    it('should handle thrown exceptions', async () => {
      vi.mocked(supabase.from).mockImplementation(() => {
        throw new Error('Connection error');
      });

      const result = await UserService.getUserProfile('user-123');

      expect(result.profile).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      const mockProfile = {
        id: 'profile-123',
        user_id: 'user-123',
        display_name: 'Updated Name',
        avatar_url: null,
        bio: null,
        onboarding_completed: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      };

      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockProfile, error: null })
            })
          })
        })
      } as any);

      const result = await UserService.updateProfile('user-123', { display_name: 'Updated Name' });

      expect(result.profile).toEqual(mockProfile);
      expect(result.error).toBeNull();
    });

    it('should handle update errors', async () => {
      const mockError = { message: 'Update failed' };
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: mockError })
            })
          })
        })
      } as any);

      const result = await UserService.updateProfile('user-123', { display_name: 'Test' });

      expect(result.profile).toBeNull();
      expect(result.error).toEqual(mockError);
    });

    it('should handle thrown exceptions', async () => {
      vi.mocked(supabase.from).mockImplementation(() => {
        throw new Error('Connection error');
      });

      const result = await UserService.updateProfile('user-123', { display_name: 'Test' });

      expect(result.profile).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
    });
  });

  describe('getUserRole', () => {
    it('should return user role when found', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
          })
        })
      } as any);

      const result = await UserService.getUserRole('user-123');

      expect(result.role).toBe('admin');
      expect(result.error).toBeNull();
    });

    it('should return null role when not found', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      } as any);

      const result = await UserService.getUserRole('user-123');

      expect(result.role).toBeNull();
      expect(result.error).toBeNull();
    });

    it('should handle errors', async () => {
      const mockError = { message: 'Database error' };
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: mockError })
          })
        })
      } as any);

      const result = await UserService.getUserRole('user-123');

      expect(result.role).toBeNull();
      expect(result.error).toEqual(mockError);
    });

    it('should handle thrown exceptions', async () => {
      vi.mocked(supabase.from).mockImplementation(() => {
        throw new Error('Connection error');
      });

      const result = await UserService.getUserRole('user-123');

      expect(result.role).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
    });
  });

  describe('hasRole', () => {
    it('should return true when user has role', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: true, error: null } as any);

      const result = await UserService.hasRole('user-123', 'admin');

      expect(result.hasRole).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should return false when user does not have role', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: false, error: null } as any);

      const result = await UserService.hasRole('user-123', 'admin');

      expect(result.hasRole).toBe(false);
      expect(result.error).toBeNull();
    });

    it('should return false when data is null', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);

      const result = await UserService.hasRole('user-123', 'admin');

      expect(result.hasRole).toBe(false);
      expect(result.error).toBeNull();
    });

    it('should handle errors', async () => {
      const mockError = { message: 'RPC error' };
      vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: mockError } as any);

      const result = await UserService.hasRole('user-123', 'admin');

      expect(result.hasRole).toBe(false);
      expect(result.error).toEqual(mockError);
    });

    it('should handle thrown exceptions', async () => {
      vi.mocked(supabase.rpc).mockImplementation(() => {
        throw new Error('Connection error');
      });

      const result = await UserService.hasRole('user-123', 'admin');

      expect(result.hasRole).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
    });
  });

  describe('getAllUserRoles', () => {
    it('should return all user roles', async () => {
      const mockRoles = [
        { id: '1', user_id: 'user-1', role: 'admin', created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: '2', user_id: 'user-2', role: 'user', created_at: '2024-01-01', updated_at: '2024-01-01' }
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: mockRoles, error: null })
      } as any);

      const result = await UserService.getAllUserRoles();

      expect(result.roles).toEqual(mockRoles);
      expect(result.error).toBeNull();
    });

    it('should return empty array when no roles found', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: null, error: null })
      } as any);

      const result = await UserService.getAllUserRoles();

      expect(result.roles).toEqual([]);
      expect(result.error).toBeNull();
    });

    it('should handle errors', async () => {
      const mockError = { message: 'Database error' };
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: null, error: mockError })
      } as any);

      const result = await UserService.getAllUserRoles();

      expect(result.roles).toEqual([]);
      expect(result.error).toEqual(mockError);
    });

    it('should handle thrown exceptions', async () => {
      vi.mocked(supabase.from).mockImplementation(() => {
        throw new Error('Connection error');
      });

      const result = await UserService.getAllUserRoles();

      expect(result.roles).toEqual([]);
      expect(result.error).toBeInstanceOf(Error);
    });
  });

  describe('updateUserRole', () => {
    it('should update user role successfully', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      } as any);

      const result = await UserService.updateUserRole('user-123', 'admin');

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should handle update errors', async () => {
      const mockError = { message: 'Update failed' };
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: mockError })
        })
      } as any);

      const result = await UserService.updateUserRole('user-123', 'admin');

      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
    });

    it('should handle thrown exceptions', async () => {
      vi.mocked(supabase.from).mockImplementation(() => {
        throw new Error('Connection error');
      });

      const result = await UserService.updateUserRole('user-123', 'admin');

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
    });
  });

  describe('completeOnboarding', () => {
    it('should complete onboarding successfully', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      } as any);

      const result = await UserService.completeOnboarding('user-123');

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should handle errors', async () => {
      const mockError = { message: 'Update failed' };
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: mockError })
        })
      } as any);

      const result = await UserService.completeOnboarding('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
    });

    it('should handle thrown exceptions', async () => {
      vi.mocked(supabase.from).mockImplementation(() => {
        throw new Error('Connection error');
      });

      const result = await UserService.completeOnboarding('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
    });
  });
});
