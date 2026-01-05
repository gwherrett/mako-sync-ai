/**
 * Tests for AgentRegistry
 */

import { AgentRegistry } from '../../core/AgentRegistry';
import { BaseAgent } from '../../core/Agent';
import { BaseRule } from '../../core/Rule';
import { RuleCategory, RuleSeverity, ValidationContext, RuleViolation } from '../../core/types';

class MockRule extends BaseRule {
  constructor(id: string) {
    super({
      id,
      category: RuleCategory.CODING_PATTERN,
      severity: RuleSeverity.ERROR,
      description: 'Mock rule'
    });
  }

  validate(): RuleViolation[] {
    return [];
  }
}

class MockAgent extends BaseAgent {
  constructor(id: string) {
    super({
      id,
      name: `Agent ${id}`,
      description: 'Mock agent',
      version: '1.0.0'
    });
  }
}

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = AgentRegistry.getInstance();
    registry.clear();
  });

  test('should be a singleton', () => {
    const registry1 = AgentRegistry.getInstance();
    const registry2 = AgentRegistry.getInstance();

    expect(registry1).toBe(registry2);
  });

  test('should register agents', () => {
    const agent = new MockAgent('test-1');
    registry.registerAgent(agent);

    expect(registry.getAllAgents()).toHaveLength(1);
    expect(registry.getAgent('test-1')).toBe(agent);
  });

  test('should overwrite agents with same ID', () => {
    const agent1 = new MockAgent('test-1');
    const agent2 = new MockAgent('test-1');

    registry.registerAgent(agent1);
    registry.registerAgent(agent2);

    expect(registry.getAllAgents()).toHaveLength(1);
    expect(registry.getAgent('test-1')).toBe(agent2);
  });

  test('should get all rules from all agents', () => {
    const agent1 = new MockAgent('agent-1');
    const agent2 = new MockAgent('agent-2');

    agent1.registerRule(new MockRule('rule-1'));
    agent1.registerRule(new MockRule('rule-2'));
    agent2.registerRule(new MockRule('rule-3'));

    registry.registerAgent(agent1);
    registry.registerAgent(agent2);

    const allRules = registry.getAllRules();

    expect(allRules).toHaveLength(3);
  });

  test('should validate single file', async () => {
    const agent = new MockAgent('test-agent');
    agent.registerRule(new MockRule('test-rule'));

    registry.registerAgent(agent);

    const context: ValidationContext = {
      fileContent: 'test content',
      filePath: '/test/file.ts',
      fileExtension: '.ts',
      projectRoot: '/test'
    };

    const violations = await registry.validateFile(context);

    expect(Array.isArray(violations)).toBe(true);
  });

  test('should validate multiple files', async () => {
    const agent = new MockAgent('test-agent');
    agent.registerRule(new MockRule('test-rule'));

    registry.registerAgent(agent);

    const contexts: ValidationContext[] = [
      {
        fileContent: 'test 1',
        filePath: '/test/file1.ts',
        fileExtension: '.ts',
        projectRoot: '/test'
      },
      {
        fileContent: 'test 2',
        filePath: '/test/file2.ts',
        fileExtension: '.ts',
        projectRoot: '/test'
      }
    ];

    const result = await registry.validateFiles(contexts);

    expect(result.filesScanned).toBe(2);
    expect(result.duration).toBeGreaterThan(0);
    expect(result.success).toBe(true);
  });

  test('should return correct stats', () => {
    const agent1 = new MockAgent('agent-1');
    const agent2 = new MockAgent('agent-2');

    agent1.registerRule(new MockRule('rule-1'));
    agent1.registerRule(new MockRule('rule-2'));
    agent2.registerRule(new MockRule('rule-3'));

    registry.registerAgent(agent1);
    registry.registerAgent(agent2);

    const stats = registry.getStats();

    expect(stats.agentCount).toBe(2);
    expect(stats.ruleCount).toBe(3);
    expect(stats.rulesByCategory[RuleCategory.CODING_PATTERN]).toBe(3);
  });

  test('should mark validation as failed if errors exist', async () => {
    class ErrorRule extends BaseRule {
      constructor() {
        super({
          id: 'error-rule',
          category: RuleCategory.CODING_PATTERN,
          severity: RuleSeverity.ERROR,
          description: 'Error rule'
        });
      }

      validate(context: ValidationContext): RuleViolation[] {
        return [
          this.createViolation(context, 'Error found', 1, 1)
        ];
      }
    }

    const agent = new MockAgent('test-agent');
    agent.registerRule(new ErrorRule());

    registry.registerAgent(agent);

    const contexts: ValidationContext[] = [
      {
        fileContent: 'test',
        filePath: '/test/file.ts',
        fileExtension: '.ts',
        projectRoot: '/test'
      }
    ];

    const result = await registry.validateFiles(contexts);

    expect(result.success).toBe(false);
    expect(result.violationCount).toBe(1);
  });
});
