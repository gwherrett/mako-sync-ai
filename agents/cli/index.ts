#!/usr/bin/env node

/**
 * Mako Agents CLI Tool
 * Validates codebase against registered agent rules
 */

import * as path from 'path';
import { AgentRegistry } from '../core/AgentRegistry';
import { debugAgent } from '../agents/DebugAgent';
import { authAgent } from '../agents/AuthAgent';
import { codeAgent } from '../agents/CodeAgent';
import { architectAgent } from '../agents/ArchitectAgent';
import { FileScanner } from './fileScanner';
import { ViolationFormatter } from './formatters';

interface CLIOptions {
  projectRoot?: string;
  format?: 'detailed' | 'summary' | 'by-file';
  files?: string[];
  agents?: string[];
  outputFormat?: 'text' | 'json';
}

class MakoAgentsCLI {
  private registry: AgentRegistry;
  private scanner: FileScanner;

  constructor(private options: CLIOptions) {
    const projectRoot = options.projectRoot || process.cwd();
    this.scanner = new FileScanner(projectRoot);
    this.registry = AgentRegistry.getInstance();

    // Register agents
    this.registerAgents();
  }

  private registerAgents(): void {
    const { agents } = this.options;

    // If specific agents requested, only register those
    if (agents && agents.length > 0) {
      if (agents.includes('debug')) {
        this.registry.registerAgent(debugAgent);
      }
      if (agents.includes('auth')) {
        this.registry.registerAgent(authAgent);
      }
      if (agents.includes('code')) {
        this.registry.registerAgent(codeAgent);
      }
      if (agents.includes('architect')) {
        this.registry.registerAgent(architectAgent);
      }
    } else {
      // Register all agents by default
      this.registry.registerAgent(debugAgent);
      this.registry.registerAgent(authAgent);
      this.registry.registerAgent(codeAgent);
      this.registry.registerAgent(architectAgent);
    }
  }

  async run(): Promise<number> {
    console.log('\n🤖 Mako Agents - Code Validation Tool\n');

    const stats = this.registry.getStats();
    console.log(`Loaded ${stats.agentCount} agent(s) with ${stats.ruleCount} rule(s)\n`);

    // Scan files
    const contexts = this.options.files
      ? await this.scanner.scanFiles(this.options.files)
      : await this.scanner.scanDirectory();

    console.log(`Scanning ${contexts.length} file(s)...\n`);

    // Validate
    const result = await this.registry.validateFiles(contexts);

    // Output results
    if (this.options.outputFormat === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      this.printResults(result);
    }

    // Return exit code
    return result.success ? 0 : 1;
  }

  private printResults(result: any): void {
    const format = this.options.format || 'detailed';

    if (result.violations.length === 0) {
      console.log('\n✅ No violations found!\n');
      console.log(ViolationFormatter.formatSummary(result));
      return;
    }

    // Print violations
    if (format === 'detailed') {
      result.violations.forEach((violation: any, index: number) => {
        console.log(ViolationFormatter.formatViolation(violation, index + 1));
      });
    }

    if (format === 'by-file') {
      console.log(ViolationFormatter.formatByFile(result.violations));
    }

    // Always print summary
    console.log(ViolationFormatter.formatSummary(result));
  }
}

// Parse command line arguments
function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--root' || arg === '-r') {
      options.projectRoot = args[++i];
    } else if (arg === '--format' || arg === '-f') {
      options.format = args[++i] as any;
    } else if (arg === '--files') {
      options.files = args[++i].split(',');
    } else if (arg === '--agents' || arg === '-a') {
      options.agents = args[++i].split(',');
    } else if (arg === '--json') {
      options.outputFormat = 'json';
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
Mako Agents CLI - Code Validation Tool

Usage: mako-agents [options]

Options:
  -r, --root <path>        Project root directory (default: current directory)
  -f, --format <format>    Output format: detailed, summary, by-file (default: detailed)
  --files <paths>          Comma-separated list of specific files to validate
  -a, --agents <agents>    Comma-separated list of agents to run (default: all)
  --json                   Output results as JSON
  -h, --help               Show this help message

Examples:
  mako-agents                                    # Validate entire project
  mako-agents --format by-file                   # Group violations by file
  mako-agents --agents debug,auth                # Run only specific agents
  mako-agents --files src/App.tsx,src/Auth.tsx  # Validate specific files
  mako-agents --json > results.json              # Export results as JSON
  `);
}

// Main execution
if (require.main === module) {
  const options = parseArgs();
  const cli = new MakoAgentsCLI(options);

  cli
    .run()
    .then(exitCode => {
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    });
}

export { MakoAgentsCLI };
