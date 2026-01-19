import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NormalizationService } from '../normalization.service';

describe('NormalizationService', () => {
  let service: NormalizationService;

  beforeEach(() => {
    service = new NormalizationService();
  });

  describe('normalize', () => {
    it('should normalize basic text', () => {
      expect(service.normalize('Hello World')).toBe('hello world');
    });

    it('should handle empty strings', () => {
      expect(service.normalize('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(service.normalize(null)).toBe('');
    });

    it('should remove diacritics', () => {
      expect(service.normalize('Beyoncé')).toBe('beyonce');
    });

    it('should unify punctuation', () => {
      expect(service.normalize('Artist A & Artist B')).toContain('&');
    });
  });

  describe('extractVersionInfo', () => {
    it('should extract remix type', () => {
      const result = service.extractVersionInfo('Song Title (Radio Edit)');
      expect(result.mix).toBe('Radio Edit');
      expect(result.core).toBe('Song Title');
    });

    it('should handle titles without mix type', () => {
      const result = service.extractVersionInfo('Regular Song Title');
      expect(result.mix).toBeNull();
      expect(result.core).toBe('Regular Song Title');
    });

    it('should extract extended mix', () => {
      const result = service.extractVersionInfo('Track Name (Extended Mix)');
      expect(result.mix).toBe('Extended Mix');
    });

    it('should handle null input', () => {
      const result = service.extractVersionInfo(null);
      expect(result.core).toBe('');
      expect(result.mix).toBeNull();
    });
  });

  describe('parseArtists', () => {
    it('should extract primary artist from featuring format', () => {
      const result = service.parseArtists('Artist A feat. Artist B');
      expect(result.primary).toBe('Artist A');
      expect(result.featured).toContain('Artist B');
    });

    it('should handle single artist', () => {
      const result = service.parseArtists('Solo Artist');
      expect(result.primary).toBe('Solo Artist');
      expect(result.featured).toHaveLength(0);
    });

    it('should handle null input', () => {
      const result = service.parseArtists(null);
      expect(result.primary).toBe('');
      expect(result.featured).toHaveLength(0);
    });
  });

  describe('processMetadata', () => {
    it('should process complete track metadata', () => {
      const result = service.processMetadata(
        'Song Title (Extended Mix)',
        'Main Artist feat. Featured Artist'
      );
      
      expect(result.normalizedTitle).toBeDefined();
      expect(result.normalizedArtist).toBeDefined();
      expect(result.coreTitle).toBeDefined();
      expect(result.primaryArtist).toBeDefined();
      expect(result.featuredArtists).toBeInstanceOf(Array);
      expect(result.mix).toBe('Extended Mix');
    });

    it('should handle null inputs', () => {
      const result = service.processMetadata(null, null);
      expect(result.normalizedTitle).toBe('');
      expect(result.normalizedArtist).toBe('');
    });
  });
});
