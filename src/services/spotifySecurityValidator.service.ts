import { supabase } from '@/integrations/supabase/client';
import type { SpotifyConnection } from '@/types/spotify';

interface SecurityValidationResult {
  isValid: boolean;
  issues: SecurityIssue[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

interface SecurityIssue {
  type: 'token_exposure' | 'weak_encryption' | 'invalid_storage' | 'access_violation' | 'suspicious_activity';
  severity: 'info' | 'warning' | 'error' | 'critical';
  description: string;
  remediation: string;
  timestamp: Date;
}

interface TokenValidationResult {
  isSecure: boolean;
  encryptionStatus: 'encrypted' | 'plaintext' | 'unknown';
  storageLocation: 'vault' | 'database' | 'memory' | 'unknown';
  accessPattern: 'normal' | 'suspicious' | 'unauthorized';
}

interface SecurityMetrics {
  tokenSecurityScore: number; // 0-100
  encryptionCompliance: boolean;
  accessAuditPassed: boolean;
  lastSecurityScan: Date | null;
  vulnerabilitiesFound: number;
  securityIncidents: number;
}

export class SpotifySecurityValidatorService {
  private static readonly SECURITY_PATTERNS = {
    // Patterns that indicate potential security issues
    EXPOSED_TOKEN_PATTERNS: [
      /access_token.*[A-Za-z0-9]{100,}/,
      /refresh_token.*[A-Za-z0-9]{100,}/,
      /Bearer\s+[A-Za-z0-9_-]{50,}/
    ],
    
    // Valid encrypted token indicators
    ENCRYPTED_INDICATORS: [
      '***ENCRYPTED_IN_VAULT***',
      'vault:',
      'encrypted:'
    ]
  };

  /**
   * Perform comprehensive security validation
   */
  static async validateTokenSecurity(connection: SpotifyConnection): Promise<SecurityValidationResult> {
    const issues: SecurityIssue[] = [];
    const recommendations: string[] = [];

    try {
      // 1. Validate token storage security
      const tokenValidation = await this.validateTokenStorage(connection);
      if (!tokenValidation.isSecure) {
        issues.push({
          type: 'invalid_storage',
          severity: 'critical',
          description: `Tokens are not securely stored: ${tokenValidation.storageLocation}`,
          remediation: 'Migrate tokens to encrypted vault storage',
          timestamp: new Date()
        });
      }

      // 2. Check for token exposure
      const exposureCheck = this.checkTokenExposure(connection);
      if (exposureCheck.hasExposure) {
        issues.push({
          type: 'token_exposure',
          severity: 'critical',
          description: 'Potential token exposure detected in connection data',
          remediation: 'Immediately rotate tokens and ensure proper encryption',
          timestamp: new Date()
        });
      }

      // 3. Validate encryption compliance
      const encryptionCheck = await this.validateEncryptionCompliance(connection);
      if (!encryptionCheck.isCompliant) {
        issues.push({
          type: 'weak_encryption',
          severity: 'error',
          description: encryptionCheck.reason || 'Encryption compliance check failed',
          remediation: 'Upgrade to stronger encryption methods',
          timestamp: new Date()
        });
      }

      // 4. Check access patterns
      const accessCheck = await this.validateAccessPatterns(connection);
      if (accessCheck.isSuspicious) {
        issues.push({
          type: 'suspicious_activity',
          severity: 'warning',
          description: 'Unusual access patterns detected',
          remediation: 'Review access logs and consider token rotation',
          timestamp: new Date()
        });
      }

      // 5. Validate vault integrity
      const vaultCheck = await this.verifyVaultStorage(connection);
      if (!vaultCheck.isValid) {
        issues.push({
          type: 'invalid_storage',
          severity: 'error',
          description: 'Vault storage integrity check failed',
          remediation: 'Verify vault configuration and re-encrypt tokens',
          timestamp: new Date()
        });
      }

      // Generate recommendations
      recommendations.push(...this.generateSecurityRecommendations(issues, connection));

      // Calculate risk level
      const riskLevel = this.calculateRiskLevel(issues);

      return {
        isValid: issues.filter(i => i.severity === 'critical' || i.severity === 'error').length === 0,
        issues,
        riskLevel,
        recommendations
      };

    } catch (error: any) {
      console.error('Security validation failed:', error);
      
      return {
        isValid: false,
        issues: [{
          type: 'access_violation',
          severity: 'critical',
          description: `Security validation failed: ${error.message}`,
          remediation: 'Contact system administrator',
          timestamp: new Date()
        }],
        riskLevel: 'critical',
        recommendations: ['Immediate security review required']
      };
    }
  }

  /**
   * Validate token storage security
   */
  private static async validateTokenStorage(connection: SpotifyConnection): Promise<TokenValidationResult> {
    try {
      // Check if tokens are properly stored in vault
      const hasVaultReferences = !!(connection.access_token_secret_id && connection.refresh_token_secret_id);
      
      if (!hasVaultReferences) {
        return {
          isSecure: false,
          encryptionStatus: 'unknown',
          storageLocation: 'database',
          accessPattern: 'normal'
        };
      }

      // Verify vault storage
      const vaultValidation = await this.verifyVaultStorage(connection);
      
      return {
        isSecure: vaultValidation.isValid,
        encryptionStatus: vaultValidation.isValid ? 'encrypted' : 'unknown',
        storageLocation: vaultValidation.isValid ? 'vault' : 'unknown',
        accessPattern: 'normal'
      };

    } catch (error) {
      console.error('Token storage validation failed:', error);
      return {
        isSecure: false,
        encryptionStatus: 'unknown',
        storageLocation: 'unknown',
        accessPattern: 'suspicious'
      };
    }
  }

  /**
   * Check for potential token exposure
   */
  private static checkTokenExposure(connection: SpotifyConnection): { hasExposure: boolean; exposedFields: string[] } {
    const exposedFields: string[] = [];
    
    // Check access_token field
    if (connection.access_token && !this.isTokenEncrypted(connection.access_token)) {
      exposedFields.push('access_token');
    }
    
    // Check refresh_token field
    if (connection.refresh_token && !this.isTokenEncrypted(connection.refresh_token)) {
      exposedFields.push('refresh_token');
    }

    // Check for patterns in other fields that might contain tokens
    const fieldsToCheck = ['display_name', 'email', 'scope'];
    fieldsToCheck.forEach(field => {
      const value = (connection as any)[field];
      if (typeof value === 'string' && this.containsTokenPattern(value)) {
        exposedFields.push(field);
      }
    });

    return {
      hasExposure: exposedFields.length > 0,
      exposedFields
    };
  }

  /**
   * Check if a token value is properly encrypted
   */
  private static isTokenEncrypted(tokenValue: string): boolean {
    return this.SECURITY_PATTERNS.ENCRYPTED_INDICATORS.some(indicator => 
      tokenValue.includes(indicator)
    );
  }

  /**
   * Check if a string contains token patterns
   */
  private static containsTokenPattern(value: string): boolean {
    return this.SECURITY_PATTERNS.EXPOSED_TOKEN_PATTERNS.some(pattern => 
      pattern.test(value)
    );
  }

  /**
   * Validate encryption compliance
   */
  private static async validateEncryptionCompliance(connection: SpotifyConnection): Promise<{
    isCompliant: boolean;
    reason?: string;
  }> {
    try {
      // Check if connection has vault references
      if (!connection.access_token_secret_id || !connection.refresh_token_secret_id) {
        return {
          isCompliant: false,
          reason: 'Missing vault secret references'
        };
      }

      // Verify that actual token fields are encrypted placeholders
      if (!this.isTokenEncrypted(connection.access_token) || 
          !this.isTokenEncrypted(connection.refresh_token)) {
        return {
          isCompliant: false,
          reason: 'Token fields contain unencrypted data'
        };
      }

      return { isCompliant: true };

    } catch (error) {
      return {
        isCompliant: false,
        reason: `Encryption validation failed: ${error}`
      };
    }
  }

  /**
   * Validate access patterns for suspicious activity
   */
  private static async validateAccessPatterns(connection: SpotifyConnection): Promise<{
    isSuspicious: boolean;
    reasons: string[];
  }> {
    const reasons: string[] = [];

    try {
      // Check connection age vs. last update
      const createdAt = new Date(connection.created_at);
      const updatedAt = new Date(connection.updated_at || connection.created_at);
      const now = new Date();

      const daysSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      const daysSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);

      // Flag if connection is very old without updates
      if (daysSinceCreation > 90 && daysSinceUpdate > 30) {
        reasons.push('Connection has not been refreshed in over 30 days');
      }

      // Check token expiry patterns
      const expiresAt = new Date(connection.expires_at);
      const timeUntilExpiry = expiresAt.getTime() - now.getTime();
      
      // Flag if token has been expired for a long time
      if (timeUntilExpiry < -7 * 24 * 60 * 60 * 1000) { // 7 days
        reasons.push('Token has been expired for more than 7 days');
      }

      return {
        isSuspicious: reasons.length > 0,
        reasons
      };

    } catch (error) {
      return {
        isSuspicious: true,
        reasons: [`Access pattern validation failed: ${error}`]
      };
    }
  }

  /**
   * Validate vault storage integrity
   */
  private static async verifyVaultStorage(connection: SpotifyConnection): Promise<{
    isValid: boolean;
    reason?: string;
  }> {
    try {
      if (!connection.access_token_secret_id || !connection.refresh_token_secret_id) {
        return {
          isValid: false,
          reason: 'Missing vault secret IDs'
        };
      }

      // Test vault access by attempting to retrieve secrets
      // Note: This is a simplified check - in production, you might want more sophisticated validation
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        return {
          isValid: false,
          reason: 'No active session for vault validation'
        };
      }

      // Attempt to validate vault access through edge function
      const response = await supabase.functions.invoke('spotify-sync-liked', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          validate_vault: true,
          connection_id: connection.access_token_secret_id
        }
      });

      if (response.error) {
        return {
          isValid: false,
          reason: `Vault validation failed: ${response.error.message}`
        };
      }

      return { isValid: true };

    } catch (error: any) {
      return {
        isValid: false,
        reason: `Vault integrity check failed: ${error.message}`
      };
    }
  }

  /**
   * Generate security recommendations
   */
  private static generateSecurityRecommendations(issues: SecurityIssue[], connection: SpotifyConnection): string[] {
    const recommendations: string[] = [];

    // Critical issues
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push('🚨 IMMEDIATE ACTION REQUIRED: Critical security vulnerabilities detected');
      recommendations.push('• Rotate Spotify tokens immediately');
      recommendations.push('• Review access logs for unauthorized activity');
    }

    // Token exposure
    if (issues.some(i => i.type === 'token_exposure')) {
      recommendations.push('• Migrate to encrypted vault storage');
      recommendations.push('• Implement token rotation policy');
    }

    // Encryption issues
    if (issues.some(i => i.type === 'weak_encryption')) {
      recommendations.push('• Upgrade encryption algorithms');
      recommendations.push('• Implement end-to-end encryption');
    }

    // Access pattern issues
    if (issues.some(i => i.type === 'suspicious_activity')) {
      recommendations.push('• Enable access monitoring and alerting');
      recommendations.push('• Implement rate limiting');
    }

    // General recommendations
    if (issues.length === 0) {
      recommendations.push('✅ Security validation passed');
      recommendations.push('• Continue regular security monitoring');
      recommendations.push('• Schedule periodic security audits');
    } else {
      recommendations.push('• Enable continuous security monitoring');
      recommendations.push('• Implement automated security scanning');
    }

    return recommendations;
  }

  /**
   * Calculate overall risk level
   */
  private static calculateRiskLevel(issues: SecurityIssue[]): SecurityValidationResult['riskLevel'] {
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;

    if (criticalCount > 0) return 'critical';
    if (errorCount > 2) return 'high';
    if (errorCount > 0 || warningCount > 3) return 'medium';
    return 'low';
  }

  /**
   * Generate security metrics
   */
  static async generateSecurityMetrics(connection: SpotifyConnection): Promise<SecurityMetrics> {
    try {
      const validation = await this.validateTokenSecurity(connection);
      
      const tokenSecurityScore = this.calculateSecurityScore(validation);
      const encryptionCompliance = !validation.issues.some(i => i.type === 'weak_encryption' || i.type === 'token_exposure');
      const accessAuditPassed = !validation.issues.some(i => i.type === 'access_violation' || i.type === 'suspicious_activity');
      
      return {
        tokenSecurityScore,
        encryptionCompliance,
        accessAuditPassed,
        lastSecurityScan: new Date(),
        vulnerabilitiesFound: validation.issues.filter(i => i.severity === 'error' || i.severity === 'critical').length,
        securityIncidents: validation.issues.filter(i => i.type === 'access_violation').length
      };

    } catch (error) {
      console.error('Failed to generate security metrics:', error);
      
      return {
        tokenSecurityScore: 0,
        encryptionCompliance: false,
        accessAuditPassed: false,
        lastSecurityScan: new Date(),
        vulnerabilitiesFound: 1,
        securityIncidents: 1
      };
    }
  }

  /**
   * Calculate security score (0-100)
   */
  private static calculateSecurityScore(validation: SecurityValidationResult): number {
    let score = 100;

    validation.issues.forEach(issue => {
      switch (issue.severity) {
        case 'critical':
          score -= 30;
          break;
        case 'error':
          score -= 20;
          break;
        case 'warning':
          score -= 10;
          break;
        case 'info':
          score -= 5;
          break;
      }
    });

    return Math.max(0, score);
  }

  /**
   * Perform automated security remediation
   */
  static async performAutomatedRemediation(connection: SpotifyConnection): Promise<{
    success: boolean;
    actionsPerformed: string[];
    errors: string[];
  }> {
    const actionsPerformed: string[] = [];
    const errors: string[] = [];

    try {
      const validation = await this.validateTokenSecurity(connection);
      
      // Auto-remediate token exposure
      const exposureIssues = validation.issues.filter(i => i.type === 'token_exposure');
      if (exposureIssues.length > 0) {
        try {
          // Trigger token rotation
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session) {
            await supabase.functions.invoke('spotify-sync-liked', {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
              body: {
                force_token_rotation: true
              }
            });
            
            actionsPerformed.push('Rotated exposed tokens');
          }
        } catch (error: any) {
          errors.push(`Token rotation failed: ${error.message}`);
        }
      }

      return {
        success: errors.length === 0,
        actionsPerformed,
        errors
      };

    } catch (error: any) {
      return {
        success: false,
        actionsPerformed,
        errors: [`Automated remediation failed: ${error.message}`]
      };
    }
  }
}

export default SpotifySecurityValidatorService;