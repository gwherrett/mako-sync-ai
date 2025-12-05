import { toast } from '@/hooks/use-toast';

export interface Phase4Error {
  service: 'token-refresh' | 'health-monitor' | 'security-validator' | 'edge-function';
  operation: string;
  error: Error | string;
  context?: Record<string, any>;
  timestamp: Date;
}

export class Phase4ErrorHandlerService {
  private static errors: Phase4Error[] = [];
  private static readonly MAX_ERRORS = 100;

  /**
   * Handle and log Phase 4 service errors
   */
  static handleError(
    service: Phase4Error['service'],
    operation: string,
    error: Error | string,
    context?: Record<string, any>,
    showToast: boolean = true
  ): void {
    const phase4Error: Phase4Error = {
      service,
      operation,
      error,
      context,
      timestamp: new Date()
    };

    // Add to error log
    this.errors.unshift(phase4Error);
    if (this.errors.length > this.MAX_ERRORS) {
      this.errors = this.errors.slice(0, this.MAX_ERRORS);
    }

    // Log to console
    console.error(`[Phase4 ${service}] ${operation}:`, error, context);

    // Show user-friendly toast notification
    if (showToast) {
      this.showUserFriendlyError(phase4Error);
    }
  }

  /**
   * Show user-friendly error messages
   */
  private static showUserFriendlyError(error: Phase4Error): void {
    const errorMessage = typeof error.error === 'string' ? error.error : error.error.message;
    
    let title = 'Service Error';
    let description = errorMessage;
    let variant: 'default' | 'destructive' = 'destructive';

    // Customize messages based on service and error type
    switch (error.service) {
      case 'token-refresh':
        title = 'Token Refresh Issue';
        if (errorMessage.includes('invalid_grant') || errorMessage.includes('refresh token is invalid')) {
          description = 'Your Spotify connection has expired. Please reconnect your account.';
        } else if (errorMessage.includes('rate limit')) {
          description = 'Spotify rate limit reached. Please wait a moment before trying again.';
          variant = 'default';
        } else {
          description = 'Failed to refresh Spotify tokens. Connection may be unstable.';
        }
        break;

      case 'health-monitor':
        title = 'Connection Health Issue';
        if (errorMessage.includes('No active session')) {
          description = 'Please log in again to continue monitoring your connection.';
        } else if (errorMessage.includes('Health check failed')) {
          description = 'Unable to verify Spotify connection health. Check your internet connection.';
        } else {
          description = 'Connection monitoring encountered an issue.';
        }
        break;

      case 'security-validator':
        title = 'Security Validation Issue';
        if (errorMessage.includes('Vault validation failed')) {
          description = 'Unable to verify secure token storage. Your connection may need to be reset.';
        } else if (errorMessage.includes('Token exposure detected')) {
          description = 'Security issue detected with your tokens. Please reconnect your Spotify account.';
        } else {
          description = 'Security validation encountered an issue.';
        }
        break;

      case 'edge-function':
        title = 'Service Communication Error';
        if (errorMessage.includes('Unauthorized')) {
          description = 'Authentication expired. Please log in again.';
        } else if (errorMessage.includes('Spotify not connected')) {
          description = 'Please connect your Spotify account to continue.';
        } else {
          description = 'Unable to communicate with backend services.';
        }
        break;
    }

    toast({
      title,
      description,
      variant,
    });
  }

  /**
   * Get recent errors for debugging
   */
  static getRecentErrors(limit: number = 10): Phase4Error[] {
    return this.errors.slice(0, limit);
  }

  /**
   * Get errors by service
   */
  static getErrorsByService(service: Phase4Error['service']): Phase4Error[] {
    return this.errors.filter(error => error.service === service);
  }

  /**
   * Clear error log
   */
  static clearErrors(): void {
    this.errors = [];
  }

  /**
   * Get error statistics
   */
  static getErrorStats(): {
    total: number;
    byService: Record<Phase4Error['service'], number>;
    recentCount: number; // Last 5 minutes
  } {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const byService = this.errors.reduce((acc, error) => {
      acc[error.service] = (acc[error.service] || 0) + 1;
      return acc;
    }, {} as Record<Phase4Error['service'], number>);

    const recentCount = this.errors.filter(error => error.timestamp > fiveMinutesAgo).length;

    return {
      total: this.errors.length,
      byService,
      recentCount
    };
  }

  /**
   * Check if a service is experiencing issues
   */
  static isServiceHealthy(service: Phase4Error['service']): boolean {
    const recentErrors = this.errors.filter(error => 
      error.service === service && 
      error.timestamp > new Date(Date.now() - 5 * 60 * 1000)
    );

    // Consider unhealthy if more than 3 errors in last 5 minutes
    return recentErrors.length <= 3;
  }

  /**
   * Get service health status
   */
  static getServiceHealth(): Record<Phase4Error['service'], 'healthy' | 'degraded' | 'unhealthy'> {
    const services: Phase4Error['service'][] = ['token-refresh', 'health-monitor', 'security-validator', 'edge-function'];
    
    return services.reduce((acc, service) => {
      const recentErrors = this.errors.filter(error => 
        error.service === service && 
        error.timestamp > new Date(Date.now() - 5 * 60 * 1000)
      );

      if (recentErrors.length === 0) {
        acc[service] = 'healthy';
      } else if (recentErrors.length <= 3) {
        acc[service] = 'degraded';
      } else {
        acc[service] = 'unhealthy';
      }

      return acc;
    }, {} as Record<Phase4Error['service'], 'healthy' | 'degraded' | 'unhealthy'>);
  }
}

export default Phase4ErrorHandlerService;