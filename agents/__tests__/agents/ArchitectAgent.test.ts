/**
 * Tests for ArchitectAgent
 */

import { ArchitectAgent } from '../../agents/ArchitectAgent';
import { ValidationContext } from '../../core/types';

describe('ArchitectAgent', () => {
  let agent: ArchitectAgent;

  beforeEach(() => {
    agent = new ArchitectAgent();
  });

  test('should create agent with correct config', () => {
    expect(agent.config.id).toBe('architect');
    expect(agent.config.name).toBe('Architect Agent');
    expect(agent.config.version).toBe('1.0.0');
  });

  test('should register all architect rules', () => {
    const rules = agent.getRules();

    expect(rules.length).toBe(4);

    const ruleIds = rules.map(r => r.config.id);
    expect(ruleIds).toContain('architect-001-state-subscription');
    expect(ruleIds).toContain('architect-002-connection-cooldown');
    expect(ruleIds).toContain('architect-003-oauth-callback');
    expect(ruleIds).toContain('architect-004-error-classification');
  });

  test('should validate against state subscription rule', async () => {
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

    const violations = await agent.validate(context);

    const subscriptionViolations = violations.filter(v =>
      v.ruleId === 'architect-001-state-subscription'
    );

    expect(subscriptionViolations.length).toBeGreaterThan(0);
  });

  test('should validate against error classification rule', async () => {
    const context: ValidationContext = {
      fileContent: `function fetchData() {
  throw new Error('Network error');
}`,
      filePath: '/test/api.ts',
      fileExtension: '.ts',
      projectRoot: '/test'
    };

    const violations = await agent.validate(context);

    const errorViolations = violations.filter(v =>
      v.ruleId === 'architect-004-error-classification'
    );

    expect(errorViolations.length).toBeGreaterThan(0);
  });

  test('should not produce violations for clean code', async () => {
    const context: ValidationContext = {
      fileContent: `
        const Component = () => {
          return <div>Clean component</div>;
        };
      `,
      filePath: '/test/Component.tsx',
      fileExtension: '.tsx',
      projectRoot: '/test'
    };

    const violations = await agent.validate(context);

    expect(violations).toHaveLength(0);
  });

  test('should skip rules that do not apply to file', async () => {
    const context: ValidationContext = {
      fileContent: `throw new Error('test');`,
      filePath: '/test/node_modules/lib/file.ts',
      fileExtension: '.ts',
      projectRoot: '/test'
    };

    const violations = await agent.validate(context);

    // node_modules should be excluded
    expect(violations).toHaveLength(0);
  });
});
