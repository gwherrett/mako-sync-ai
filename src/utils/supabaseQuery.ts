/**
 * Supabase query utilities with timeout protection
 */

const DEFAULT_TIMEOUT_MS = 15000; // 15 seconds

export interface QueryResult<T> {
  data: T | null;
  error: Error | null;
  timedOut: boolean;
  durationMs: number;
}

/**
 * Wraps a Supabase query promise with timeout protection
 */
export const withQueryTimeout = async <T>(
  queryFn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  context: string = 'query'
): Promise<QueryResult<T>> => {
  const controller = new AbortController();
  const startTime = Date.now();
  
  const timeoutId = setTimeout(() => {
    console.warn(`⏱️ TIMEOUT: ${context} exceeded ${timeoutMs}ms, aborting...`);
    controller.abort();
  }, timeoutMs);

  console.log(`🔄 QUERY START: ${context}`);

  try {
    const result = await queryFn(controller.signal);
    const duration = Date.now() - startTime;
    console.log(`✅ QUERY COMPLETE: ${context} (${duration}ms)`);
    return { data: result, error: null, timedOut: false, durationMs: duration };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    if (error.name === 'AbortError') {
      console.error(`⏱️ QUERY TIMEOUT: ${context} aborted after ${duration}ms`);
      return { data: null, error: new Error(`Query timed out after ${timeoutMs}ms`), timedOut: true, durationMs: duration };
    }
    console.error(`❌ QUERY ERROR: ${context} failed after ${duration}ms:`, error);
    return { data: null, error, timedOut: false, durationMs: duration };
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Execute a Supabase query with timeout - simplified helper for common patterns
 */
export const executeWithTimeout = async <T>(
  queryBuilder: { abortSignal: (signal: AbortSignal) => Promise<T> } | (() => Promise<T>),
  context: string = 'query',
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<QueryResult<T>> => {
  return withQueryTimeout(
    async (signal) => {
      if (typeof queryBuilder === 'function') {
        return queryBuilder();
      }
      return queryBuilder.abortSignal(signal);
    },
    timeoutMs,
    context
  );
};

/**
 * Test basic Supabase connectivity with a minimal query
 */
export const testSupabaseConnectivity = async (
  supabase: any,
  timeoutMs: number = 5000
): Promise<{ connected: boolean; latencyMs: number; error?: string }> => {
  const startTime = Date.now();
  
  try {
    const result = await withQueryTimeout(
      async (signal) => {
        // Simple query to test connectivity
        const { error } = await supabase
          .from('profiles')
          .select('id')
          .limit(1)
          .abortSignal(signal);
        
        if (error && error.code !== 'PGRST116') { // Ignore "no rows" error
          throw error;
        }
        return true;
      },
      timeoutMs,
      'connectivity-test'
    );
    
    return {
      connected: true,
      latencyMs: Date.now() - startTime
    };
  } catch (error: any) {
    return {
      connected: false,
      latencyMs: Date.now() - startTime,
      error: error.message
    };
  }
};
