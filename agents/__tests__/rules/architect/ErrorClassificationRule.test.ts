/**
 * Tests for ErrorClassificationRule
 */

import { ErrorClassificationRule } from '../../../rules/architect/ErrorClassificationRule';
import { ValidationContext } from '../../../core/types';

describe('ErrorClassificationRule', () => {
  let rule: ErrorClassificationRule;

  beforeEach(() => {
    rule = new ErrorClassificationRule();
  });

  test('should detect generic Error usage', () => {
    const context: ValidationContext = {
      fileContent: `function test() {
  throw new Error('something went wrong');
}`,
      filePath: '/test/api.ts',
      fileExtension: '.ts',
      projectRoot: '/test'
    };

    const violations = rule.validate(context);

    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].message).toContain('specific error type');
  });

  test('should suggest NetworkError for network-related context', () => {
    const context: ValidationContext = {
      fileContent: `function test() {
  const response = await fetch('/api');
  throw new Error('failed');
}`,
      filePath: '/test/api.ts',
      fileExtension: '.ts',
      projectRoot: '/test'
    };

    const violations = rule.validate(context);

    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].suggestedFix).toContain('NetworkError');
  });

  test('should not flag specific error types', () => {
    const context: ValidationContext = {
      fileContent: `
        async function fetchData() {
          throw new NetworkError('Failed to fetch');
        }
      `,
      filePath: '/test/api.ts',
      fileExtension: '.ts',
      projectRoot: '/test'
    };

    const violations = rule.validate(context);

    expect(violations).toHaveLength(0);
  });

  test('should not flag files without throw statements', () => {
    const context: ValidationContext = {
      fileContent: `
        function getData() {
          return { data: [] };
        }
      `,
      filePath: '/test/data.ts',
      fileExtension: '.ts',
      projectRoot: '/test'
    };

    const violations = rule.validate(context);

    expect(violations).toHaveLength(0);
  });

  test('should suggest AuthenticationError for auth context', () => {
    const context: ValidationContext = {
      fileContent: `function authenticate() {
  if (!authToken) {
    throw new Error('failed');
  }
}`,
      filePath: '/test/auth.ts',
      fileExtension: '.ts',
      projectRoot: '/test'
    };

    const violations = rule.validate(context);

    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].suggestedFix).toContain('AuthenticationError');
  });
});
