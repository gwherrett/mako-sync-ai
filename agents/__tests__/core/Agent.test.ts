/**
 * Tests for Agent core functionality
 */

import { BaseAgent, AgentConfig } from '../../core/Agent';
import { BaseRule, RuleConfig } from '../../core/Rule';
import { RuleCategory, RuleSeverity, ValidationContext, RuleViolation } from '../../core/types';

class TestRule extends BaseRule {
  constructor() {
    super({
      id: 'test-001',
      category: RuleCategory.CODING_PATTERN,
      severity: RuleSeverity.ERROR,
      description: 'Test rule'
    });
  }

  validate(context: ValidationContext): RuleViolation[] {
    if (context.fileContent.includes('BAD_PATTERN')) {
      return [
        this.createViolation(context, 'Bad pattern found', 1, 1, 'snippet', 'fix it')
      ];
    }
    return [];
  }
}

class TestAgent extends BaseAgent {
  constructor() {
    super({
      id: 'test-agent',
      name: 'Test Agent',
      description: 'Agent for testing',
      version: '1.0.0'
    });
  }
}

describe('BaseAgent', () => {
  let agent: TestAgent;

  beforeEach(() => {
    agent = new TestAgent();
  });

  test('should create agent with correct config', () => {
    expect(agent.config.id).toBe('test-agent');
    expect(agent.config.name).toBe('Test Agent');
    expect(agent.config.version).toBe('1.0.0');
  });

  test('should register rules', () => {
    const rule = new TestRule();
    agent.registerRule(rule);

    expect(agent.getRules()).toHaveLength(1);
    expect(agent.getRules()[0].config.id).toBe('test-001');
  });

  test('should replace duplicate rules', () => {
    const rule1 = new TestRule();
    const rule2 = new TestRule();

    agent.registerRule(rule1);
    agent.registerRule(rule2);

    expect(agent.getRules()).toHaveLength(1);
  });

  test('should validate context against registered rules', async () => {
    const rule = new TestRule();
    agent.registerRule(rule);

    const context: ValidationContext = {
      fileContent: 'BAD_PATTERN is here',
      filePath: '/test/file.ts',
      fileExtension: '.ts',
      projectRoot: '/test'
    };

    const violations = await agent.validate(context);

    expect(violations).toHaveLength(1);
    expect(violations[0].message).toBe('Bad pattern found');
  });

  test('should skip rules that do not apply to file', async () => {
    const rule = new TestRule();
    rule.config.filePatterns = ['*.js'];
    agent.registerRule(rule);

    const context: ValidationContext = {
      fileContent: 'BAD_PATTERN is here',
      filePath: '/test/file.ts',
      fileExtension: '.ts',
      projectRoot: '/test'
    };

    const violations = await agent.validate(context);

    expect(violations).toHaveLength(0);
  });

  test('should handle validation errors gracefully', async () => {
    class ErrorRule extends BaseRule {
      constructor() {
        super({
          id: 'error-rule',
          category: RuleCategory.CODING_PATTERN,
          severity: RuleSeverity.ERROR,
          description: 'Error rule'
        });
      }

      validate(): RuleViolation[] {
        throw new Error('Validation error');
      }
    }

    agent.registerRule(new ErrorRule());

    const context: ValidationContext = {
      fileContent: 'test',
      filePath: '/test/file.ts',
      fileExtension: '.ts',
      projectRoot: '/test'
    };

    const violations = await agent.validate(context);

    // Should not throw, but return empty violations
    expect(violations).toHaveLength(0);
  });
});
