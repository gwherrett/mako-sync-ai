/**
 * Type declarations for browser-id3-writer
 * https://github.com/nickygerritsen/browser-id3-writer
 */

declare module 'browser-id3-writer' {
  export default class ID3Writer {
    constructor(buffer: ArrayBuffer);

    /**
     * Set a text frame value
     * Common frames: TIT2 (title), TPE1 (artist), TALB (album), TCON (genre)
     */
    setFrame(name: string, value: string | string[]): this;

    /**
     * Set a TXXX (user-defined text) frame
     * @param name - Must be 'TXXX'
     * @param value - Object with description and value
     */
    setFrame(
      name: 'TXXX',
      value: { description: string; value: string }
    ): this;

    /**
     * Set a URL frame
     */
    setFrame(name: string, value: string): this;

    /**
     * Set an attached picture frame
     */
    setFrame(
      name: 'APIC',
      value: {
        type: number;
        data: ArrayBuffer;
        description?: string;
        useUnicodeEncoding?: boolean;
      }
    ): this;

    /**
     * Add the ID3 tag to the buffer
     */
    addTag(): ArrayBuffer;

    /**
     * Get the resulting buffer with ID3 tag
     */
    getBlob(): Blob;

    /**
     * Get a URL for the blob (for downloading)
     */
    getURL(): string;

    /**
     * Revoke the URL created by getURL()
     */
    revokeURL(): void;
  }
}
