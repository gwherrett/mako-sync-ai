/**
 * Supabase query utilities with timeout protection
 */

const DEFAULT_TIMEOUT_MS = 15000; // 15 seconds

/**
 * Wraps a Supabase query promise with timeout protection
 */
export const withQueryTimeout = async <T>(
  queryFn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  context: string = 'query'
): Promise<T> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn(`⏱️ TIMEOUT: ${context} exceeded ${timeoutMs}ms, aborting...`);
    controller.abort();
  }, timeoutMs);

  const startTime = Date.now();
  console.log(`🔄 QUERY START: ${context}`);

  try {
    const result = await queryFn(controller.signal);
    const duration = Date.now() - startTime;
    console.log(`✅ QUERY COMPLETE: ${context} (${duration}ms)`);
    return result;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    if (error.name === 'AbortError') {
      console.error(`⏱️ QUERY TIMEOUT: ${context} aborted after ${duration}ms`);
      throw new Error(`Query timed out after ${timeoutMs}ms: ${context}`);
    }
    console.error(`❌ QUERY ERROR: ${context} failed after ${duration}ms:`, error);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
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
