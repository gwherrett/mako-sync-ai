/**
 * Rule: Session Cache Timeout Cascading
 * Critical flows must use direct supabase.auth.getSession() instead of timeout wrappers
 */

import { BaseRule } from '../../core/Rule';
import { RuleCategory, RuleSeverity, RuleViolation, ValidationContext } from '../../core/types';

export class SessionCacheDirectCallRule extends BaseRule {
  constructor() {
    super({
      id: 'debug-005-session-cache-direct',
      category: RuleCategory.DEBUGGING,
      severity: RuleSeverity.WARNING,
      description: 'Critical flows should use direct getSession() calls to prevent cascading timeouts',
      rationale:
        '8-second timeout in sessionCache wrappers can cause false-negative session checks during critical flows',
      filePatterns: ['**/*.ts', '**/*.tsx'],
      excludePatterns: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/sessionCache.service.ts']
    });
  }

  validate(context: ValidationContext): RuleViolation[] {
    const violations: RuleViolation[] = [];
    const { fileContent, filePath } = context;

    // Check if this is a critical auth flow file
    const isCriticalAuthFlow =
      filePath.includes('/auth/') ||
      filePath.includes('/contexts/') ||
      filePath.includes('Auth') ||
      filePath.includes('Login') ||
      filePath.includes('Callback');

    if (!isCriticalAuthFlow) {
      return violations;
    }

    const lines = fileContent.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for sessionCache service usage
      if (line.includes('sessionCache') && line.includes('getSession')) {
        const snippet = this.extractCodeSnippet(fileContent, i + 1);

        violations.push(
          this.createViolation(
            context,
            'Critical auth flow should use direct supabase.auth.getSession() instead of sessionCache wrapper',
            i + 1,
            undefined,
            snippet,
            'Replace sessionCache.getSession() with direct supabase.auth.getSession() call'
          )
        );
      }
    }

    return violations;
  }
}
