/**
 * Utility function that wraps promises with a timeout
 * @param promise The promise to wrap with timeout
 * @param timeoutMs Timeout in milliseconds
 * @param timeoutMessage Custom timeout error message
 * @returns Promise that resolves with the original promise or rejects with timeout error
 */
export const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'Operation timed out'
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    )
  ]);
};