/**
 * Formatters for CLI output
 */

import { RuleViolation, ValidationResult } from '../core/types';

export class ViolationFormatter {
  /**
   * Format a single violation with detailed information
   */
  static formatViolation(violation: RuleViolation, index: number): string {
    const { severity, filePath, line, message, snippet, suggestedFix, ruleId, category } = violation;

    const severitySymbol = {
      error: '❌',
      warning: '⚠️ ',
      info: 'ℹ️ '
    }[severity];

    const severityColor = {
      error: '\x1b[31m', // Red
      warning: '\x1b[33m', // Yellow
      info: '\x1b[36m' // Cyan
    }[severity];

    const reset = '\x1b[0m';
    const bold = '\x1b[1m';
    const dim = '\x1b[2m';

    let output = `\n${bold}${index}. ${severitySymbol} ${severity.toUpperCase()}${reset}\n`;
    output += `${dim}${'-'.repeat(80)}${reset}\n`;
    output += `${bold}File:${reset} ${filePath}${line ? `:${line}` : ''}\n`;
    output += `${bold}Rule:${reset} ${ruleId} ${dim}(${category})${reset}\n`;
    output += `${bold}Message:${reset} ${severityColor}${message}${reset}\n`;

    if (snippet) {
      output += `\n${bold}Code:${reset}\n${snippet}\n`;
    }

    if (suggestedFix) {
      output += `\n${bold}💡 Suggested Fix:${reset}\n${suggestedFix}\n`;
    }

    return output;
  }

  /**
   * Format validation summary
   */
  static formatSummary(result: ValidationResult): string {
    const { filesScanned, violationCount, violations, duration, success } = result;

    const reset = '\x1b[0m';
    const bold = '\x1b[1m';
    const green = '\x1b[32m';
    const red = '\x1b[31m';
    const yellow = '\x1b[33m';

    const errors = violations.filter(v => v.severity === 'error').length;
    const warnings = violations.filter(v => v.severity === 'warning').length;
    const infos = violations.filter(v => v.severity === 'info').length;

    let output = `\n${'='.repeat(80)}\n`;
    output += `${bold}VALIDATION SUMMARY${reset}\n`;
    output += `${'='.repeat(80)}\n\n`;

    output += `Files Scanned:  ${filesScanned}\n`;
    output += `Duration:       ${duration}ms\n`;
    output += `Total Issues:   ${violationCount}\n\n`;

    if (errors > 0) {
      output += `${red}❌ Errors:      ${errors}${reset}\n`;
    }
    if (warnings > 0) {
      output += `${yellow}⚠️  Warnings:    ${warnings}${reset}\n`;
    }
    if (infos > 0) {
      output += `ℹ️  Info:        ${infos}\n`;
    }

    output += `\n${'='.repeat(80)}\n`;

    if (success) {
      output += `${green}${bold}✓ VALIDATION PASSED${reset}\n`;
    } else {
      output += `${red}${bold}✗ VALIDATION FAILED${reset}\n`;
    }

    output += `${'='.repeat(80)}\n`;

    return output;
  }

  /**
   * Format violations grouped by file
   */
  static formatByFile(violations: RuleViolation[]): string {
    const reset = '\x1b[0m';
    const bold = '\x1b[1m';
    const dim = '\x1b[2m';

    const byFile = violations.reduce((acc, v) => {
      if (!acc[v.filePath]) {
        acc[v.filePath] = [];
      }
      acc[v.filePath].push(v);
      return acc;
    }, {} as Record<string, RuleViolation[]>);

    let output = `\n${bold}VIOLATIONS BY FILE${reset}\n`;
    output += `${'='.repeat(80)}\n`;

    Object.entries(byFile)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([file, fileViolations]) => {
        output += `\n${bold}${file}${reset} ${dim}(${fileViolations.length} issue${fileViolations.length > 1 ? 's' : ''})${reset}\n`;

        fileViolations.forEach((v, i) => {
          const symbol = { error: '❌', warning: '⚠️ ', info: 'ℹ️ ' }[v.severity];
          output += `  ${symbol} [${v.ruleId}] ${v.message}`;
          if (v.line) {
            output += ` ${dim}(line ${v.line})${reset}`;
          }
          output += '\n';
        });
      });

    return output;
  }
}
