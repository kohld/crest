import { withRetry, defaultShouldRetry, RetryConfig } from "../src/retry";

console.log("Testing retry module...");

// Test 1: defaultShouldRetry returns true for 429 errors
const error429 = new Error("HTTP 429: Too Many Requests");
if (defaultShouldRetry(error429)) {
  console.log("✓ 429 errors are retryable");
} else {
  console.log("FAIL: 429 errors should be retryable");
}

// Test 2: defaultShouldRetry returns true for 5xx errors
const error500 = new Error("HTTP 500: Internal Server Error");
if (defaultShouldRetry(error500)) {
  console.log("✓ 500 errors are retryable");
} else {
  console.log("FAIL: 500 errors should be retryable");
}

const error502 = new Error("HTTP 502: Bad Gateway");
if (defaultShouldRetry(error502)) {
  console.log("✓ 502 errors are retryable");
} else {
  console.log("FAIL: 502 errors should be retryable");
}

const error503 = new Error("HTTP 503: Service Unavailable");
if (defaultShouldRetry(error503)) {
  console.log("✓ 503 errors are retryable");
} else {
  console.log("FAIL: 503 errors should be retryable");
}

const error504 = new Error("HTTP 504: Gateway Timeout");
if (defaultShouldRetry(error504)) {
  console.log("✓ 504 errors are retryable");
} else {
  console.log("FAIL: 504 errors should be retryable");
}

// Test 3: defaultShouldRetry returns true for network errors
const networkError = new Error("Network error: ECONNRESET");
if (defaultShouldRetry(networkError)) {
  console.log("✓ Network errors are retryable");
} else {
  console.log("FAIL: Network errors should be retryable");
}

const timeoutError = new Error("Request timeout");
if (defaultShouldRetry(timeoutError)) {
  console.log("✓ Timeout errors are retryable");
} else {
  console.log("FAIL: Timeout errors should be retryable");
}

// Test 4: defaultShouldRetry returns false for 4xx client errors (except 429)
const error400 = new Error("HTTP 400: Bad Request");
if (!defaultShouldRetry(error400)) {
  console.log("✓ 400 errors are not retryable");
} else {
  console.log("FAIL: 400 errors should not be retryable");
}

const error401 = new Error("HTTP 401: Unauthorized");
if (!defaultShouldRetry(error401)) {
  console.log("✓ 401 errors are not retryable");
} else {
  console.log("FAIL: 401 errors should not be retryable");
}

const error403 = new Error("HTTP 403: Forbidden");
if (!defaultShouldRetry(error403)) {
  console.log("✓ 403 errors are not retryable");
} else {
  console.log("FAIL: 403 errors should not be retryable");
}

const error404 = new Error("HTTP 404: Not Found");
if (!defaultShouldRetry(error404)) {
  console.log("✓ 404 errors are not retryable");
} else {
  console.log("FAIL: 404 errors should not be retryable");
}

// Test 5: withRetry actually retries on 429 and eventually succeeds
let attemptCount = 0;
const config: RetryConfig = {
  maxRetries: 2,
  baseDelay: 10, // Short delay for testing
  maxDelay: 1000,
  backoffFactor: 2
};

try {
  await withRetry(
    async () => {
      attemptCount++;
      if (attemptCount < 3) {
        throw new Error("HTTP 429: Too Many Requests");
      }
      return "success";
    },
    "test_429_retry",
    config
  );
  
  if (attemptCount === 3) {
    console.log("✓ withRetry retries on 429 and eventually succeeds");
  } else {
    console.log(`FAIL: Expected 3 attempts, got ${attemptCount}`);
  }
} catch (e) {
  console.log("FAIL: withRetry should have succeeded after retries");
}

// Test 6: withRetry fails after maxRetries on non-retryable error
attemptCount = 0;
try {
  await withRetry(
    async () => {
      attemptCount++;
      throw new Error("HTTP 400: Bad Request");
    },
    "test_non_retryable",
    config
  );
  console.log("FAIL: withRetry should have thrown for non-retryable error");
} catch (e) {
  if (attemptCount === 1) {
    console.log("✓ withRetry fails immediately on non-retryable error");
  } else {
    console.log(`FAIL: Expected 1 attempt, got ${attemptCount}`);
  }
}

// Test 7: withRetry respects maxRetries limit
attemptCount = 0;
try {
  await withRetry(
    async () => {
      attemptCount++;
      throw new Error("HTTP 429: Too Many Requests");
    },
    "test_max_retries",
    config
  );
  console.log("FAIL: withRetry should have thrown after max retries");
} catch (e) {
  // maxRetries: 2 means 1 initial + 2 retries = 3 attempts total
  if (attemptCount === 3) {
    console.log("✓ withRetry respects maxRetries limit");
  } else {
    console.log(`FAIL: Expected 3 attempts, got ${attemptCount}`);
  }
}

console.log("Retry tests completed.");