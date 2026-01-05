/**
 * Core types for the Mako Agent Framework
 */

export interface ValidationContext {
  /** Full file content */
  fileContent: string;
  /** Absolute file path */
  filePath: string;
  /** File extension */
  fileExtension: string;
  /** Project root directory */
  projectRoot: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface RuleViolation {
  /** Unique rule identifier */
  ruleId: string;
  /** Human-readable violation message */
  message: string;
  /** File path where violation occurred */
  filePath: string;
  /** Line number (1-indexed) */
  line?: number;
  /** Column number (1-indexed) */
  column?: number;
  /** Severity level */
  severity: 'error' | 'warning' | 'info';
  /** Code snippet showing the violation */
  snippet?: string;
  /** Suggested fix description */
  suggestedFix?: string;
  /** Rule category */
  category: RuleCategory;
}

export interface ValidationResult {
  /** Total files scanned */
  filesScanned: number;
  /** Total violations found */
  violationCount: number;
  /** Violations by severity */
  violations: RuleViolation[];
  /** Duration in milliseconds */
  duration: number;
  /** Success status */
  success: boolean;
}

export enum RuleCategory {
  ARCHITECTURE = 'architecture',
  CODING_PATTERN = 'coding_pattern',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  DOCUMENTATION = 'documentation',
  DEBUGGING = 'debugging'
}

export enum RuleSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}
