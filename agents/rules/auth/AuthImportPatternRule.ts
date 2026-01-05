/**
 * Rule: Auth Import Pattern
 * Always import from @/contexts/NewAuthContext
 */

import { BaseRule } from '../../core/Rule';
import { RuleCategory, RuleSeverity, RuleViolation, ValidationContext } from '../../core/types';

export class AuthImportPatternRule extends BaseRule {
  constructor() {
    super({
      id: 'auth-002-import-pattern',
      category: RuleCategory.CODING_PATTERN,
      severity: RuleSeverity.ERROR,
      description: "Auth imports must use '@/contexts/NewAuthContext' path",
      rationale: 'Ensures consistent auth context usage across the application',
      filePatterns: ['**/*.ts', '**/*.tsx'],
      excludePatterns: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/NewAuthContext.tsx']
    });
  }

  validate(context: ValidationContext): RuleViolation[] {
    const violations: RuleViolation[] = [];
    const { fileContent } = context;

    const lines = fileContent.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for auth-related imports from wrong paths
      if (line.includes('import') && line.includes('useAuth')) {
        // Check if it's importing from the correct path
        if (!line.includes('@/contexts/NewAuthContext')) {
          // Could be importing from relative path or different location
          const snippet = this.extractCodeSnippet(fileContent, i + 1);

          violations.push(
            this.createViolation(
              context,
              "Auth imports must use '@/contexts/NewAuthContext' path",
              i + 1,
              undefined,
              snippet,
              "Use: import { useAuth } from '@/contexts/NewAuthContext'"
            )
          );
        }
      }

      // Check for AuthProvider imports (should use NewAuthProvider)
      if (line.includes('import') && line.includes('AuthProvider') && !line.includes('NewAuthProvider')) {
        const snippet = this.extractCodeSnippet(fileContent, i + 1);

        violations.push(
          this.createViolation(
            context,
            'Use NewAuthProvider instead of AuthProvider',
            i + 1,
            undefined,
            snippet,
            "Import: import { NewAuthProvider } from '@/contexts/NewAuthContext'"
          )
        );
      }
    }

    return violations;
  }
}
