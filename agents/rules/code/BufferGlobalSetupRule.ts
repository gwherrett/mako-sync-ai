/**
 * Rule: Buffer Global Setup
 * music-metadata-browser requires window.Buffer to be set globally
 */

import { BaseRule } from '../../core/Rule';
import { RuleCategory, RuleSeverity, RuleViolation, ValidationContext } from '../../core/types';

export class BufferGlobalSetupRule extends BaseRule {
  constructor() {
    super({
      id: 'code-005-buffer-global-setup',
      category: RuleCategory.CODING_PATTERN,
      severity: RuleSeverity.ERROR,
      description: 'Files using music-metadata-browser must set window.Buffer globally',
      rationale: 'music-metadata-browser requires Buffer to be available on window object',
      filePatterns: ['**/*.ts', '**/*.tsx'],
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

    // Check if file uses music-metadata-browser
    if (!fileContent.includes('music-metadata-browser')) {
      return violations;
    }

    // Check if Buffer is set up globally
    const hasBufferSetup =
      fileContent.includes('window.Buffer = Buffer') ||
      fileContent.includes('window.Buffer=Buffer') ||
      fileContent.includes('globalThis.Buffer = Buffer');

    if (!hasBufferSetup) {
      violations.push(
        this.createViolation(
          context,
          'Files using music-metadata-browser must set up Buffer globally',
          1,
          undefined,
          'import { Buffer } from \'buffer\';\nwindow.Buffer = Buffer;',
          'Add: import { Buffer } from \'buffer\'; and window.Buffer = Buffer; before using music-metadata-browser'
        )
      );
    }

    return violations;
  }
}
