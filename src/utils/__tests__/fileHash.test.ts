import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateFileHash } from '../fileHash';

describe('generateFileHash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate a SHA-256 hash from file content', async () => {
    const content = 'Hello, World!';
    const blob = new Blob([content], { type: 'text/plain' });
    const file = new File([blob], 'test.txt', { type: 'text/plain' });

    const hash = await generateFileHash(file);

    // SHA-256 produces 64 hex characters
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('should generate consistent hash for same content', async () => {
    const content = 'Same content';
    const file1 = new File([content], 'file1.txt');
    const file2 = new File([content], 'file2.txt');

    const hash1 = await generateFileHash(file1);
    const hash2 = await generateFileHash(file2);

    expect(hash1).toBe(hash2);
  });

  it('should generate different hashes for different content', async () => {
    const file1 = new File(['Content A'], 'file1.txt');
    const file2 = new File(['Content B'], 'file2.txt');

    const hash1 = await generateFileHash(file1);
    const hash2 = await generateFileHash(file2);

    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty file', async () => {
    const file = new File([], 'empty.txt');

    const hash = await generateFileHash(file);

    expect(hash).toHaveLength(64);
    // Known SHA-256 hash of empty string
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('should handle binary content', async () => {
    const binaryData = new Uint8Array([0x00, 0x01, 0x02, 0xff]);
    const file = new File([binaryData], 'binary.bin');

    const hash = await generateFileHash(file);

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });
});
