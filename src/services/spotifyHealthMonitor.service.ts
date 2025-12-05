import { supabase } from '@/integrations/supabase/client';
import { SpotifyTokenRefreshService } from './spotifyTokenRefresh.service';
import type { SpotifyConnection } from '@/types/spotify';

interface HealthMetrics {
  connectionStatus: 'healthy' | 'warning' | 'critical' | 'disconnected';
  tokenHealth: 'valid' | 'expiring' | 'expired' | 'invalid';
  lastSuccessfulRefresh: Date | null;
  consecutiveFailures: number;
  lastError: string | null;
  uptime: number; // percentage
  responseTime: number | null; // milliseconds
}

interface HealthAlert {
  id: string;
  type: 'token_expiring' | 'token_expired' | 'refresh_failed' | 'connection_lost' | 'rate_limited';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  autoResolve: boolean;
}

interface MonitoringConfig {
  checkInterval: number; // milliseconds
  alertThresholds: {
    tokenExpiryWarning: number; // minutes
    maxConsecutiveFailures: number;
    minUptime: number; // percentage
    maxResponseTime: number; // milliseconds
  };
  enableAutoRefresh: boolean;
  enableAlerts: boolean;
}

export class SpotifyHealthMonitorService {
  private static instance: SpotifyHealthMonitorService | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private healthMetrics: HealthMetrics | null = null;
  private alerts: HealthAlert[] = [];
  private config: MonitoringConfig;
  private listeners: ((metrics: HealthMetrics, alerts: HealthAlert[]) => void)[] = [];

  private constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = {
      checkInterval: 5 * 60 * 1000, // 5 minutes
      alertThresholds: {
        tokenExpiryWarning: 30, // 30 minutes
        maxConsecutiveFailures: 3,
        minUptime: 95, // 95%
        maxResponseTime: 5000 // 5 seconds
      },
      enableAutoRefresh: true,
      enableAlerts: true,
      ...config
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<MonitoringConfig>): SpotifyHealthMonitorService {
    if (!this.instance) {
      this.instance = new SpotifyHealthMonitorService(config);
    }
    return this.instance;
  }

  /**
   * Start health monitoring
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      console.log('Health monitoring already running');
      return;
    }

    console.log('Starting Spotify health monitoring');
    
    // Initial health check
    this.performHealthCheck();
    
    // Schedule periodic checks
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.checkInterval);
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      console.log('Stopping Spotify health monitoring');
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Get current connection
      const { connection, isConnected } = await this.checkConnection();
      
      const responseTime = Date.now() - startTime;
      
      if (!isConnected || !connection) {
        this.updateHealthMetrics({
          connectionStatus: 'disconnected',
          tokenHealth: 'invalid',
          lastSuccessfulRefresh: this.healthMetrics?.lastSuccessfulRefresh || null,
          consecutiveFailures: (this.healthMetrics?.consecutiveFailures || 0) + 1,
          lastError: 'No Spotify connection found',
          uptime: this.calculateUptime(false),
          responseTime
        });
        
        this.createAlert({
          type: 'connection_lost',
          severity: 'error',
          message: 'Spotify connection not found. Please reconnect your account.',
          autoResolve: false
        });
        
        return;
      }

      // Validate token health
      const tokenHealth = SpotifyTokenRefreshService.validateTokenHealth(connection);
      
      // Test API connectivity
      const apiHealth = await this.testApiConnectivity(connection);
      
      // Determine overall connection status
      const connectionStatus = this.determineConnectionStatus(tokenHealth, apiHealth);
      
      // Update metrics
      this.updateHealthMetrics({
        connectionStatus,
        tokenHealth: this.mapTokenHealthStatus(tokenHealth.status),
        lastSuccessfulRefresh: apiHealth.success ? new Date() : this.healthMetrics?.lastSuccessfulRefresh || null,
        consecutiveFailures: apiHealth.success ? 0 : (this.healthMetrics?.consecutiveFailures || 0) + 1,
        lastError: apiHealth.error || null,
        uptime: this.calculateUptime(apiHealth.success),
        responseTime: apiHealth.responseTime || responseTime
      });

      // Handle token expiry warnings and auto-refresh
      await this.handleTokenHealth(connection, tokenHealth);
      
      // Check for alert conditions
      this.checkAlertConditions();
      
      // Notify listeners
      this.notifyListeners();
      
    } catch (error: any) {
      console.error('Health check failed:', error);
      
      this.updateHealthMetrics({
        connectionStatus: 'critical',
        tokenHealth: 'invalid',
        lastSuccessfulRefresh: this.healthMetrics?.lastSuccessfulRefresh || null,
        consecutiveFailures: (this.healthMetrics?.consecutiveFailures || 0) + 1,
        lastError: error.message,
        uptime: this.calculateUptime(false),
        responseTime: null
      });
      
      this.createAlert({
        type: 'connection_lost',
        severity: 'critical',
        message: `Health check failed: ${error.message}`,
        autoResolve: false
      });
    }
  }

  /**
   * Test API connectivity
   */
  private async testApiConnectivity(connection: SpotifyConnection): Promise<{
    success: boolean;
    error?: string;
    responseTime?: number;
  }> {
    try {
      const startTime = Date.now();
      
      // Simple API test - get user profile
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        return {
          success: false,
          error: 'No active session'
        };
      }

      // Test by calling a lightweight Spotify API endpoint through our edge function
      const response = await supabase.functions.invoke('spotify-sync-liked', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          health_check: true // Flag for health check only
        }
      });

      const responseTime = Date.now() - startTime;

      if (response.error) {
        return {
          success: false,
          error: response.error.message,
          responseTime
        };
      }

      return {
        success: true,
        responseTime
      };
      
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle token health issues
   */
  private async handleTokenHealth(
    connection: SpotifyConnection,
    tokenHealth: ReturnType<typeof SpotifyTokenRefreshService.validateTokenHealth>
  ): Promise<void> {
    // Create alerts for token issues
    if (tokenHealth.status === 'expired') {
      this.createAlert({
        type: 'token_expired',
        severity: 'critical',
        message: 'Spotify access token has expired. Attempting automatic refresh.',
        autoResolve: true
      });
      
      if (this.config.enableAutoRefresh) {
        await this.attemptTokenRefresh(connection);
      }
    } else if (tokenHealth.status === 'warning') {
      const minutesUntilExpiry = Math.floor(tokenHealth.timeUntilExpiry / (1000 * 60));
      
      if (minutesUntilExpiry <= this.config.alertThresholds.tokenExpiryWarning) {
        this.createAlert({
          type: 'token_expiring',
          severity: 'warning',
          message: `Spotify access token expires in ${minutesUntilExpiry} minutes.`,
          autoResolve: true
        });
        
        if (this.config.enableAutoRefresh && minutesUntilExpiry <= 5) {
          await this.attemptTokenRefresh(connection);
        }
      }
    }
  }

  /**
   * Attempt token refresh with monitoring
   */
  private async attemptTokenRefresh(connection: SpotifyConnection): Promise<void> {
    try {
      console.log('Health monitor triggering token refresh');
      
      const result = await SpotifyTokenRefreshService.refreshTokenWithRetry(connection);
      
      if (result.success) {
        console.log('Health monitor: Token refresh successful');
        
        // Resolve related alerts
        this.resolveAlerts(['token_expired', 'token_expiring', 'refresh_failed']);
        
        // Update last successful refresh
        if (this.healthMetrics) {
          this.healthMetrics.lastSuccessfulRefresh = new Date();
          this.healthMetrics.consecutiveFailures = 0;
        }
      } else {
        console.error('Health monitor: Token refresh failed:', result.error);
        
        this.createAlert({
          type: 'refresh_failed',
          severity: 'error',
          message: `Token refresh failed: ${result.error}`,
          autoResolve: false
        });
      }
    } catch (error: any) {
      console.error('Health monitor: Token refresh error:', error);
      
      this.createAlert({
        type: 'refresh_failed',
        severity: 'error',
        message: `Token refresh error: ${error.message}`,
        autoResolve: false
      });
    }
  }

  /**
   * Check for alert conditions
   */
  private checkAlertConditions(): void {
    if (!this.healthMetrics || !this.config.enableAlerts) return;

    const { consecutiveFailures, uptime, responseTime } = this.healthMetrics;
    const { maxConsecutiveFailures, minUptime, maxResponseTime } = this.config.alertThresholds;

    // Check consecutive failures
    if (consecutiveFailures >= maxConsecutiveFailures) {
      this.createAlert({
        type: 'connection_lost',
        severity: 'critical',
        message: `${consecutiveFailures} consecutive connection failures detected.`,
        autoResolve: false
      });
    }

    // Check uptime
    if (uptime < minUptime) {
      this.createAlert({
        type: 'connection_lost',
        severity: 'warning',
        message: `Connection uptime (${uptime.toFixed(1)}%) is below threshold (${minUptime}%).`,
        autoResolve: true
      });
    }

    // Check response time
    if (responseTime && responseTime > maxResponseTime) {
      this.createAlert({
        type: 'connection_lost',
        severity: 'warning',
        message: `Slow response time detected: ${responseTime}ms (threshold: ${maxResponseTime}ms).`,
        autoResolve: true
      });
    }
  }

  /**
   * Utility methods
   */
  private async checkConnection(): Promise<{ connection: SpotifyConnection | null; isConnected: boolean }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return { connection: null, isConnected: false };
      }

      const { data, error } = await supabase
        .from('spotify_connections')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking Spotify connection:', error);
        return { connection: null, isConnected: false };
      }

      if (data) {
        return { connection: data as SpotifyConnection, isConnected: true };
      }

      return { connection: null, isConnected: false };
    } catch (error) {
      console.error('Error checking connection:', error);
      return { connection: null, isConnected: false };
    }
  }

  private determineConnectionStatus(
    tokenHealth: ReturnType<typeof SpotifyTokenRefreshService.validateTokenHealth>,
    apiHealth: { success: boolean }
  ): HealthMetrics['connectionStatus'] {
    if (!apiHealth.success) return 'critical';
    if (tokenHealth.status === 'expired' || tokenHealth.status === 'invalid') return 'critical';
    if (tokenHealth.status === 'warning') return 'warning';
    return 'healthy';
  }

  private mapTokenHealthStatus(status: string): HealthMetrics['tokenHealth'] {
    switch (status) {
      case 'healthy': return 'valid';
      case 'warning': return 'expiring';
      case 'expired': return 'expired';
      default: return 'invalid';
    }
  }

  private calculateUptime(currentSuccess: boolean): number {
    // Simple uptime calculation - in a real implementation, 
    // this would track success/failure over a longer period
    if (!this.healthMetrics) return currentSuccess ? 100 : 0;
    
    // For now, just return a basic calculation
    return currentSuccess ? Math.min(100, this.healthMetrics.uptime + 1) : Math.max(0, this.healthMetrics.uptime - 5);
  }

  private updateHealthMetrics(metrics: HealthMetrics): void {
    this.healthMetrics = metrics;
  }

  private createAlert(alertData: Omit<HealthAlert, 'id' | 'timestamp' | 'acknowledged'>): void {
    // Check if similar alert already exists
    const existingAlert = this.alerts.find(alert => 
      alert.type === alertData.type && !alert.acknowledged
    );

    if (existingAlert) {
      // Update existing alert
      existingAlert.message = alertData.message;
      existingAlert.timestamp = new Date();
      return;
    }

    const alert: HealthAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      acknowledged: false,
      ...alertData
    };

    this.alerts.push(alert);
    
    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-50);
    }
  }

  private resolveAlerts(types: HealthAlert['type'][]): void {
    this.alerts.forEach(alert => {
      if (types.includes(alert.type) && alert.autoResolve) {
        alert.acknowledged = true;
      }
    });
  }

  private notifyListeners(): void {
    if (this.healthMetrics) {
      this.listeners.forEach(listener => {
        try {
          listener(this.healthMetrics!, this.alerts);
        } catch (error) {
          console.error('Error notifying health monitor listener:', error);
        }
      });
    }
  }

  /**
   * Public API methods
   */
  getHealthMetrics(): HealthMetrics | null {
    return this.healthMetrics;
  }

  getAlerts(): HealthAlert[] {
    return [...this.alerts];
  }

  getActiveAlerts(): HealthAlert[] {
    return this.alerts.filter(alert => !alert.acknowledged);
  }

  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  clearAcknowledgedAlerts(): void {
    this.alerts = this.alerts.filter(alert => !alert.acknowledged);
  }

  addListener(listener: (metrics: HealthMetrics, alerts: HealthAlert[]) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart monitoring with new config
    if (this.monitoringInterval) {
      this.stopMonitoring();
      this.startMonitoring();
    }
  }
}

export default SpotifyHealthMonitorService;