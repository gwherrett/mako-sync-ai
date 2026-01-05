# Mako Agents Framework

A TypeScript-based code validation framework that enforces project-specific patterns and prevents common bugs.

## Overview

Mako Agents is a migration from the roo code format (markdown-based agent definitions) to standard, executable TypeScript implementations. It provides:

- **Automated code validation** - Catch issues before they reach production
- **Detailed violation reporting** - Get actionable feedback with code snippets and suggested fixes
- **Multiple integration points** - CLI, ESLint, pre-commit hooks
- **Extensible architecture** - Easy to add new rules and agents

## Project Structure

```
agents/
├── core/                     # Framework core
│   ├── Agent.ts             # Base agent interface
│   ├── Rule.ts              # Base rule interface
│   ├── AgentRegistry.ts     # Central agent registry
│   └── types.ts             # Core type definitions
├── agents/                   # Agent implementations
│   ├── DebugAgent.ts        # Debug patterns validation
│   └── AuthAgent.ts         # Auth context validation
├── rules/                    # Rule implementations
│   ├── debug/               # Debug rules
│   │   ├── SupabasePaginationRule.ts
│   │   ├── CustomFetchWrapperRule.ts
│   │   ├── PromiseTimeoutRule.ts
│   │   ├── EdgeFunctionTimeoutRule.ts
│   │   └── SessionCacheDirectCallRule.ts
│   └── auth/                # Auth rules
│       ├── AuthContextConsolidationRule.ts
│       ├── AuthImportPatternRule.ts
│       ├── AuthDeferredLoadingRule.ts
│       └── AuthInitializationGuardRule.ts
├── cli/                      # CLI tool
│   ├── index.ts             # Main CLI entry point
│   ├── formatters.ts        # Output formatters
│   └── fileScanner.ts       # File discovery
├── eslint-plugin/            # ESLint integration
│   ├── index.ts             # Plugin implementation
│   └── README.md            # Plugin documentation
└── __tests__/                # Unit tests
    ├── core/
    └── rules/
```

## Implemented Agents

### Debug Agent

Validates debugging patterns and prevents common pitfalls:

- **debug-001-supabase-pagination** - Enforces `.limit()` or `.range()` on Supabase queries
- **debug-002-custom-fetch-wrapper** - Prevents custom fetch wrappers with AbortController
- **debug-003-promise-timeout** - Enforces timeout protection on auth operations
- **debug-004-edge-function-timeout** - Enforces 45+ second timeouts for edge functions
- **debug-005-session-cache-direct** - Enforces direct `getSession()` in critical flows

### Auth Agent

Validates authentication context patterns:

- **auth-001-context-consolidation** - Only `NewAuthProvider` allowed, no legacy AuthContext
- **auth-002-import-pattern** - Enforces correct auth import paths
- **auth-003-deferred-loading** - Enforces deferred user data loading in auth context
- **auth-004-initialization-guard** - Enforces `useRef` initialization guard in auth providers

## Installation

```bash
# Install dependencies
npm install

# Install additional dev dependencies
npm install --save-dev ts-node husky jest ts-jest @types/jest
```

## Usage

### CLI Tool

Run validation against your entire codebase:

```bash
# Validate all files
npm run agents:validate

# Run specific agent
npm run agents:validate:debug
npm run agents:validate:auth

# Export results as JSON
npm run agents:validate:json > results.json
```

### CLI Options

```bash
# Run from agents directory
ts-node cli/index.ts [options]

Options:
  -r, --root <path>        Project root directory (default: current directory)
  -f, --format <format>    Output format: detailed, summary, by-file (default: detailed)
  --files <paths>          Comma-separated list of specific files to validate
  -a, --agents <agents>    Comma-separated list of agents to run (default: all)
  --json                   Output results as JSON
  -h, --help               Show help message
```

### Pre-commit Hook

The framework includes a pre-commit hook that runs validation automatically:

```bash
# Set up Husky (one-time setup)
npx husky install

# Make hook executable
chmod +x .husky/pre-commit
```

To bypass validation (not recommended):
```bash
git commit --no-verify -m "your message"
```

### ESLint Integration

Add to your ESLint configuration:

```javascript
import makoAgents from './agents/eslint-plugin';

export default [
  {
    plugins: {
      '@mako/agents': makoAgents
    },
    rules: {
      ...makoAgents.configs.recommended.rules
    }
  }
];
```

See [agents/eslint-plugin/README.md](./eslint-plugin/README.md) for more details.

## Running Tests

```bash
# Run all tests
cd agents && npm test

# Run with coverage
cd agents && npm test -- --coverage

# Run specific test file
cd agents && npm test -- __tests__/core/Agent.test.ts
```

## Output Examples

### Detailed Format

```
1. ❌ ERROR
--------------------------------------------------------------------------------
File: /src/services/tracks.service.ts:42
Rule: debug-001-supabase-pagination (debugging)
Message: Supabase query without .limit() or .range() - may silently truncate at 1000 rows

Code:
    40 |   const data = await supabase
    41 |     .from('tracks')
→   42 |     .select('*');
    43 |
    44 |   return data;

💡 Suggested Fix:
Add .limit(n) or .range(start, end) to the query chain
```

### Summary Format

```
================================================================================
VALIDATION SUMMARY
================================================================================

Files Scanned:  245
Duration:       1243ms
Total Issues:   12

❌ Errors:      3
⚠️  Warnings:    9

================================================================================
✗ VALIDATION FAILED
================================================================================
```

## Development

### Adding a New Rule

1. Create rule class extending `BaseRule`:

```typescript
import { BaseRule } from '../../core/Rule';
import { RuleCategory, RuleSeverity, RuleViolation, ValidationContext } from '../../core/types';

export class MyNewRule extends BaseRule {
  constructor() {
    super({
      id: 'category-001-rule-name',
      category: RuleCategory.CODING_PATTERN,
      severity: RuleSeverity.ERROR,
      description: 'Brief description of the rule',
      rationale: 'Why this rule exists',
      filePatterns: ['**/*.ts', '**/*.tsx'],
      excludePatterns: ['**/node_modules/**']
    });
  }

  validate(context: ValidationContext): RuleViolation[] {
    const violations: RuleViolation[] = [];

    // Your validation logic here

    return violations;
  }
}
```

2. Register rule with agent:

```typescript
import { MyNewRule } from '../rules/category/MyNewRule';

export class MyAgent extends BaseAgent {
  constructor() {
    super({ /* config */ });
    this.registerRule(new MyNewRule());
  }
}
```

3. Add tests:

```typescript
// agents/__tests__/rules/category/MyNewRule.test.ts
describe('MyNewRule', () => {
  test('should detect violation', () => {
    // Test implementation
  });
});
```

### Adding a New Agent

1. Create agent class extending `BaseAgent`:

```typescript
import { BaseAgent } from '../core/Agent';

export class MyAgent extends BaseAgent {
  constructor() {
    super({
      id: 'my-agent',
      name: 'My Agent',
      description: 'What this agent validates',
      version: '1.0.0'
    });

    // Register rules
    this.registerRule(new MyRule1());
    this.registerRule(new MyRule2());
  }
}
```

2. Register with CLI and registry:

```typescript
// agents/cli/index.ts
import { myAgent } from '../agents/MyAgent';

// In registerAgents():
if (agents.includes('my-agent')) {
  this.registry.registerAgent(myAgent);
}
```

## Migration from Roo Format

This framework replaces the `.roo/` directory structure with executable TypeScript code:

| Roo Format | Standard Implementation |
|------------|------------------------|
| `.roo/rules-debug/AGENTS.md` | `agents/agents/DebugAgent.ts` + `agents/rules/debug/*.ts` |
| `.roo/rules-code/AGENTS.md` | (Future: CodeAgent) |
| `.roo/rules-architect/AGENTS.md` | (Future: ArchitectAgent) |
| `.roo/rules-ask/AGENTS.md` | (Future: DocumentationAgent) |

## Phase 1 Scope

This initial implementation focuses on:
- ✅ Core framework foundation
- ✅ Debug Agent with 5 enforceable rules
- ✅ Auth Context with 4 validation rules
- ✅ CLI tool with detailed reporting
- ✅ ESLint plugin stub
- ✅ Pre-commit hook integration
- ✅ Unit tests for core and rules

## Roadmap

- [ ] Phase 2: Migrate remaining rules from roo format
- [ ] Phase 3: VSCode extension for real-time feedback
- [ ] Phase 4: Auto-fix capabilities
- [ ] Phase 5: CI/CD integration
- [ ] Phase 6: Rule analytics dashboard

## Contributing

When adding new rules, ensure:
1. Rule ID follows convention: `{category}-{number}-{name}`
2. Description is clear and concise
3. Rationale explains why the rule exists
4. File patterns are specific and performant
5. Validation logic is accurate
6. Suggested fixes are actionable
7. Unit tests cover common cases

## License

MIT
