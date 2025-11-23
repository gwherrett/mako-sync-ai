# Music Library Sync & Genre Mapper

A full-stack web application that bridges the gap between your Spotify liked songs and local MP3 collection, providing intelligent genre classification and track matching powered by AI.

## 🎯 What Does This Do?

This app solves a common problem for music enthusiasts: managing and organizing a hybrid music library across Spotify and local files. It:

- **Syncs your Spotify liked songs** into a searchable database
- **Scans local MP3 files** and extracts metadata (artist, title, BPM, key, etc.)
- **Intelligently matches** local tracks with Spotify tracks
- **AI-powered genre mapping** that learns from your collection and follows custom rules
- **Organizes music into "super genres"** (27 high-level categories like House, Hip Hop, Soul-Funk, etc.)
- **Provides analytics** on your music collection with filters and insights

Perfect for DJs, music collectors, and anyone who maintains both streaming and local music libraries.

---

## 🚀 Key Features

### Spotify Integration
- OAuth authentication with Spotify
- Automatic sync of liked songs (incremental & full sync)
- Fetches audio features (BPM, key, danceability)
- Artist and album genre extraction
- Sync progress tracking with resume capability

### Local Library Management
- Browser-based MP3 file scanning (no backend upload required)
- Extracts ID3 metadata (title, artist, album, year, BPM, key, etc.)
- Generates unique file hashes to detect duplicates
- Stores metadata in Supabase database
- File system integration with persistent tracking

### AI Genre Classification
- Leverages Lovable AI for intelligent genre suggestions
- Context-aware: considers user's existing library patterns
- Rule-based classification with time periods, artist patterns, and track titles
- Learns from manual overrides
- Batch processing for efficiency

### Advanced Track Matching
- Fuzzy matching algorithm using Levenshtein distance
- Considers multiple factors: title, artist, album, mix version
- Confidence scoring system
- Identifies remixes and alternative versions

### Genre Management
- 27-category super genre taxonomy
- Base genre mapping system (1000+ Spotify genres mapped)
- User-specific override system for personalized mappings
- Bulk genre assignment tools
- Artist-grouped processing

---

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for blazing-fast builds
- **TanStack Query** for server state management
- **React Router** for navigation
- **Tailwind CSS** with custom design system
- **shadcn/ui** component library
- **Recharts** for data visualization

### Backend & Infrastructure
- **Supabase** (PostgreSQL database + Edge Functions)
- **Supabase Auth** for user authentication
- **Supabase Storage** for potential file uploads
- **Edge Functions (Deno)** for serverless backend logic

### Key Libraries
- `music-metadata-browser` - MP3 metadata extraction
- `buffer` - File handling in browser
- `date-fns` - Date manipulation
- `zod` - Runtime type validation
- `react-hook-form` - Form management

---

## 🏗️ Architecture Overview

### Database Schema
```
profiles
├── user authentication & onboarding

spotify_connections
├── OAuth tokens (stored in Supabase Vault)
├── token expiration tracking

spotify_liked
├── synced Spotify tracks
├── normalized metadata
├── super_genre classification

local_mp3s
├── scanned local files
├── file hashes for deduplication
├── extracted metadata

track_matches
├── links local files to Spotify tracks
├── confidence scores

spotify_genre_map_base
├── global genre mappings (Spotify → Super Genre)

spotify_genre_map_overrides
├── user-specific genre mappings

artist_genres / album_genres
├── cached genre data from Spotify API

sync_progress
├── tracks sync state for resumable operations
```

### Edge Functions
1. **`spotify-auth`** - Handles OAuth callback and token exchange
2. **`spotify-sync-liked`** - Syncs liked songs from Spotify (incremental/full)
3. **`spotify-resync-tracks`** - Re-processes tracks with updated genre rules
4. **`ai-track-genre-suggest`** - AI-powered genre suggestions with context
5. **`genre-mapping`** - Batch genre mapping operations

### Data Flow
```
1. User Authentication (Supabase Auth)
   ↓
2. Spotify Connection (OAuth → Vault Storage)
   ↓
3. Sync Liked Songs (Edge Function → Spotify API → Database)
   ↓
4. Genre Classification (Edge Function → Lovable AI → Database)
   ↓
5. Local File Scan (Browser → Metadata Extraction → Database)
   ↓
6. Track Matching (Algorithm → Confidence Scoring → Database)
   ↓
7. Analytics & Visualization (React Query → Components)
```

---

## 🎨 Design System

The app uses a custom design system built on Tailwind CSS with:
- **Semantic color tokens** (HSL-based for theme flexibility)
- **Custom shadcn/ui components** with variants
- **Responsive layouts** with mobile-first approach
- **Dark/light mode support** (via `next-themes`)
- **Consistent spacing and typography scales**

---

## 🚦 Getting Started

### Prerequisites
- Node.js 18+ (or Bun)
- A Spotify account
- Local MP3 files (optional)

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your Supabase credentials to .env

# Start development server
npm run dev
```

### Environment Variables
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### First-Time Setup
1. Create an account or sign in
2. Connect your Spotify account (OAuth flow)
3. Run initial sync (may take a few minutes for large libraries)
4. Optionally scan local MP3 files
5. Review and customize genre mappings

---

## 🧪 Testing

The project includes acceptance tests for core functionality:

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- genreMapping.acceptance.test.ts
```

---

## 📦 Deployment

### Lovable Cloud (Recommended)
- Click "Publish" in the Lovable editor
- Frontend deploys to CDN
- Edge functions auto-deploy to Supabase
- Database migrations auto-apply

### Self-Hosting
1. Deploy frontend to any static host (Vercel, Netlify, Cloudflare Pages)
2. Set up Supabase project
3. Deploy edge functions: `supabase functions deploy`
4. Configure environment variables in hosting platform

---

## 🔒 Security & Privacy

- **No music files uploaded**: Local scanning happens in-browser
- **Secure token storage**: Spotify tokens stored in Supabase Vault
- **Row Level Security (RLS)**: All database tables protected by user-scoped policies
- **OAuth flow**: Industry-standard authentication

---

## 🎯 Future Enhancements

- [ ] Playlist generation based on super genres
- [ ] Advanced analytics and listening insights
- [ ] Export capabilities (CSV, JSON)
- [ ] Batch metadata editing
- [ ] Integration with other streaming platforms (Apple Music, Tidal)
- [ ] Mobile app (React Native)
- [ ] Collaborative playlists

---

## 🤝 Contributing

This is a personal project, but suggestions and feedback are welcome! Feel free to:
- Open issues for bugs or feature requests
- Submit pull requests with improvements
- Share your use cases and experiences

---

## 📄 License

This project is built with [Lovable](https://lovable.dev) and uses open-source technologies.

---

## 🙏 Acknowledgments

- **Lovable** for the development platform
- **Supabase** for backend infrastructure
- **Spotify** for their comprehensive Web API
- **shadcn/ui** for beautiful component primitives
- The open-source community for the amazing libraries used in this project

---

## 📞 Contact

For questions or opportunities, feel free to reach out via [your contact method].

---

**Built with ❤️ using Lovable, React, and Supabase**
