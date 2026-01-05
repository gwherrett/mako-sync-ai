/**
 * Base Rule interface and abstract class
 */

import { RuleCategory, RuleSeverity, RuleViolation, ValidationContext } from './types';

export interface RuleConfig {
  /** Unique rule identifier (e.g., 'auth-001-context-consolidation') */
  id: string;
  /** Rule category */
  category: RuleCategory;
  /** Severity level */
  severity: RuleSeverity;
  /** Short description of the rule */
  description: string;
  /** Detailed explanation of why this rule exists */
  rationale?: string;
  /** File patterns this rule applies to (glob patterns) */
  filePatterns?: string[];
  /** File patterns to exclude (glob patterns) */
  excludePatterns?: string[];
}

export interface Rule {
  /** Rule configuration */
  config: RuleConfig;

  /**
   * Validate the given context against this rule
   * @returns RuleViolation if rule is violated, null otherwise
   */
  validate(context: ValidationContext): RuleViolation[] | Promise<RuleViolation[]>;

  /**
   * Check if this rule applies to the given file path
   */
  appliesTo(filePath: string): boolean;
}

export abstract class BaseRule implements Rule {
  constructor(public config: RuleConfig) {}

  abstract validate(context: ValidationContext): RuleViolation[] | Promise<RuleViolation[]>;

  appliesTo(filePath: string): boolean {
    const { filePatterns, excludePatterns } = this.config;

    // Check exclude patterns first
    if (excludePatterns?.some(pattern => this.matchesPattern(filePath, pattern))) {
      return false;
    }

    // If no include patterns specified, applies to all files
    if (!filePatterns || filePatterns.length === 0) {
      return true;
    }

    // Check if matches any include pattern
    return filePatterns.some(pattern => this.matchesPattern(filePath, pattern));
  }

  protected matchesPattern(filePath: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }

  protected createViolation(
    context: ValidationContext,
    message: string,
    line?: number,
    column?: number,
    snippet?: string,
    suggestedFix?: string
  ): RuleViolation {
    return {
      ruleId: this.config.id,
      message,
      filePath: context.filePath,
      line,
      column,
      severity: this.config.severity,
      snippet,
      suggestedFix,
      category: this.config.category
    };
  }

  protected extractCodeSnippet(
    content: string,
    line: number,
    contextLines: number = 2
  ): string {
    const lines = content.split('\n');
    const startLine = Math.max(0, line - contextLines - 1);
    const endLine = Math.min(lines.length, line + contextLines);

    const snippet = lines
      .slice(startLine, endLine)
      .map((l, i) => {
        const lineNum = startLine + i + 1;
        const marker = lineNum === line ? '→ ' : '  ';
        return `${marker}${lineNum.toString().padStart(4, ' ')} | ${l}`;
      })
      .join('\n');

    return snippet;
  }

  protected findLineNumber(content: string, searchText: string): number | undefined {
    const lines = content.split('\n');
    const lineIndex = lines.findIndex(line => line.includes(searchText));
    return lineIndex >= 0 ? lineIndex + 1 : undefined;
  }
}
