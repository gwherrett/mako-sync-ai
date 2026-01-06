/**
 * Tests for StateSubscriptionRule
 */

import { StateSubscriptionRule } from '../../../rules/architect/StateSubscriptionRule';
import { ValidationContext } from '../../../core/types';

describe('StateSubscriptionRule', () => {
  let rule: StateSubscriptionRule;

  beforeEach(() => {
    rule = new StateSubscriptionRule();
  });

  test('should detect subscribe without cleanup', () => {
    const context: ValidationContext = {
      fileContent: `
        useEffect(() => {
          const subscription = observable.subscribe(value => {
            console.log(value);
          });
        }, []);
      `,
      filePath: '/test/Component.tsx',
      fileExtension: '.tsx',
      projectRoot: '/test'
    };

    const violations = rule.validate(context);

    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].message).toContain('subscribe');
    expect(violations[0].message).toContain('cleanup');
  });

  test('should not flag subscribe with proper cleanup', () => {
    const context: ValidationContext = {
      fileContent: `
        useEffect(() => {
          const subscription = observable.subscribe(value => {
            console.log(value);
          });

          return () => {
            subscription.unsubscribe();
          };
        }, []);
      `,
      filePath: '/test/Component.tsx',
      fileExtension: '.tsx',
      projectRoot: '/test'
    };

    const violations = rule.validate(context);

    expect(violations).toHaveLength(0);
  });

  test('should detect cleanup without unsubscribe', () => {
    const context: ValidationContext = {
      fileContent: `
        useEffect(() => {
          const subscription = observable.subscribe(value => {
            console.log(value);
          });

          return () => {
            console.log('cleanup');
          };
        }, []);
      `,
      filePath: '/test/Component.tsx',
      fileExtension: '.tsx',
      projectRoot: '/test'
    };

    const violations = rule.validate(context);

    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].message).toContain('unsubscribe');
  });

  test('should not flag files without useEffect', () => {
    const context: ValidationContext = {
      fileContent: `
        const Component = () => {
          return <div>Hello</div>;
        };
      `,
      filePath: '/test/Component.tsx',
      fileExtension: '.tsx',
      projectRoot: '/test'
    };

    const violations = rule.validate(context);

    expect(violations).toHaveLength(0);
  });

  test('should provide helpful suggested fix', () => {
    const context: ValidationContext = {
      fileContent: `
        useEffect(() => {
          const subscription = observable.subscribe(value => {
            console.log(value);
          });
        }, []);
      `,
      filePath: '/test/Component.tsx',
      fileExtension: '.tsx',
      projectRoot: '/test'
    };

    const violations = rule.validate(context);

    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].suggestedFix).toContain('unsubscribe');
  });
});
