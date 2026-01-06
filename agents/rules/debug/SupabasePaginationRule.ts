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
      excludePatterns: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/__tests__/**',
        '**/agents/**'
      ]
    });
  }

  validate(context: ValidationContext): RuleViolation[] {
    const violations: RuleViolation[] = [];
    const { fileContent } = context;

    // Skip if file doesn't use Supabase
    if (!fileContent.includes('supabase') || !fileContent.includes('.from(')) {
      return violations;
    }

    // Normalize the file content for easier parsing (remove extra whitespace)
    const normalized = fileContent.replace(/\s+/g, ' ');

    // Find all supabase.from() query patterns
    const queryPattern = /supabase[^;]*\.from\([^)]+\)[^;]*/g;
    const matches = normalized.matchAll(queryPattern);

    for (const match of matches) {
      const queryChain = match[0];

      // Check if query has .select() and is missing both .limit() and .range()
      if (
        queryChain.includes('.select(') &&
        !queryChain.includes('.limit(') &&
        !queryChain.includes('.range(')
      ) {
        // Find the line number in original content
        const matchIndex = fileContent.indexOf('supabase');
        const lineNumber = matchIndex >= 0 ? fileContent.substring(0, matchIndex).split('\n').length : 1;

        const snippet = this.extractCodeSnippet(fileContent, lineNumber);

        violations.push(
          this.createViolation(
            context,
            'Supabase query without .limit() or .range() - may silently truncate at 1000 rows',
            lineNumber,
            undefined,
            snippet,
            'Add .limit(n) or .range(start, end) to the query chain'
          )
        );
      }
    }

    return violations;
  }

}
