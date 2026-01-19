import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpotifyAuthManager } from '@/services/spotifyAuthManager.service';
import type { SpotifyConnection } from '@/types/spotify';

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
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      scope: 'user-read-private user-library-read',
      token_type: 'Bearer',
      display_name: 'Test User',
      email: 'test@example.com',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Reset all mocks
    vi.clearAllMocks();
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
      const mockListener = vi.fn();
      const unsubscribe = authManager.subscribe(mockListener);

      // Should call immediately with current state
      expect(mockListener).toHaveBeenCalledWith(authManager.getState());

      unsubscribe();
    });

    it('should allow unsubscribing from state changes', () => {
      const mockListener = vi.fn();
      const unsubscribe = authManager.subscribe(mockListener);

      // Clear the initial call
      mockListener.mockClear();

      // Unsubscribe
      unsubscribe();

      // Trigger a state update directly
      authManager['updateState']({ error: 'test error' });

      // Should not have been called after unsubscribe
      expect(mockListener).not.toHaveBeenCalled();
    });
  });

  describe('Token Refresh', () => {
    it('should handle missing connection', async () => {
      const result = await authManager.refreshTokens();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No connection available for token refresh');
    });
  });

  describe('Security Validation', () => {
    it('should validate security successfully when connection exists', async () => {
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

  describe('Cleanup', () => {
    it('should cleanup resources on destroy', () => {
      const mockHealthMonitor = {
        stopMonitoring: vi.fn()
      };

      authManager['healthMonitor'] = mockHealthMonitor as any;

      authManager.destroy();

      expect(mockHealthMonitor.stopMonitoring).toHaveBeenCalled();
      expect((SpotifyAuthManager as any).instance).toBe(null);
    });

    it('should reset singleton instance on destroy', () => {
      authManager.destroy();
      expect((SpotifyAuthManager as any).instance).toBe(null);

      // New instance should be different
      const newInstance = SpotifyAuthManager.getInstance();
      expect(newInstance).not.toBe(authManager);
    });
  });

  describe('Optimistic Updates', () => {
    it('should set connection optimistically', () => {
      authManager.setConnectedOptimistically('spotify-123', 'Test Display Name');

      const state = authManager.getState();
      expect(state.isConnected).toBe(true);
      expect(state.connection?.spotify_user_id).toBe('spotify-123');
      expect(state.connection?.display_name).toBe('Test Display Name');
    });
  });

  describe('Connection Check Cooldown', () => {
    it('should respect cooldown for repeated checks', async () => {
      // Set a recent lastCheck time
      authManager['state'].lastCheck = Date.now();
      authManager['state'].isConnected = true;
      authManager['state'].connection = mockConnection;

      const result = await authManager.checkConnection();

      // Should return cached result
      expect(result.metadata?.cached).toBe(true);
    });

    it('should bypass cooldown when force is true', async () => {
      // Set a recent lastCheck time
      authManager['state'].lastCheck = Date.now();
      authManager['state'].isConnected = true;
      authManager['state'].connection = mockConnection;

      const result = await authManager.checkConnection(true);

      // Force should bypass cache (though may still fail due to no real connection)
      expect(result.metadata?.cached).toBeFalsy();
    });
  });
});
