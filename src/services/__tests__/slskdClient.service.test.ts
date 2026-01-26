import { describe, it, expect } from 'vitest';
import { SlskdClientService } from '../slskdClient.service';

describe('SlskdClientService', () => {
  describe('formatSearchQuery', () => {
    it('uses primary artist only when format is primary', () => {
      expect(
        SlskdClientService.formatSearchQuery('Artist1, Artist2', 'Title', 'primary')
      ).toBe('Artist1 - Title');
    });

    it('uses full artist when format is full', () => {
      expect(
        SlskdClientService.formatSearchQuery('Artist1, Artist2', 'Title', 'full')
      ).toBe('Artist1, Artist2 - Title');
    });

    it('strips feat. from primary artist', () => {
      expect(
        SlskdClientService.formatSearchQuery('Artist feat. Other', 'Title', 'primary')
      ).toBe('Artist - Title');
    });

    it('strips ft. from primary artist', () => {
      expect(
        SlskdClientService.formatSearchQuery('Artist ft. Other', 'Title', 'primary')
      ).toBe('Artist - Title');
    });

    it('handles "feat" without period', () => {
      expect(
        SlskdClientService.formatSearchQuery('Artist feat Other', 'Title', 'primary')
      ).toBe('Artist - Title');
    });

    it('does not include bitrate in query', () => {
      expect(
        SlskdClientService.formatSearchQuery('Artist', 'Title', 'primary')
      ).not.toContain('320');
      expect(
        SlskdClientService.formatSearchQuery('Artist', 'Title', 'primary')
      ).not.toContain('MP3');
    });

    it('sanitizes quotes from artist', () => {
      expect(
        SlskdClientService.formatSearchQuery('"Artist"', 'Title', 'primary')
      ).toBe('Artist - Title');
    });

    it('sanitizes quotes from title', () => {
      expect(
        SlskdClientService.formatSearchQuery('Artist', '"Title"', 'primary')
      ).toBe('Artist - Title');
    });

    it('defaults to primary format', () => {
      expect(SlskdClientService.formatSearchQuery('Artist1, Artist2', 'Title')).toBe(
        'Artist1 - Title'
      );
    });

    it('handles complex artist strings', () => {
      expect(
        SlskdClientService.formatSearchQuery(
          'Main Artist feat. Featured Artist, Another Artist',
          'Song Title',
          'primary'
        )
      ).toBe('Main Artist - Song Title');
    });
  });

  describe('normalizeSearchText', () => {
    it('converts to lowercase', () => {
      expect(SlskdClientService.normalizeSearchText('ARTIST - TITLE')).toBe(
        'artist title'
      );
    });

    it('removes special characters', () => {
      expect(SlskdClientService.normalizeSearchText("Artist's Song!")).toBe(
        'artists song'
      );
    });

    it('normalizes whitespace', () => {
      expect(SlskdClientService.normalizeSearchText('Artist  -  Title')).toBe(
        'artist title'
      );
    });

    it('trims whitespace', () => {
      expect(SlskdClientService.normalizeSearchText('  Artist - Title  ')).toBe(
        'artist title'
      );
    });
  });

  describe('isSearchDuplicate', () => {
    const existingSearches = [
      { id: '1', searchText: 'Artist - Title', state: 'Completed' as const },
      { id: '2', searchText: 'Another Artist - Another Song', state: 'InProgress' as const },
    ];

    it('detects exact duplicate', () => {
      expect(
        SlskdClientService.isSearchDuplicate(existingSearches, 'Artist - Title')
      ).toBe(true);
    });

    it('detects case-insensitive duplicate', () => {
      expect(
        SlskdClientService.isSearchDuplicate(existingSearches, 'ARTIST - TITLE')
      ).toBe(true);
    });

    it('returns false for non-duplicate', () => {
      expect(
        SlskdClientService.isSearchDuplicate(existingSearches, 'New Artist - New Song')
      ).toBe(false);
    });

    it('handles empty existing searches', () => {
      expect(SlskdClientService.isSearchDuplicate([], 'Artist - Title')).toBe(false);
    });
  });
});
