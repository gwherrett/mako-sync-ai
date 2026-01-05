# eslint-plugin-mako-agents

ESLint plugin that integrates Mako agent rules into your ESLint configuration.

## Installation

```bash
npm install --save-dev eslint-plugin-mako-agents
```

## Usage

Add to your `.eslintrc.js` or `eslint.config.js`:

### ESLint 9+ (Flat Config)

```javascript
import makoAgents from 'eslint-plugin-mako-agents';

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

### ESLint 8 (Legacy Config)

```javascript
module.exports = {
  plugins: ['@mako/agents'],
  extends: ['plugin:@mako/agents/recommended']
};
```

## Available Configurations

- `recommended` - Enables error-level rules only
- `all` - Enables all rules as warnings

## Rules

### Debug Agent Rules

- `debug_001_supabase_pagination` - Enforce .limit() or .range() on Supabase queries
- `debug_002_custom_fetch_wrapper` - Prevent custom fetch wrappers with AbortController
- `debug_003_promise_timeout` - Enforce timeout protection on auth operations
- `debug_004_edge_function_timeout` - Enforce 45+ second timeouts for edge functions
- `debug_005_session_cache_direct` - Enforce direct getSession() in critical flows

### Auth Agent Rules

- `auth_001_context_consolidation` - Only NewAuthProvider allowed, no legacy AuthContext
- `auth_002_import_pattern` - Enforce correct auth import paths
- `auth_003_deferred_loading` - Enforce deferred user data loading in auth context
- `auth_004_initialization_guard` - Enforce useRef initialization guard in auth providers

## Manual Rule Configuration

You can enable/disable specific rules:

```javascript
{
  rules: {
    '@mako/agents/auth_001_context_consolidation': 'error',
    '@mako/agents/debug_001_supabase_pagination': 'warn',
    '@mako/agents/debug_003_promise_timeout': 'off'
  }
}
```
