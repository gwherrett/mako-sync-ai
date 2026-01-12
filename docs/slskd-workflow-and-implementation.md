# Mako Sync - slskd Integration & Download Workflow

**Document Version:** 1.0
**Last Updated:** January 12, 2026
**Status:** Ready for Implementation

---

## Table of Contents

1. [Overview](#overview)
2. [Complete Workflow](#complete-workflow)
3. [Post-Download Processing](#post-download-processing)
4. [Mako Sync slskd Integration](#mako-sync-slskd-integration)
5. [Implementation Checklist](#implementation-checklist)
6. [Next Steps](#next-steps)

---

## Overview

This document outlines the complete workflow for managing DJ music files with Mako Sync, slskd, and Supercrates. It combines:

1. **Mako Sync**: Identifies missing tracks by comparing Spotify liked songs against Supercrates
2. **slskd Integration**: Pushes missing tracks to slskd wishlist for automatic download
3. **Post-Download Processing**: Organizes downloads into Supercrates by genre
4. **Supercrates**: Genre-organized folders that both Mako Sync and Serato use

### Key Architectural Decisions

✅ **Supercrates is the single source of truth**
- Mako Sync scans Supercrates (not MediaMonkey)
- Serato reads from Supercrates
- Downloads flow directly into Supercrates

✅ **Static genre mapping** (no dynamic AI classification)
- Simple, reliable, fast
- Based on ID3 genre tags from downloaded files
- Fallback to "Unclassified" folder for manual review

✅ **No sync state tracking** (ephemeral operations)
- Duplicate detection via real-time slskd API queries
- Users can re-sync tracks anytime
- No database overhead

---

## Complete Workflow

### End-to-End Flow

```
┌──────────────────────┐
│ 1. Spotify Liked     │ (What I want)
│    Songs             │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 2. Mako Sync         │ (Compare & Identify)
│    - Scan Supercrates│
│    - Find missing    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 3. User selects      │ (Artist-level approval)
│    artists to sync   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 4. Mako Sync pushes  │ (REST API)
│    to slskd wishlist │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 5. slskd downloads   │ (Automatic)
│    to /downloads/    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 6. Post-processor    │ (Python script)
│    - Read genre tags │
│    - Map to super_   │
│      genre           │
│    - Clean metadata  │
│    - Move to Super-  │
│      crates/[genre]/ │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 7. Supercrates       │ (Organized by genre)
│    /House/           │
│    /Hip Hop/         │
│    /Techno/          │
│    etc.              │
└──────────┬───────────┘
           │
           ├────────────┬────────────┐
           ▼            ▼            ▼
┌──────────────┐ ┌──────────┐ ┌─────────────┐
│ Mako Sync    │ │ Serato   │ │ MediaMonkey │
│ (re-scan)    │ │ (perform)│ │ (backup)    │
└──────────────┘ └──────────┘ └─────────────┘
```

### Weekly Cycle

**Monday:**
1. Run Mako Sync "Missing Tracks" analysis
2. Select artists to sync → Push to slskd
3. slskd downloads overnight

**Tuesday:**
1. Run post-processor script (organizes downloads)
2. Run Mako Sync "Scan Local Files" (updates database)
3. Review "Unclassified" folder for manual tagging

**Wednesday-Sunday:**
1. Use tracks in Serato for gigs
2. Repeat cycle as needed

---

## Post-Download Processing

### Python Script: `organize_downloads.py`

**Purpose:** Automatically organize slskd downloads into Supercrates folders based on genre tags.

### Features

✅ Reads ID3 tags (artist, title, genre)
✅ Maps genre → super_genre using static mapping
✅ Cleans metadata (removes "feat.", brackets, etc.)
✅ Renames files: "Artist - Title.mp3"
✅ Moves to `/Supercrates/[super_genre]/`
✅ Handles duplicates (skips if exists)
✅ Unmapped genres → "Unclassified" folder

### Installation

```bash
# Install dependency
pip install mutagen

# Download script
# (See full script in previous conversation or below)

# Configure paths
nano organize_downloads.py
# Edit: DOWNLOAD_DIR and SUPERCRATES_BASE

# Run
python3 organize_downloads.py
```

### Automation Options

**Option 1: Cron Job** (every 10 minutes)
```bash
crontab -e
*/10 * * * * /usr/bin/python3 /path/to/organize_downloads.py
```

**Option 2: Manual Trigger**
```bash
# Run when you notice downloads completed
python3 organize_downloads.py
```

### Static Genre Mapping

```python
GENRE_MAPPING = {
    "House": ["house", "deep house", "tech house", "progressive house"],
    "Hip Hop": ["hip hop", "rap", "trap", "boom bap"],
    "Techno": ["techno", "minimal techno", "detroit techno"],
    "Bass": ["dubstep", "drum and bass", "dnb", "jungle"],
    "Disco": ["disco", "nu-disco", "funk"],
    "Electronic": ["electronic", "electronica", "ambient", "idm"],
    "Rock": ["rock", "classic rock", "hard rock", "punk rock"],
    "Pop": ["pop", "synth pop", "electropop", "indie pop"],
    "Jazz": ["jazz", "bebop", "smooth jazz", "jazz fusion"],
    "Soul-Funk": ["soul", "funk", "motown", "r&b 1970s", "r&b 1980s"],
    "Urban": ["r&b", "rnb", "contemporary r&b", "r&b 1990s", "r&b 2000s"],
    "Metal": ["metal", "heavy metal", "thrash metal", "death metal"],
    "Latin": ["latin", "salsa", "reggaeton", "bachata"],
    "Reggae-Dancehall": ["reggae", "dancehall", "dub", "roots reggae"],
    "UK Garage": ["uk garage", "garage", "2-step", "grime"],
    "Drum & Bass": ["drum and bass", "dnb", "jungle", "neurofunk"],
    "Country": ["country", "bluegrass", "americana"],
    "Folk": ["folk", "indie folk", "folk rock"],
    "Blues": ["blues", "delta blues", "chicago blues"],
    "World": ["world", "afrobeat", "world music", "ethnic"],
    "Indie-Alternative": ["indie", "alternative", "indie rock", "indie pop"]
}
```

### Expected Folder Structure

```
/Supercrates/
├── House/
│   ├── Daft Punk - One More Time.mp3
│   ├── Disclosure - Latch.mp3
│   └── Fisher - Losing It.mp3
├── Hip Hop/
│   ├── Kendrick Lamar - HUMBLE.mp3
│   └── J. Cole - Middle Child.mp3
├── Techno/
│   ├── Adam Beyer - Your Mind.mp3
│   └── Charlotte de Witte - Selected.mp3
├── Bass/
│   └── Skrillex - Bangarang.mp3
└── Unclassified/
    └── Unknown Artist - Track.mp3
```

---

## Mako Sync slskd Integration

### Overview

Enable users to push missing tracks from Mako Sync directly to their slskd wishlist for automatic download.

### Architecture

**Client-Side Integration:**
- Direct REST API calls from browser to slskd
- No edge function required
- User provides slskd API endpoint + key

**Database:**
- 1 new table: `user_preferences` (stores slskd config)
- No sync state tracking (ephemeral operations)

**Duplicate Prevention:**
- Query slskd wishlist via API before adding
- Normalize search text and compare

### Functional Requirements

**FR-10.1:** slskd configuration interface
**FR-10.2:** Store config in `user_preferences` with RLS
**FR-10.3:** Artist-level selection in Missing Tracks Analyzer
**FR-10.4:** "Push to slskd Wishlist" button
**FR-10.5:** Format queries as "Artist - Title 320 MP3"
**FR-10.6:** Duplicate prevention via API queries
**FR-10.7:** Sync progress and results display
**FR-10.8:** Error handling (401, 429, 500, timeouts)
**FR-10.9:** Multi-user support (separate configs)
**FR-10.10:** Special character handling

### Database Schema

```sql
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  slskd_api_endpoint TEXT,
  slskd_api_key TEXT,
  slskd_last_connection_test TIMESTAMPTZ,
  slskd_connection_status BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Row Level Security
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON public.user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### Implementation Phases

**Phase 1: Configuration & Connection (Week 1)**
- Create `user_preferences` table
- Build settings UI (API endpoint + key inputs)
- Implement connection test
- Save/load configuration per user

**Phase 2: UI Enhancement (Week 2)**
- Add checkboxes to Missing Tracks Analyzer (per artist)
- Add "Push to slskd Wishlist" button
- Add selection state management
- Enable button only when connected + selected

**Phase 3: API Integration (Week 3)**
- Implement slskd API client service
- GET /api/v0/searches (check existing wishlist)
- POST /api/v0/searches (add tracks)
- Format queries: "Artist - Title 320 MP3"
- Duplicate detection logic

**Phase 4: Progress & Results (Week 4)**
- Sync progress modal with real-time updates
- Display: Added, Skipped, Failed counts
- Error list with retry option
- Toast notifications

**Phase 5: Testing & Polish (Week 5)**
- Unit tests (query formatting, duplicate detection)
- Integration tests with mock slskd API
- Manual testing with real slskd instance
- Bug fixes and UX improvements

### Files to Create

**New Files (7):**
1. `src/types/slskd.ts` - TypeScript interfaces
2. `src/services/slskdClient.service.ts` - API client
3. `src/hooks/useSlskdConfig.ts` - Config management
4. `src/hooks/useSlskdSync.ts` - Sync operations
5. `src/components/SlskdConfigSection.tsx` - Settings UI
6. `src/components/SlskdSyncProgress.tsx` - Progress modal
7. `src/components/SlskdConnectionBadge.tsx` - Status indicator

**Modified Files (2):**
1. `src/components/MissingTracksAnalyzer.tsx` - Add checkboxes + sync button
2. `src/pages/Security.tsx` - Add slskd config section

**Database Migrations (1):**
1. `supabase/migrations/[timestamp]_create_user_preferences.sql`

### slskd API Reference

**Base URL:** User-configured (e.g., `http://localhost:5030`)
**Authentication:** `X-API-Key` header

**1. Test Connection**
```
GET /api/v0/session
Response: { username: "string", isLoggedIn: true }
```

**2. Get Wishlist**
```
GET /api/v0/searches
Response: [{ id: "uuid", searchText: "Artist - Track 320 MP3", state: "InProgress" }]
```

**3. Add to Wishlist**
```
POST /api/v0/searches
Body: { searchText: "Artist - Track 320 MP3" }
Response: { id: "uuid", searchText: "...", state: "InProgress" }
```

---

## Implementation Checklist

### Prerequisites

- [ ] slskd installed and running
- [ ] Python 3.x installed
- [ ] pip install mutagen
- [ ] Supercrates folder structure created

### Post-Download Processor Setup

- [ ] Create `organize_downloads.py` script
- [ ] Configure DOWNLOAD_DIR path
- [ ] Configure SUPERCRATES_BASE path
- [ ] Customize GENRE_MAPPING if needed
- [ ] Test with sample downloads
- [ ] Set up automation (cron or systemd timer)

### Mako Sync slskd Integration

**Phase 1: Database & Services**
- [ ] Create user_preferences migration
- [ ] Apply migration to database
- [ ] Create `src/types/slskd.ts`
- [ ] Create `src/services/slskdClient.service.ts`
- [ ] Create `src/hooks/useSlskdConfig.ts`
- [ ] Test connection with real slskd instance

**Phase 2: Settings UI**
- [ ] Add slskd config section to Security page
- [ ] API endpoint input field
- [ ] API key input field (password type)
- [ ] Test connection button
- [ ] Connection status badge
- [ ] Save/cancel buttons
- [ ] Toast notifications

**Phase 3: Missing Tracks UI**
- [ ] Add checkboxes to MissingTracksAnalyzer
- [ ] Artist-level selection state
- [ ] Track count display per artist
- [ ] "Push to slskd Wishlist" button
- [ ] Enable button logic (config + selection)
- [ ] Confirmation dialog

**Phase 4: Sync Implementation**
- [ ] Create `src/hooks/useSlskdSync.ts`
- [ ] Implement batch sync logic
- [ ] Query existing slskd searches
- [ ] Format search queries
- [ ] Duplicate detection
- [ ] Error handling (401, 429, 500, timeout)
- [ ] Progress tracking

**Phase 5: Progress & Results UI**
- [ ] Create SlskdSyncProgress component
- [ ] Progress bar (X/Y tracks)
- [ ] Real-time status updates
- [ ] Added/Skipped/Failed counts
- [ ] Error list display
- [ ] Retry failed tracks button
- [ ] Close/dismiss button

**Phase 6: Testing**
- [ ] Unit tests for query formatting
- [ ] Unit tests for duplicate detection
- [ ] Integration tests with mock API
- [ ] Manual testing with real slskd
- [ ] Test error scenarios
- [ ] Multi-user testing
- [ ] Performance testing (100+ tracks)

---

## Next Steps

### Immediate Actions (This Week)

1. **Set up post-download processor**
   ```bash
   pip install mutagen
   nano organize_downloads.py  # Configure paths
   python3 organize_downloads.py  # Test run
   ```

2. **Configure slskd**
   - Install slskd if not already installed
   - Configure download directory
   - Get API key from slskd settings
   - Test API access: `curl http://localhost:5030/api/v0/session -H "X-API-Key: YOUR_KEY"`

3. **Test workflow manually**
   - Identify missing track in Mako Sync
   - Manually add to slskd wishlist
   - Let slskd download
   - Run organize_downloads.py
   - Verify file in correct Supercrates folder
   - Re-scan in Mako Sync
   - Confirm track no longer "missing"

### Phase 1 Implementation (Week 1-2)

1. **Create database migration**
   - Copy schema from this document
   - Test locally with Supabase CLI
   - Apply to production

2. **Build slskd settings UI**
   - Add section to Security page
   - Create form with endpoint + key inputs
   - Implement test connection
   - Save to user_preferences table

3. **Test with real slskd**
   - Enter your slskd credentials
   - Test connection
   - Verify stored in database
   - Test multi-user (if applicable)

### Phase 2-5 Implementation (Week 3-6)

Follow the implementation phases outlined above, one phase per week.

---

## Documentation References

**Detailed Documentation:**
- [PRD - Epic 4.10](./prd-mako-sync.md#410-epic-10-slskd-integration-for-missing-track-acquisition)
- [Implementation Plan](./implementation-plan-slskd.md)
- [Architecture](./architecture-mako-sync.md#101-slskd-integration-one-way)
- [Design Brief - UI Patterns](./design-brief-mako-sync.md#14-slskd-integration-ui-patterns)
- [Integration Summary](./slskd-integration-summary.md)

**Key Concepts:**
- **Supercrates**: Genre-organized folders (single source of truth)
- **super_genre**: Mako Sync's 21 high-level genre categories
- **Missing Tracks**: Spotify tracks not found in Supercrates
- **Post-Processor**: Python script that organizes downloads
- **Ephemeral Sync**: No persistent state tracking (query slskd API each time)

---

## Support & Troubleshooting

### Common Issues

**Post-Processor:**
- Files not moving → Check paths in script
- Wrong genres → Edit GENRE_MAPPING
- No genre tag → Files go to "Unclassified"

**Mako Sync Integration:**
- Connection failed → Check slskd URL and API key
- Duplicates added → Check duplicate detection logic
- Sync timeout → Reduce batch size or add delays

**General:**
- Missing tracks not updating → Re-run Mako Sync local scan
- Files in wrong folder → Manually move and re-scan
- Poor metadata → Clean in Mp3tag or MediaMonkey first

### Getting Help

- Check logs: `organize_downloads.py` output
- Check browser console: Mako Sync errors
- Check slskd logs: API errors
- Review documentation in `/docs/`

---

## Future Enhancements (Out of Scope)

**Post-Processor:**
- [ ] Quality filtering (skip <256kbps)
- [ ] BPM detection
- [ ] Automatic metadata lookup (MusicBrainz)
- [ ] Web UI for manual review

**Mako Sync Integration:**
- [ ] Bi-directional sync (track download status)
- [ ] Quality preferences (FLAC, variable bitrates)
- [ ] Album-level approval
- [ ] Automatic periodic sync
- [ ] Download progress monitoring
- [ ] Priority queue

---

**Document Status:** ✅ Ready for Implementation
**Next Action:** Set up post-download processor and test workflow manually
**Estimated Timeline:** 6 weeks for full slskd integration in Mako Sync
