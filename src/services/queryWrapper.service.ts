import { startupSessionValidator } from './startupSessionValidator.service';
import { sessionCache } from './sessionCache.service';

/**
 * Query Wrapper Service
 * 
 * Provides safe query execution that waits for startup validation to complete
 * before allowing queries to execute. This prevents queries from running with
 * tokens that are about to be cleared.
 */

interface QueryOptions {
  context: string;
  timeout?: number;
  skipValidationCheck?: boolean;
}

interface QueryResult<T> {
  data: T | null;
  error: Error | null;
  wasAborted: boolean;
}

/**
 * Wait for auth state to stabilize (no pending validations)
 */
export async function waitForAuthStability(context: string, timeoutMs: number = 3000): Promise<boolean> {
  const startTime = Date.now();
  
  // If already stable, return immediately
  if (sessionCache.isAuthStable()) {
    return true;
  }
  
  console.log(`⏳ QUERY WRAPPER: Waiting for auth stability - ${context}`);
  
  // Poll for stability
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (sessionCache.isAuthStable()) {
        clearInterval(checkInterval);
        const elapsed = Date.now() - startTime;
        console.log(`✅ QUERY WRAPPER: Auth stable after ${elapsed}ms - ${context}`);
        resolve(true);
        return;
      }
      
      // Check for timeout
      if (Date.now() - startTime > timeoutMs) {
        clearInterval(checkInterval);
        console.log(`⚠️ QUERY WRAPPER: Auth stability timeout after ${timeoutMs}ms - ${context}`);
        resolve(false);
        return;
      }
    }, 50); // Check every 50ms
  });
}

/**
 * Wait for startup validation to complete before executing a query
 */
export async function waitForValidation(context: string, timeoutMs: number = 15000): Promise<boolean> {
  const startTime = Date.now();
  
  // If already validated, return immediately
  if (startupSessionValidator.isValidationComplete()) {
    console.log(`✅ QUERY WRAPPER: Validation already complete for ${context}`);
    return true;
  }
  
  console.log(`⏳ QUERY WRAPPER: Waiting for startup validation - ${context}`);
  
  // Poll for validation completion
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (startupSessionValidator.isValidationComplete()) {
        clearInterval(checkInterval);
        const elapsed = Date.now() - startTime;
        console.log(`✅ QUERY WRAPPER: Validation completed after ${elapsed}ms - ${context}`);
        resolve(true);
        return;
      }
      
      // Check for timeout
      if (Date.now() - startTime > timeoutMs) {
        clearInterval(checkInterval);
        console.log(`⚠️ QUERY WRAPPER: Validation wait timed out after ${timeoutMs}ms - ${context}`);
        resolve(false);
        return;
      }
    }, 100); // Check every 100ms
  });
}

/**
 * Execute a query with startup validation check
 * Waits for startup validation to complete before executing the query
 */
export async function safeQuery<T>(
  queryFn: () => Promise<T>,
  options: QueryOptions
): Promise<QueryResult<T>> {
  const { context, timeout = 30000, skipValidationCheck = false } = options;
  
  try {
    // Wait for startup validation unless explicitly skipped
    if (!skipValidationCheck) {
      const isValidated = await waitForValidation(context, 10000);
      
      if (!isValidated) {
        console.log(`⚠️ SAFE QUERY: Proceeding without validation confirmation - ${context}`);
        // Continue anyway, but log the issue
      }
      
      // Also wait for auth stability (no pending session validations)
      await waitForAuthStability(context, 3000);
    }
    
    // Check if tokens still exist after validation
    const hasTokens = checkForAuthTokens();
    if (!hasTokens && !skipValidationCheck) {
      console.log(`❌ SAFE QUERY: No auth tokens available - ${context}`);
      return {
        data: null,
        error: new Error('No authentication tokens available. Please sign in again.'),
        wasAborted: false
      };
    }
    
    // Execute the query with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);
    
    try {
      const result = await Promise.race([
        queryFn(),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error(`Query timeout after ${timeout}ms: ${context}`));
          });
        })
      ]);
      
      clearTimeout(timeoutId);
      
      return {
        data: result,
        error: null,
        wasAborted: false
      };
    } catch (queryError) {
      clearTimeout(timeoutId);
      
      const wasAborted = controller.signal.aborted;
      
      if (wasAborted) {
        console.log(`⏱️ SAFE QUERY: Timeout - ${context}`);
      } else {
        console.error(`❌ SAFE QUERY: Error - ${context}:`, queryError);
      }
      
      return {
        data: null,
        error: queryError instanceof Error ? queryError : new Error(String(queryError)),
        wasAborted
      };
    }
  } catch (error) {
    console.error(`❌ SAFE QUERY: Unexpected error - ${context}:`, error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error(String(error)),
      wasAborted: false
    };
  }
}

/**
 * Check if auth tokens exist in localStorage
 */
function checkForAuthTokens(): boolean {
  try {
    const authKeys = Object.keys(localStorage).filter(key =>
      key.startsWith('sb-') && key.includes('auth-token')
    );
    return authKeys.length > 0;
  } catch {
    return false;
  }
}

/**
 * Create a query wrapper for a specific context
 * Returns a function that can be used to execute queries with the same options
 */
export function createQueryWrapper(defaultContext: string, defaultOptions?: Partial<QueryOptions>) {
  return async function<T>(queryFn: () => Promise<T>, overrideContext?: string): Promise<QueryResult<T>> {
    return safeQuery(queryFn, {
      context: overrideContext || defaultContext,
      ...defaultOptions
    });
  };
}

export default { safeQuery, waitForValidation, createQueryWrapper };
