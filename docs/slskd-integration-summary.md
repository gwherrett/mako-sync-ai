# slskd Integration - Documentation Summary

**Date:** January 10, 2026
**Status:** Planning Complete - Ready for Implementation

---

## Overview

This document provides a quick overview of the slskd integration documentation and where to find detailed information.

## Documentation Updates

### 1. Product Requirements Document (PRD)

**File:** [docs/prd-mako-sync.md](prd-mako-sync.md)

**What was added:**
- **Epic 4.10**: slskd Integration for Missing Track Acquisition
- 11 detailed functional requirements (FR-10.1 through FR-10.11)
- Integration architecture overview
- Future enhancements list

**Key Requirements:**
- User configuration of slskd API endpoint and key
- Artist-level approval workflow for pushing tracks
- Duplicate detection and prevention
- Comprehensive error handling
- Multi-user support with RLS isolation

**Priority:** P2 (Medium)
**Estimated Effort:** 21 story points

**Location in PRD:** Section 4.10 (before Technical Requirements section)

---

### 2. Implementation Plan

**File:** [docs/implementation-plan-slskd.md](implementation-plan-slskd.md)

**Contents:**
- Complete 5-phase implementation plan (5 weeks)
- Database schema (SQL + TypeScript interfaces)
- Complete service layer code examples
- React hooks implementation
- Testing strategy and checklist
- Deployment checklist
- Risk assessment and mitigation

**Phases:**
1. **Phase 1**: Configuration & Connection (Week 1)
2. **Phase 2**: UI Enhancement for Artist Selection (Week 2)
3. **Phase 3**: slskd API Integration (Week 3)
4. **Phase 4**: Sync Progress & Results UI (Week 4)
5. **Phase 5**: Testing & Refinement (Week 5)

**Key Deliverables:**
- 2 new database tables with RLS
- 7 new TypeScript files
- 2 modified existing components
- Full test suite

---

### 3. Architecture Documentation

**File:** [docs/architecture-mako-sync.md](architecture-mako-sync.md)

**What was added:**
- **Section 10**: External Integrations
- **Section 10.1**: slskd Integration (One-Way)

**Contents:**
- Integration flow diagram
- Key architectural decisions (client-side, no edge function)
- Security model (RLS, no Vault encryption)
- Database schema
- Service pattern
- UI integration points
- Multi-user isolation approach
- Performance considerations
- Limitations and future enhancements

**Location in Architecture:** Section 10.1 (new section before Testing Considerations)

---

### 4. Design Brief

**File:** [docs/design-brief-mako-sync.md](design-brief-mako-sync.md)

**What was added:**
- **Section 14**: slskd Integration UI Patterns
- **Section 15**: Component Checklist for slskd Integration

**Contents:**
- 14.1: Configuration Section (Settings Page) - Visual mockups
- 14.2: Artist Selection Interface - Checkbox design
- 14.3: Sync Progress Modal - Real-time progress
- 14.4: Results Summary - Success/error display
- 14.5: Connection Status Indicator - Badge design
- 14.6: Accessibility Requirements - WCAG compliance
- 14.7: Color Usage - Design system integration
- 14.8: Responsive Behavior - Mobile/tablet/desktop

**Visual Assets:**
- ASCII mockups for all UI components
- Component specifications using Shadcn/ui
- Color mappings to existing design system
- ARIA label examples for accessibility

---

## Quick Start Guide for Implementation

### 1. Review Documents in Order

1. **Start with PRD** ([prd-mako-sync.md](prd-mako-sync.md) - Section 4.10)
   - Understand functional requirements
   - Review acceptance criteria

2. **Review Architecture** ([architecture-mako-sync.md](architecture-mako-sync.md) - Section 10.1)
   - Understand technical approach
   - Review data flow and security model

3. **Study Implementation Plan** ([implementation-plan-slskd.md](implementation-plan-slskd.md))
   - Review phase-by-phase breakdown
   - Examine code examples
   - Review database schema

4. **Reference Design Brief** ([design-brief-mako-sync.md](design-brief-mako-sync.md) - Sections 14-15)
   - UI component specifications
   - Visual design patterns
   - Accessibility requirements

### 2. Database Setup (First Step)

Create one new table:

```sql
-- User preferences (slskd config)
CREATE TABLE public.user_preferences (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  slskd_api_endpoint TEXT,
  slskd_api_key TEXT,
  slskd_connection_status BOOLEAN,
  ...
);
```

**Note:** No sync state table needed. Duplicate detection handled by querying slskd API in real-time.

**Full schema:** See [implementation-plan-slskd.md](implementation-plan-slskd.md#database-schema)

### 3. Create Service Layer

Start with the slskd API client:

**File:** `src/services/slskdClient.service.ts`

**Methods:**
- `testConnection()` - Validate credentials
- `getExistingSearches()` - Fetch wishlist
- `addToWishlist()` - Add track
- `formatSearchQuery()` - Format search string
- `isSearchDuplicate()` - Check for duplicates

**Full implementation:** See [implementation-plan-slskd.md](implementation-plan-slskd.md#slskd-api-client-service)

### 4. Build React Hooks

Create data management hooks:

**Files:**
- `src/hooks/useSlskdConfig.ts` - Configuration CRUD
- `src/hooks/useSlskdSync.ts` - Sync operations

**Full implementation:** See [implementation-plan-slskd.md](implementation-plan-slskd.md#sync-hook)

### 5. Build UI Components

Modify existing and create new components:

**Modify:**
- `src/components/MissingTracksAnalyzer.tsx` - Add checkboxes + sync button
- `src/pages/Security.tsx` - Add slskd config section

**Create:**
- `src/components/SlskdConfigSection.tsx` - Settings UI
- `src/components/SlskdSyncProgress.tsx` - Progress modal
- `src/components/SlskdConnectionBadge.tsx` - Status badge

**Visual specs:** See [design-brief-mako-sync.md](design-brief-mako-sync.md#14-slskd-integration-ui-patterns)

---

## Key Architectural Decisions

### Why Client-Side Integration?

**Decision:** Call slskd API directly from browser (no edge function)

**Rationale:**
- slskd is user's local/self-hosted service (not a third-party API)
- No need for server-side token management
- User controls CORS settings on their slskd instance
- Simpler implementation, fewer moving parts

### Why No Encryption for slskd Credentials?

**Decision:** Store API key in plain text in `user_preferences` table

**Rationale:**
- slskd is user-controlled service (not a third-party)
- User responsible for securing their slskd instance
- Row Level Security (RLS) prevents cross-user access
- Supabase Vault reserved for third-party service tokens (Spotify)

### Why Artist-Level Approval?

**Decision:** Checkboxes at artist level, not track level

**Rationale:**
- Reduces UI complexity (fewer checkboxes to manage)
- Matches DJ workflow ("I want all Pink Floyd tracks")
- Existing MissingTracksAnalyzer already groups by artist
- Can add track-level selection in future if needed

---

## Testing Strategy

### Unit Tests

**Coverage:** >80% for new code

**Focus Areas:**
- Query formatting (`formatSearchQuery()`)
- Duplicate detection (`isSearchDuplicate()`)
- Error handling in slskdClient

**Location:** `src/__tests__/slskdClient.test.ts`

### Integration Tests

**Scenarios:**
- Full flow: config → select → sync → results
- Multi-user: Different configs per user
- Error handling: Network failures, rate limiting
- Large datasets: 100+ tracks

### Manual Testing

**With real slskd instance:**
- Test connection validation
- Verify duplicate prevention
- Confirm tracks appear in slskd wishlist
- Test error scenarios (disconnect during sync)

**Full testing checklist:** See [implementation-plan-slskd.md](implementation-plan-slskd.md#testing-strategy)

---

## Success Metrics

### Technical

- **Connection Success Rate**: >95% of valid credentials connect
- **Sync Accuracy**: 100% of approved tracks added or retried
- **Duplicate Prevention**: 0% duplicate additions
- **Error Recovery**: Failed tracks retryable

### User Experience

- **Configuration Time**: <2 minutes to set up
- **Sync Speed**: <5 seconds per track average
- **Error Clarity**: Users understand errors and fixes
- **Feature Adoption**: 50%+ of users with missing tracks try sync

---

## Files Changed Summary

### New Files (7)

1. `src/services/slskdClient.service.ts` - API client
2. `src/hooks/useSlskdConfig.ts` - Config hook
3. `src/hooks/useSlskdSync.ts` - Sync hook
4. `src/types/slskd.ts` - TypeScript types
5. `src/components/SlskdConfigSection.tsx` - Settings UI
6. `src/components/SlskdSyncProgress.tsx` - Progress modal
7. `src/components/SlskdConnectionBadge.tsx` - Status badge

### Modified Files (2)

1. `src/components/MissingTracksAnalyzer.tsx` - Add selection + sync
2. `src/pages/Security.tsx` - Add config section

### Database Migrations (1)

1. `supabase/migrations/[timestamp]_create_user_preferences.sql`

---

## Dependencies

### Required

- **slskd instance**: User must have slskd running and accessible
- **Missing Tracks**: Requires Epic 6 (Missing Tracks Analysis) complete
- **Existing UI**: Leverages MissingTracksAnalyzer component
- **Shadcn/ui**: Uses existing component library

### No New Dependencies

All functionality uses existing packages:
- React 18 ✓
- TypeScript ✓
- Tanstack Query ✓
- Supabase client ✓
- Shadcn/ui components ✓
- Fetch API (built-in) ✓

---

## Future Enhancements (Out of Scope)

**Not included in V1 - documented for future consideration:**

1. Bi-directional sync (import download status from slskd)
2. Quality preferences (FLAC, variable bitrates)
3. Album-level or track-level approval
4. Automatic periodic sync
5. Download progress monitoring
6. Search result preview before adding
7. Priority queue for downloads
8. Notifications when downloads complete
9. Analytics dashboard (sync stats)

---

## Risk Mitigation

### High Risks

1. **slskd API Changes**: Monitor slskd releases, version pin
2. **Network Reliability**: Robust retry, state preservation
3. **Rate Limiting**: Delays between requests, backoff

### Medium Risks

1. **Special Characters**: Comprehensive sanitization
2. **Large Datasets**: Batch processing, progress updates
3. **Multiple Users on Same slskd**: User isolation via RLS

**Full risk assessment:** See [implementation-plan-slskd.md](implementation-plan-slskd.md#risk-mitigation)

---

## Next Steps

1. **Review all documentation** (this summary + 4 detailed docs)
2. **Set up development environment** (local slskd instance for testing)
3. **Create database migrations** (user_preferences + slskd_sync_state)
4. **Implement Phase 1** (Configuration & Connection)
5. **Test with real slskd instance**
6. **Proceed through Phases 2-5**

---

## Questions or Clarifications?

Refer to the detailed documents:

- **What to build?** → [PRD](prd-mako-sync.md#410-epic-10-slskd-integration-for-missing-track-acquisition)
- **How to build it?** → [Implementation Plan](implementation-plan-slskd.md)
- **Why these decisions?** → [Architecture](architecture-mako-sync.md#101-slskd-integration-one-way)
- **What should it look like?** → [Design Brief](design-brief-mako-sync.md#14-slskd-integration-ui-patterns)

---

**Documentation prepared by:** Claude Sonnet 4.5
**Date:** January 10, 2026
**Status:** ✅ Complete - Ready for Development
