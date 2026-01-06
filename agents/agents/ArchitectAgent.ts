/**
 * Architect Agent - Validates advanced architectural patterns
 * Detects complex issues like memory leaks, race conditions, and flow violations
 */

import { BaseAgent } from '../core/Agent';
import {
  StateSubscriptionRule,
  ConnectionCooldownRule,
  OAuthCallbackRule,
  ErrorClassificationRule
} from '../rules/architect';

export class ArchitectAgent extends BaseAgent {
  constructor() {
    super({
      id: 'architect',
      name: 'Architect Agent',
      description: 'Validates advanced architectural patterns and prevents memory leaks, race conditions, and flow violations',
      version: '1.0.0'
    });

    // Register all architect rules
    this.registerRule(new StateSubscriptionRule());
    this.registerRule(new ConnectionCooldownRule());
    this.registerRule(new OAuthCallbackRule());
    this.registerRule(new ErrorClassificationRule());
  }
}

export const architectAgent = new ArchitectAgent();
