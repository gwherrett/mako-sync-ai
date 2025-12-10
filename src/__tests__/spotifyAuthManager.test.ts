import { SpotifyAuthManager } from '@/services/spotifyAuthManager.service';
import { supabase } from '@/integrations/supabase/client';
import type { SpotifyConnection } from '@/types/spotify';

// Mock dependencies
jest.mock('@/integrations/supabase/client');

const mockSupabase = supabase as any;

describe('SpotifyAuthManager', () => {
  let authManager: SpotifyAuthManager;
  let mockConnection: SpotifyConnection;

  beforeEach(() => {
    // Reset singleton instance
    (SpotifyAuthManager as any).instance = null;
    
    // Create fresh instance
    authManager = SpotifyAuthManager.getInstance();
    
    // Mock connection data
    mockConnection = {
      id: 'test-connection-id',
      user_id: 'test-user-id',
      spotify_user_id: 'test-spotify-user',
      access_token: '***ENCRYPTED_IN_VAULT***',
      refresh_token: '***ENCRYPTED_IN_VAULT***',
      access_token_secret_id: 'vault-access-secret-id',
      refresh_token_secret_id: 'vault-refresh-secret-id',
      expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      scope: 'user-read-private user-library-read',
      token_type: 'Bearer',
      display_name: 'Test User',
      email: 'test@example.com',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    authManager.destroy();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = SpotifyAuthManager.getInstance();
      const instance2 = SpotifyAuthManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should accept configuration on first instantiation', () => {
      (SpotifyAuthManager as any).instance = null;
      const config = { autoRefresh: false, healthMonitoring: false };
      const instance = SpotifyAuthManager.getInstance(config);
      expect(instance).toBeDefined();
    });
  });

  describe('State Management', () => {
    it('should initialize with default state', () => {
      const state = authManager.getState();
      expect(state).toEqual({
        isConnected: false,
        isLoading: false,
        connection: null,
        error: null,
        lastCheck: 0,
        healthStatus: 'unknown'
      });
    });

    it('should notify subscribers of state changes', async () => {
      const mockListener = jest.fn();
      const unsubscribe = authManager.subscribe(mockListener);

      // Should call immediately with current state
      expect(mockListener).toHaveBeenCalledWith(authManager.getState());

      unsubscribe();
    });
  });

  describe('Connection Checking', () => {
    it('should check connection successfully', async () => {
      // Mock successful user authentication
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      });

      // Mock successful connection query
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: mockConnection,
              error: null
            })
          })
        })
      });

      const result = await authManager.checkConnection();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockConnection);
      expect(authManager.getState().isConnected).toBe(true);
    });

    it('should handle no user authentication', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      const result = await authManager.checkConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not authenticated');
      expect(authManager.getState().isConnected).toBe(false);
    });

    it('should handle no connection found', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
      });

      const result = await authManager.checkConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No Spotify connection found');
      expect(authManager.getState().isConnected).toBe(false);
    });

    it('should handle database errors', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' }
            })
          })
        })
      });

      const result = await authManager.checkConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error: Database error');
    });

    it('should respect connection check cooldown', async () => {
      // First call
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: mockConnection,
              error: null
            })
          })
        })
      });

      await authManager.checkConnection();

      // Second call immediately should use cache
      const result = await authManager.checkConnection();
      expect(result.metadata?.cached).toBe(true);
    });

    it('should force check when requested', async () => {
      // Setup mocks
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: mockConnection,
              error: null
            })
          })
        })
      });

      // First call
      await authManager.checkConnection();
      
      // Force check should bypass cache
      const result = await authManager.checkConnection(true);
      expect(result.metadata?.cached).toBeUndefined();
    });
  });

  describe('Spotify Connection', () => {
    beforeEach(() => {
      // Mock window.location
      Object.defineProperty(window, 'location', {
        value: {
          origin: 'http://localhost:3000',
          href: ''
        },
        writable: true
      });

      // Mock environment variables
      process.env.VITE_SPOTIFY_CLIENT_ID = 'test-client-id';
      process.env.VITE_SPOTIFY_REDIRECT_URI = 'http://localhost:3000/spotify-callback';
    });

    it('should initiate Spotify connection', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      });

      const result = await authManager.connectSpotify();

      expect(result.success).toBe(true);
      expect(localStorage.getItem('spotify_auth_state')).toBeTruthy();
      expect(sessionStorage.getItem('spotify_auth_state_backup')).toBeTruthy();
    });

    it('should handle missing user', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      const result = await authManager.connectSpotify();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Please log in to connect Spotify');
    });

    it('should handle missing client ID', async () => {
      process.env.VITE_SPOTIFY_CLIENT_ID = '';
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      });

      const result = await authManager.connectSpotify();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Spotify client ID not configured');
    });
  });

  describe('Spotify Disconnection', () => {
    it('should disconnect successfully', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      });

      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null
          })
        })
      });

      const result = await authManager.disconnectSpotify();

      expect(result.success).toBe(true);
      expect(authManager.getState().isConnected).toBe(false);
      expect(authManager.getState().connection).toBe(null);
    });

    it('should handle database error during disconnect', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      });

      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: { message: 'Delete failed' }
          })
        })
      });

      const result = await authManager.disconnectSpotify();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Disconnect failed: Delete failed');
    });
  });

  describe('Token Refresh', () => {
    it('should refresh tokens successfully', async () => {
      // Set up connection state
      authManager['state'].connection = mockConnection;

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
        error: null
      });

      mockSupabase.functions.invoke.mockResolvedValue({
        data: { success: true },
        error: null
      });

      const result = await authManager.refreshTokens();

      expect(result.success).toBe(true);
    });

    it('should handle missing connection', async () => {
      const result = await authManager.refreshTokens();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No connection available for token refresh');
    });
  });

  describe('Sync Operations', () => {
    it('should sync liked songs successfully', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
        error: null
      });

      mockSupabase.functions.invoke.mockResolvedValue({
        data: { success: true, message: 'Sync completed' },
        error: null
      });

      const result = await authManager.syncLikedSongs();

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ success: true, message: 'Sync completed' });
    });

    it('should handle sync errors', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
        error: null
      });

      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Sync failed' }
      });

      const result = await authManager.syncLikedSongs();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Sync failed: Sync failed');
    });
  });

  describe('Health Check', () => {
    it('should perform health check successfully', async () => {
      authManager['state'].connection = mockConnection;

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
        error: null
      });

      mockSupabase.functions.invoke.mockResolvedValue({
        data: { success: true },
        error: null
      });

      const result = await authManager.performHealthCheck();

      expect(result.success).toBe(true);
      expect(authManager.getState().healthStatus).toBe('healthy');
    });

    it('should handle health check failure', async () => {
      authManager['state'].connection = mockConnection;

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
        error: null
      });

      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Health check failed' }
      });

      const result = await authManager.performHealthCheck();

      expect(result.success).toBe(false);
      expect(authManager.getState().healthStatus).toBe('error');
    });
  });

  describe('Security Validation', () => {
    it('should validate security successfully', async () => {
      authManager['state'].connection = mockConnection;

      const result = await authManager.validateSecurity();

      expect(result.success).toBe(true);
      expect(authManager.getState().healthStatus).toBe('healthy');
    });

    it('should handle missing connection for security validation', async () => {
      const result = await authManager.validateSecurity();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No connection available for security validation');
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts gracefully', async () => {
      mockSupabase.auth.getUser.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network timeout')), 100)
        )
      );

      const result = await authManager.checkConnection();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
    });

    it('should handle unexpected errors', async () => {
      mockSupabase.auth.getUser.mockRejectedValue(new Error('Unexpected error'));

      const result = await authManager.checkConnection();

      expect(result.success).toBe(false);
      expect(authManager.getState().error).toBeTruthy();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources on destroy', () => {
      const mockHealthMonitor = {
        stopMonitoring: jest.fn()
      };
      
      authManager['healthMonitor'] = mockHealthMonitor as any;
      
      authManager.destroy();

      expect(mockHealthMonitor.stopMonitoring).toHaveBeenCalled();
      expect((SpotifyAuthManager as any).instance).toBe(null);
    });
  });
});