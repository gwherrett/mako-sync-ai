/**
 * Debug Agent - Validates debugging patterns and common pitfalls
 */

import { BaseAgent } from '../core/Agent';
import {
  SupabasePaginationRule,
  CustomFetchWrapperRule,
  PromiseTimeoutRule,
  EdgeFunctionTimeoutRule,
  SessionCacheDirectCallRule
} from '../rules/debug';

export class DebugAgent extends BaseAgent {
  constructor() {
    super({
      id: 'debug',
      name: 'Debug Agent',
      description: 'Validates debugging patterns and prevents common debugging pitfalls',
      version: '1.0.0'
    });

    // Register all debug rules
    this.registerRule(new SupabasePaginationRule());
    this.registerRule(new CustomFetchWrapperRule());
    this.registerRule(new PromiseTimeoutRule());
    this.registerRule(new EdgeFunctionTimeoutRule());
    this.registerRule(new SessionCacheDirectCallRule());
  }
}

export const debugAgent = new DebugAgent();
