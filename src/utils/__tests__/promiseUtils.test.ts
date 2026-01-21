import { describe, it, expect, vi, beforeAll } from 'vitest';

// Unmock promiseUtils to test the actual implementation
vi.unmock('@/utils/promiseUtils');

import { withTimeout } from '../promiseUtils';

describe('promiseUtils', () => {
  describe('withTimeout', () => {
    it('should resolve when promise completes before timeout', async () => {
      const promise = Promise.resolve('success');
      const result = await withTimeout(promise, 1000);
      expect(result).toBe('success');
    });

    it('should resolve with complex data types', async () => {
      const data = { id: 1, name: 'test', nested: { value: true } };
      const promise = Promise.resolve(data);
      const result = await withTimeout(promise, 1000);
      expect(result).toEqual(data);
    });

    it('should reject with timeout error when timeout exceeded', async () => {
      const slowPromise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('too late'), 500);
      });

      await expect(withTimeout(slowPromise, 50, 'Custom timeout')).rejects.toThrow('Custom timeout');
    });

    it('should use default timeout message when not provided', async () => {
      const slowPromise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('too late'), 500);
      });

      await expect(withTimeout(slowPromise, 50)).rejects.toThrow('Operation timed out');
    });

    it('should preserve original promise rejection', async () => {
      const error = new Error('Original error');
      const failingPromise = Promise.reject(error);

      await expect(withTimeout(failingPromise, 1000)).rejects.toThrow('Original error');
    });

    it('should handle immediate resolution', async () => {
      const promise = Promise.resolve(42);
      const result = await withTimeout(promise, 1000);
      expect(result).toBe(42);
    });

    it('should handle delayed resolution within timeout', async () => {
      const promise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('resolved'), 10);
      });

      const result = await withTimeout(promise, 100);
      expect(result).toBe('resolved');
    });

    it('should handle null and undefined values', async () => {
      const nullPromise = Promise.resolve(null);
      const undefinedPromise = Promise.resolve(undefined);

      const nullResult = await withTimeout(nullPromise, 1000);
      const undefinedResult = await withTimeout(undefinedPromise, 1000);

      expect(nullResult).toBeNull();
      expect(undefinedResult).toBeUndefined();
    });

    it('should handle array values', async () => {
      const promise = Promise.resolve([1, 2, 3]);
      const result = await withTimeout(promise, 1000);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should reject promise errors before timeout fires', async () => {
      const failingPromise = new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('Promise failed')), 10);
      });

      await expect(withTimeout(failingPromise, 100)).rejects.toThrow('Promise failed');
    });
  });
});
