# Husky Git Hooks

This directory contains Git hooks managed by Husky.

## Pre-commit Hook

The pre-commit hook runs Mako Agents validation before each commit to ensure code quality.

### Setup

1. Install husky (if not already installed):
```bash
npm install --save-dev husky
npx husky install
```

2. Make the hook executable:
```bash
chmod +x .husky/pre-commit
```

### Bypassing the Hook

If you need to bypass the validation (not recommended):
```bash
git commit --no-verify -m "your message"
```

### Configuration

To modify what gets validated, edit the pre-commit script or update the `agents:validate` npm script in package.json.

You can also run specific agents only:
- `npm run agents:validate:debug` - Run debug agent only
- `npm run agents:validate:auth` - Run auth agent only
