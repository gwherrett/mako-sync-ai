# Mako Agents Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Developer Workflow                        │
└─────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                    v            v            v
            ┌──────────┐  ┌──────────┐  ┌──────────┐
            │   CLI    │  │  ESLint  │  │   Git    │
            │   Tool   │  │  Plugin  │  │   Hook   │
            └──────────┘  └──────────┘  └──────────┘
                    │            │            │
                    └────────────┼────────────┘
                                 │
                                 v
                    ┌────────────────────────┐
                    │    Agent Registry      │
                    │    (Singleton)         │
                    └────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    v                         v
            ┌──────────────┐        ┌──────────────┐
            │ Debug Agent  │        │  Auth Agent  │
            └──────────────┘        └──────────────┘
                    │                         │
        ┌───────────┼─────────┐    ┌─────────┼────────┐
        v           v         v    v         v        v
    ┌──────┐  ┌──────┐  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
    │Rule 1│  │Rule 2│  │Rule 3│ │Rule 1│ │Rule 2│ │Rule 3│
    └──────┘  └──────┘  └──────┘ └──────┘ └──────┘ └──────┘
```

## Core Architecture

### 1. Agent System

```typescript
Agent (interface)
  ├── config: AgentConfig
  ├── rules: Rule[]
  ├── validate(context): Promise<RuleViolation[]>
  ├── registerRule(rule): void
  └── getRules(): Rule[]

BaseAgent (abstract class)
  └── implements Agent
      └── provides default validation logic
```

**Responsibilities:**
- Manage collection of related rules
- Coordinate rule validation
- Provide agent-level configuration

### 2. Rule System

```typescript
Rule (interface)
  ├── config: RuleConfig
  ├── validate(context): RuleViolation[]
  └── appliesTo(filePath): boolean

BaseRule (abstract class)
  └── implements Rule
      ├── matchesPattern(filePath, pattern): boolean
      ├── createViolation(...): RuleViolation
      ├── extractCodeSnippet(...): string
      └── findLineNumber(...): number
```

**Responsibilities:**
- Validate specific coding patterns
- Generate violation reports
- Determine file applicability

### 3. Registry System

```typescript
AgentRegistry (singleton)
  ├── registerAgent(agent): void
  ├── getAgent(id): Agent
  ├── getAllAgents(): Agent[]
  ├── getAllRules(): Rule[]
  ├── validateFile(context): RuleViolation[]
  └── validateFiles(contexts): ValidationResult
```

**Responsibilities:**
- Central agent management
- Coordinate multi-agent validation
- Aggregate results

## Data Flow

### Validation Flow

```
1. File Discovery
   └─> FileScanner.scanDirectory()
       └─> Read file contents
           └─> Create ValidationContext

2. Validation
   └─> AgentRegistry.validateFiles(contexts)
       └─> For each context:
           └─> For each agent:
               └─> For each rule:
                   └─> if appliesTo(filePath):
                       └─> rule.validate(context)
                           └─> Generate RuleViolation[]

3. Reporting
   └─> ViolationFormatter.format()
       └─> Group by file/severity
           └─> Add code snippets
               └─> Add suggested fixes
                   └─> Output formatted results
```

### Context Object

```typescript
ValidationContext {
  fileContent: string        // Full file text
  filePath: string          // Absolute path
  fileExtension: string     // .ts, .tsx, etc.
  projectRoot: string       // Project base path
  metadata?: object         // Additional context
}
```

### Violation Object

```typescript
RuleViolation {
  ruleId: string           // e.g., "debug-001-supabase-pagination"
  message: string          // Human-readable message
  filePath: string         // File where violation occurred
  line?: number            // Line number (1-indexed)
  column?: number          // Column number (1-indexed)
  severity: Severity       // error | warning | info
  snippet?: string         // Code context
  suggestedFix?: string    // How to fix
  category: RuleCategory   // Rule category
}
```

## Rule Implementation Pattern

### Standard Rule Structure

```typescript
export class MyRule extends BaseRule {
  constructor() {
    super({
      id: 'category-NNN-descriptive-name',
      category: RuleCategory.CODING_PATTERN,
      severity: RuleSeverity.ERROR,
      description: 'One-line rule description',
      rationale: 'Why this rule exists',
      filePatterns: ['**/*.ts', '**/*.tsx'],
      excludePatterns: ['**/node_modules/**']
    });
  }

  validate(context: ValidationContext): RuleViolation[] {
    const violations: RuleViolation[] = [];

    // 1. Early return if rule doesn't apply
    if (!context.fileContent.includes('pattern')) {
      return violations;
    }

    // 2. Parse file content
    const lines = context.fileContent.split('\n');

    // 3. Check each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 4. Detect violation
      if (this.hasViolation(line)) {
        // 5. Create violation with details
        const snippet = this.extractCodeSnippet(
          context.fileContent,
          i + 1
        );

        violations.push(
          this.createViolation(
            context,
            'Violation message',
            i + 1,              // line number
            undefined,          // column (optional)
            snippet,
            'Suggested fix'
          )
        );
      }
    }

    return violations;
  }

  private hasViolation(line: string): boolean {
    // Custom detection logic
    return /bad-pattern/.test(line);
  }
}
```

## Agent Implementation Pattern

### Standard Agent Structure

```typescript
export class MyAgent extends BaseAgent {
  constructor() {
    super({
      id: 'my-agent',
      name: 'My Agent',
      description: 'What this agent validates',
      version: '1.0.0'
    });

    // Register all rules for this agent
    this.registerRule(new Rule1());
    this.registerRule(new Rule2());
    this.registerRule(new Rule3());
  }
}

// Export singleton instance
export const myAgent = new MyAgent();
```

## Integration Architecture

### CLI Integration

```
User Command
    │
    v
CLI Parser (args)
    │
    v
File Scanner
    │
    v
Agent Registry
    │
    v
Formatters
    │
    v
Console Output / JSON
```

### ESLint Integration

```
ESLint Config
    │
    v
Plugin Loader
    │
    v
Convert Rule → ESLint Rule
    │
    v
ESLint Runner
    │
    v
ESLint Report
```

### Pre-commit Hook Integration

```
git commit
    │
    v
Husky Pre-commit Hook
    │
    v
npm run agents:validate
    │
    ├─> Success → Continue commit
    └─> Failure → Block commit
```

## Performance Considerations

### File Scanning

- **Exclude patterns** applied first to skip large directories
- **File pattern matching** using glob patterns
- **Lazy loading** - files read only when needed

### Rule Execution

- **Early returns** - rules skip files they don't apply to
- **Parallel validation** - multiple agents can run concurrently
- **Caching** - registry maintains loaded agents

### Optimization Targets

- Scan 1000 files in < 5 seconds
- Validate each file in < 50ms
- Total validation time < 10 seconds for typical project

## Extension Points

### Adding New Rule Categories

1. Add category to `RuleCategory` enum
2. Create rules directory: `rules/{category}/`
3. Implement rules extending `BaseRule`
4. Create agent for category
5. Register with CLI

### Adding New Output Formats

1. Create formatter in `cli/formatters.ts`
2. Add format option to CLI args
3. Update help text

### Adding New Integration Points

1. Create integration directory: `{integration}/`
2. Import `AgentRegistry`
3. Implement integration-specific wrapper
4. Document usage

## Testing Strategy

### Unit Tests

- **Core components** - Agent, Rule, Registry
- **Each rule** - Multiple test cases per rule
- **Edge cases** - Error handling, empty files, etc.

### Integration Tests

- **End-to-end CLI** - Full validation flow
- **Multi-agent** - Multiple agents together
- **Real files** - Test against actual codebase

### Test Structure

```
__tests__/
├── core/
│   ├── Agent.test.ts
│   ├── Rule.test.ts
│   └── AgentRegistry.test.ts
└── rules/
    ├── debug/
    │   └── {RuleName}.test.ts
    └── auth/
        └── {RuleName}.test.ts
```

## Security Considerations

1. **File Access** - Respects file system permissions
2. **Path Traversal** - Validates all file paths
3. **Code Execution** - No dynamic code evaluation
4. **Input Validation** - CLI args validated
5. **Resource Limits** - File size limits to prevent DoS

## Error Handling

### Strategy

- **Graceful degradation** - Skip failing rules, continue validation
- **Error logging** - Console errors for debugging
- **Exit codes** - 0 for success, 1 for failures

### Error Types

1. **Rule errors** - Caught and logged, validation continues
2. **File errors** - Logged and skipped
3. **Configuration errors** - Fatal, exit immediately

## Future Architecture

### Planned Enhancements

1. **AST Analysis** - Use TypeScript compiler API for accurate parsing
2. **Auto-fix** - Generate and apply code fixes
3. **Incremental Validation** - Only check changed files
4. **Remote Rules** - Load rules from external sources
5. **Rule Marketplace** - Share and discover rules
