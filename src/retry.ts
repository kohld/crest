import { logError, ErrorSeverity } from "./error-logger";

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // in milliseconds
  maxDelay: number; // in milliseconds
  backoffFactor: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  context: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  shouldRetry: (error: Error) => boolean = defaultShouldRetry
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === config.maxRetries) {
        // Final attempt failed
        await logError(context, lastError, ErrorSeverity.CRITICAL, attempt + 1);
        throw lastError;
      }
      
      if (!shouldRetry(lastError)) {
        // Error is not retryable
        await logError(context, lastError, ErrorSeverity.ERROR, attempt + 1);
        throw lastError;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        config.baseDelay * Math.pow(config.backoffFactor, attempt),
        config.maxDelay
      );
      
      await logError(context, lastError, ErrorSeverity.WARNING, attempt + 1);
      console.warn(`Retry ${attempt + 1}/${config.maxRetries} for ${context} after ${delay}ms`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // Should not reach here, but TypeScript needs it
  throw lastError ?? new Error("Retry failed with unknown error");
}

export function defaultShouldRetry(error: Error): boolean {
  // Retry on network errors, timeouts, 5xx HTTP errors, and rate limits (429)
  const message = error.message.toLowerCase();
  
  // Network errors
  if (message.includes("network") || 
      message.includes("econnreset") || 
      message.includes("timeout") ||
      message.includes("fetch failed")) {
    return true;
  }
  
  // HTTP 5xx errors
  if (message.includes("502") || 
      message.includes("503") || 
      message.includes("504") ||
      message.includes("500")) {
    return true;
  }
  
  // Rate limit (Too Many Requests)
  if (message.includes("429")) {
    return true;
  }
  
  return false;
}

// Specific retry configurations for different contexts
export const RETRY_CONFIGS = {
  github: {
    maxRetries: 3,
    baseDelay: 2000,
    maxDelay: 30000,
    backoffFactor: 2
  },
  openrouter: {
    maxRetries: 2,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2
  },
  default: DEFAULT_RETRY_CONFIG
};