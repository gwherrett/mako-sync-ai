# Mako Sync

**Music library synchronization between Spotify and local MP3 collections with AI-powered genre classification.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb)](https://reactjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Latest-3ECF8E)](https://supabase.com/)

---

## 🎯 What is Mako Sync?

Mako Sync bridges your Spotify library and local MP3 collection, providing:

- **🎵 Bi-directional Sync** - Sync liked songs from Spotify to your database
- **🏷️ Smart Genre Classification** - AI-powered genre mapping with 27 super-genres
- **📊 Missing Track Analysis** - Identify tracks missing from your local collection
- **🔒 Secure OAuth** - Industry-standard Spotify authentication with vault token storage
- **⚡ Real-time Updates** - Live sync status and progress tracking

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- Spotify Developer account

### Installation

```bash
# Clone the repository
git clone https://github.com/gwherrett/mako-sync.git
cd mako-sync

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase and Spotify credentials

# Start development server
npm run dev
```

### Configuration

See [Production Deployment Guide](docs/reference/production-deployment.md) for complete setup instructions.

## 📚 Documentation

**Start here:** [Documentation Hub](docs/README.md)

### Quick Links

- [Architecture Overview](docs/architecture-mako-sync.md) - System design and technical architecture
- [Product Requirements](docs/prd-mako-sync.md) - Product vision and features
- [Authentication System](docs/systems/authentication.md) - Auth status and implementation
- [Spotify Integration](docs/systems/spotify-integration.md) - Spotify sync status

### Implementation Guides

- [Authentication Reference](docs/reference/authentication-reference.md) - Auth implementation, debugging, testing
- [Spotify Reference](docs/reference/spotify-reference.md) - Spotify OAuth and troubleshooting
- [Production Deployment](docs/reference/production-deployment.md) - Deployment checklist

### Development

- [Agents Framework](docs/agents/README.md) - Code validation with 15 automated rules
- [Debugging Strategy](docs/debugging-task-strategy.md) - Development methodology
- [AGENTS.md](AGENTS.md) - Critical coding patterns for AI agents

## 🛠️ Development

### Available Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Production build
npm run preview         # Preview production build

# Code Quality
npm run lint            # Run ESLint
npm run agents:validate # Validate code patterns (15 rules)
npm test               # Run tests

# Agents Framework
npm run agents:validate:debug    # Debug patterns only
npm run agents:validate:auth     # Auth patterns only
npm run agents:validate:code     # Code patterns only
npm run agents:test             # Test agent framework
```

### Code Validation

This project uses the **Mako Agents Framework** - a TypeScript-based validation system enforcing 15 coding patterns automatically:

- ✅ 5 Debug rules (pagination, timeouts, session handling)
- ✅ 4 Auth rules (context consolidation, import patterns)
- ✅ 6 Code rules (service layer, edge functions, singletons)

Run `npm run agents:validate` before committing to catch issues early.

See [docs/agents/](docs/agents/) for complete framework documentation.

## 🏗️ Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Shadcn/ui** - Component library
- **Tanstack Query** - Data fetching and caching

### Backend
- **Supabase** - Database, auth, and edge functions
- **PostgreSQL** - Primary database
- **Supabase Vault** - Secure token storage
- **Row Level Security** - Data access control

### Integration
- **Spotify Web API** - Music data and OAuth
- **music-metadata-browser** - Local MP3 file parsing
- **OpenAI API** - AI-powered genre classification

## 🔐 Security

- ✅ OAuth 2.0 for Spotify authentication
- ✅ Tokens stored in Supabase Vault (encrypted at rest)
- ✅ Row Level Security (RLS) on all tables
- ✅ Service role keys only in edge functions
- ✅ No credentials in client-side code

See [Production Deployment Guide](docs/reference/production-deployment.md) for security best practices.

## 📊 Project Status

**Current State:** Production-ready core features

- ✅ **Authentication** - Complete (4/4 phases)
- 🔄 **Spotify Integration** - 85% complete (3/4 phases)
- ✅ **Genre Classification** - 90% complete
- ✅ **Missing Tracks Analysis** - Complete
- 🔄 **AI Genre Suggestions** - 60% complete

See [Current Status Assessment](docs/current-status-assessment.md) for detailed status.

## 🤝 Contributing

### Code Quality Standards

1. **Follow coding patterns** - Run `npm run agents:validate` before committing
2. **Read AGENTS.md** - Critical patterns for AI agents and developers
3. **Update documentation** - Keep docs in sync with code changes
4. **Write tests** - Maintain test coverage

### Development Workflow

1. Create feature branch from `main`
2. Implement feature following coding patterns
3. Run validation: `npm run agents:validate`
4. Test thoroughly
5. Update documentation if needed
6. Submit pull request

## 📝 License

MIT

## 🔗 Links

- **Repository**: [github.com/gwherrett/mako-sync](https://github.com/gwherrett/mako-sync)
- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/gwherrett/mako-sync/issues)

---

**Made with ❤️ for music lovers who want their library organized**
