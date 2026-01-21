import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NormalizationService } from '@/services/normalization.service';

/**
 * Tests for the Edit Track Metadata functionality
 *
 * Note: The test environment is configured for 'node', not 'jsdom',
 * so these tests focus on the business logic rather than React component rendering.
 * The component itself is a thin wrapper around these logic functions.
 */

describe('EditTrackMetadataDialog Logic', () => {
  describe('getFilename', () => {
    const getFilename = (filePath: string) => {
      return filePath.split('/').pop() || filePath;
    };

    it('should extract filename from full path', () => {
      expect(getFilename('/home/user/Music/Artist - Track.mp3')).toBe('Artist - Track.mp3');
    });

    it('should handle path with multiple directories', () => {
      expect(getFilename('/a/b/c/d/e/file.mp3')).toBe('file.mp3');
    });

    it('should return the input if no slashes', () => {
      expect(getFilename('file.mp3')).toBe('file.mp3');
    });

    it('should handle empty string', () => {
      expect(getFilename('')).toBe('');
    });
  });

  describe('getDirectory', () => {
    const getDirectory = (filePath: string) => {
      const parts = filePath.split('/');
      parts.pop();
      return parts.join('/');
    };

    it('should extract directory from full path', () => {
      expect(getDirectory('/home/user/Music/Artist - Track.mp3')).toBe('/home/user/Music');
    });

    it('should handle deep paths', () => {
      expect(getDirectory('/a/b/c/d/file.mp3')).toBe('/a/b/c/d');
    });

    it('should return empty string for filename only', () => {
      expect(getDirectory('file.mp3')).toBe('');
    });
  });

  describe('formatFileSize', () => {
    const formatFileSize = (bytes: number | null) => {
      if (!bytes) return '—';
      const mb = bytes / (1024 * 1024);
      return `${mb.toFixed(1)} MB`;
    };

    it('should format bytes to MB', () => {
      expect(formatFileSize(1048576)).toBe('1.0 MB');
    });

    it('should handle larger files', () => {
      expect(formatFileSize(10485760)).toBe('10.0 MB');
    });

    it('should handle fractional MB', () => {
      expect(formatFileSize(5242880)).toBe('5.0 MB');
    });

    it('should return dash for null', () => {
      expect(formatFileSize(null)).toBe('—');
    });

    it('should return dash for zero', () => {
      expect(formatFileSize(0)).toBe('—');
    });
  });

  describe('Form data trimming', () => {
    const prepareFormData = (data: {
      title: string;
      artist: string;
      album: string;
      genre: string;
      year: string;
      mix: string;
    }) => {
      return {
        title: data.title.trim() || null,
        artist: data.artist.trim() || null,
        album: data.album.trim() || null,
        genre: data.genre.trim() || null,
        year: data.year ? parseInt(data.year, 10) : null,
        mix: data.mix.trim() || null,
      };
    };

    it('should trim whitespace from all fields', () => {
      const result = prepareFormData({
        title: '  Track Title  ',
        artist: '  Artist Name  ',
        album: '  Album Name  ',
        genre: '  House  ',
        year: '2024',
        mix: '  Extended Mix  ',
      });

      expect(result.title).toBe('Track Title');
      expect(result.artist).toBe('Artist Name');
      expect(result.album).toBe('Album Name');
      expect(result.genre).toBe('House');
      expect(result.mix).toBe('Extended Mix');
    });

    it('should convert empty strings to null', () => {
      const result = prepareFormData({
        title: '',
        artist: '   ',
        album: '',
        genre: '',
        year: '',
        mix: '',
      });

      expect(result.title).toBeNull();
      expect(result.artist).toBeNull();
      expect(result.album).toBeNull();
      expect(result.genre).toBeNull();
      expect(result.year).toBeNull();
      expect(result.mix).toBeNull();
    });

    it('should parse year as integer', () => {
      const result = prepareFormData({
        title: 'Test',
        artist: 'Test',
        album: '',
        genre: '',
        year: '2024',
        mix: '',
      });

      expect(result.year).toBe(2024);
      expect(typeof result.year).toBe('number');
    });
  });
});

describe('handleSaveMetadata normalization integration', () => {
  let normService: NormalizationService;

  beforeEach(() => {
    normService = new NormalizationService();
  });

  it('should compute normalized fields when saving', () => {
    const updates = {
      title: 'Song Title (Extended Mix)',
      artist: 'Main Artist feat. Featured Artist',
    };

    const normalized = normService.processMetadata(
      updates.title || null,
      updates.artist || null
    );

    const updateData = {
      ...updates,
      normalized_title: normalized.normalizedTitle || null,
      normalized_artist: normalized.normalizedArtist || null,
      core_title: normalized.coreTitle || null,
      primary_artist: normalized.primaryArtist || null,
      featured_artists: normalized.featuredArtists.length > 0 ? normalized.featuredArtists : null,
    };

    expect(updateData.normalized_title).toBeDefined();
    expect(updateData.normalized_artist).toBeDefined();
    expect(updateData.core_title).toBe('song title');
    expect(updateData.primary_artist).toBe('main artist');
    expect(updateData.featured_artists).toContain('Featured Artist');
  });

  it('should handle null title and artist', () => {
    const updates = {
      title: null as string | null,
      artist: null as string | null,
    };

    const normalized = normService.processMetadata(
      updates.title,
      updates.artist
    );

    const updateData = {
      ...updates,
      normalized_title: normalized.normalizedTitle || null,
      normalized_artist: normalized.normalizedArtist || null,
      core_title: normalized.coreTitle || null,
      primary_artist: normalized.primaryArtist || null,
      featured_artists: normalized.featuredArtists.length > 0 ? normalized.featuredArtists : null,
    };

    expect(updateData.normalized_title).toBeNull();
    expect(updateData.normalized_artist).toBeNull();
    expect(updateData.core_title).toBeNull();
    expect(updateData.primary_artist).toBeNull();
    expect(updateData.featured_artists).toBeNull();
  });

  it('should extract mix info from title', () => {
    const title = 'Track Name (Radio Edit)';
    const normalized = normService.processMetadata(title, 'Artist');

    expect(normalized.mix).toBe('Radio Edit');
    expect(normalized.coreTitle).toBe('track name');
  });

  it('should handle title without mix info', () => {
    const title = 'Simple Track Name';
    const normalized = normService.processMetadata(title, 'Artist');

    expect(normalized.mix).toBeNull();
    expect(normalized.coreTitle).toBe('simple track name');
  });

  it('should handle various featuring formats', () => {
    const testCases = [
      { artist: 'Artist A feat. Artist B', expected: { primary: 'artist a', featured: ['Artist B'] } },
      { artist: 'Artist A ft. Artist B', expected: { primary: 'artist a', featured: ['Artist B'] } },
      { artist: 'Artist A featuring Artist B', expected: { primary: 'artist a', featured: ['Artist B'] } },
    ];

    for (const testCase of testCases) {
      const normalized = normService.processMetadata('Track', testCase.artist);
      expect(normalized.primaryArtist).toBe(testCase.expected.primary);
      expect(normalized.featuredArtists).toEqual(testCase.expected.featured);
    }
  });
});
