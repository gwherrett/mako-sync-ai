/**
 * Rule: Supabase Silent Truncation
 * Queries return max 1000 rows without error - must use explicit .limit() or .range()
 */

import { BaseRule } from '../../core/Rule';
import { RuleCategory, RuleSeverity, RuleViolation, ValidationContext } from '../../core/types';

export class SupabasePaginationRule extends BaseRule {
  constructor() {
    super({
      id: 'debug-001-supabase-pagination',
      category: RuleCategory.DEBUGGING,
      severity: RuleSeverity.WARNING,
      description: 'Supabase queries return max 1000 rows without error - must use explicit .limit() or .range()',
      rationale: 'Supabase silently truncates results at 1000 rows which can cause hard-to-debug issues',
      filePatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      excludePatterns: ['**/node_modules/**', '**/dist/**', '**/build/**']
    });
  }

  validate(context: ValidationContext): RuleViolation[] {
    const violations: RuleViolation[] = [];
    const { fileContent, filePath } = context;

    // Skip if file doesn't use Supabase
    if (!fileContent.includes('supabase.from(')) {
      return violations;
    }

    // Find all supabase query chains
    const lines = fileContent.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if line contains a query start
      if (line.includes('supabase.from(')) {
        // Check the query chain - look ahead to see if .limit() or .range() is called
        const queryChain = this.extractQueryChain(lines, i);

        if (!queryChain.includes('.limit(') && !queryChain.includes('.range(')) {
          // Check if it's a .select() that might return multiple rows
          if (queryChain.includes('.select(')) {
            const snippet = this.extractCodeSnippet(fileContent, i + 1);

            violations.push(
              this.createViolation(
                context,
                'Supabase query without .limit() or .range() - may silently truncate at 1000 rows',
                i + 1,
                undefined,
                snippet,
                'Add .limit(n) or .range(start, end) to the query chain'
              )
            );
          }
        }
      }
    }

    return violations;
  }

  private extractQueryChain(lines: string[], startLine: number): string {
    let chain = '';
    let depth = 0;

    for (let i = startLine; i < Math.min(startLine + 10, lines.length); i++) {
      const line = lines[i].trim();
      chain += ' ' + line;

      // Count parentheses to detect end of chain
      depth += (line.match(/\(/g) || []).length;
      depth -= (line.match(/\)/g) || []).length;

      // If we hit a semicolon or closing statement, stop
      if (line.includes(';') || (depth <= 0 && i > startLine)) {
        break;
      }
    }

    return chain;
  }
}
