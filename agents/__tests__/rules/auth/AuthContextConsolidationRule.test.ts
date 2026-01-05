/**
 * Tests for AuthContextConsolidationRule
 */

import { AuthContextConsolidationRule } from '../../../rules/auth/AuthContextConsolidationRule';
import { ValidationContext } from '../../../core/types';

describe('AuthContextConsolidationRule', () => {
  let rule: AuthContextConsolidationRule;

  beforeEach(() => {
    rule = new AuthContextConsolidationRule();
  });

  test('should detect legacy AuthContext import', () => {
    const context: ValidationContext = {
      fileContent: `import { AuthContext } from '@/contexts/AuthContext';`,
      filePath: '/test/Component.tsx',
      fileExtension: '.tsx',
      projectRoot: '/test'
    };

    const violations = rule.validate(context);

    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('Legacy AuthContext');
    expect(violations[0].severity).toBe('error');
  });

  test('should not flag NewAuthContext import', () => {
    const context: ValidationContext = {
      fileContent: `import { useAuth } from '@/contexts/NewAuthContext';`,
      filePath: '/test/Component.tsx',
      fileExtension: '.tsx',
      projectRoot: '/test'
    };

    const violations = rule.validate(context);

    expect(violations).toHaveLength(0);
  });

  test('should detect legacy useAuthContext hook usage', () => {
    const context: ValidationContext = {
      fileContent: `
        const Component = () => {
          const { user } = useAuthContext();
          return <div>{user.email}</div>;
        };
      `,
      filePath: '/test/Component.tsx',
      fileExtension: '.tsx',
      projectRoot: '/test'
    };

    const violations = rule.validate(context);

    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('useAuthContext');
  });

  test('should ignore commented code', () => {
    const context: ValidationContext = {
      fileContent: `// import { AuthContext } from '@/contexts/AuthContext';`,
      filePath: '/test/Component.tsx',
      fileExtension: '.tsx',
      projectRoot: '/test'
    };

    const violations = rule.validate(context);

    expect(violations).toHaveLength(0);
  });

  test('should provide correct suggested fix', () => {
    const context: ValidationContext = {
      fileContent: `import { AuthContext } from '@/contexts/AuthContext';`,
      filePath: '/test/Component.tsx',
      fileExtension: '.tsx',
      projectRoot: '/test'
    };

    const violations = rule.validate(context);

    expect(violations[0].suggestedFix).toContain('NewAuthContext');
  });

  test('should not flag references to NewAuthContext in text', () => {
    const context: ValidationContext = {
      fileContent: `
        // This component uses NewAuthContext which replaces the old AuthContext
        import { useAuth } from '@/contexts/NewAuthContext';
      `,
      filePath: '/test/Component.tsx',
      fileExtension: '.tsx',
      projectRoot: '/test'
    };

    const violations = rule.validate(context);

    expect(violations).toHaveLength(0);
  });
});
