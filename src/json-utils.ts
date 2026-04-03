/**
 * Robust JSON parsing utilities for LLM responses.
 * Handles various formatting variations and provides clear error messages.
 */

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Extract JSON from text that may contain code fences or other content.
 * Tries multiple strategies in order:
 * 1. Extract from code fences (any language or no language) - must be the only content
 * 2. Parse entire string as JSON directly
 * 3. Find first valid JSON object/array using bracket matching
 */
export function extractJson<T>(text: string): ParseResult<T> {
  const trimmed = text.trim();

  // Strategy 1: Extract from code fences (must be the only content after trimming)
  const fencePattern = /^```(?:json|JSON|js|JS)?\n([\s\S]*?)\n```$/;
  const fenceMatch = trimmed.match(fencePattern);
  if (fenceMatch) {
    const jsonStr = fenceMatch[1].trim();
    return parseJsonString<T>(jsonStr, "code fence extraction");
  }

  // Strategy 2: Try parsing entire string as JSON directly
  try {
    const parsed = JSON.parse(trimmed) as T;
    return { success: true, data: parsed };
  } catch {
    // Not valid JSON as a whole, continue to bracket matching
  }

  // Strategy 3: Find first JSON object or array using bracket matching
  const bracketMatch = findJsonByBrackets(trimmed);
  if (bracketMatch) {
    return parseJsonString<T>(bracketMatch, "bracket matching");
  }

  return {
    success: false,
    error: "No valid JSON found in response. Expected code fences (```json) or a JSON object/array."
  };
}

/**
 * Find the first valid JSON object or array in text using proper bracket matching.
 * Returns the matched JSON string or null if none found.
 */
function findJsonByBrackets(text: string): string | null {
  let inString = false;
  let escapeNext = false;
  let startIndex = -1;
  
  // Find first opening brace or bracket that's not inside a string
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (inString) {
      if (escapeNext) {
        escapeNext = false;
      } else if (char === '\\') {
        escapeNext = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    
    if (char === '"') {
      inString = true;
      continue;
    }
    
    if (char === '{' || char === '[') {
      startIndex = i;
      break;
    }
  }
  
  if (startIndex === -1) return null;
  
  const startChar = text[startIndex];
  const endChar = startChar === '{' ? '}' : ']';
  const stack: string[] = [startChar];
  inString = false;
  escapeNext = false;
  
  for (let i = startIndex + 1; i < text.length; i++) {
    const char = text[i];
    
    if (inString) {
      if (escapeNext) {
        escapeNext = false;
      } else if (char === '\\') {
        escapeNext = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    
    if (char === '"') {
      inString = true;
      continue;
    }
    
    if (char === startChar) {
      stack.push(char);
    } else if (char === endChar) {
      if (stack.length === 0) return null; // Unbalanced
      stack.pop();
      if (stack.length === 0) {
        return text.substring(startIndex, i + 1);
      }
    }
  }
  
  return null;
}

/**
 * Parse a JSON string with validation and clear error messages.
 */
function parseJsonString<T>(jsonStr: string, source: string): ParseResult<T> {
  try {
    const parsed = JSON.parse(jsonStr) as T;
    return { success: true, data: parsed };
  } catch (error) {
    return {
      success: false,
      error: `Invalid JSON from ${source}: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Validate that parsed data has required fields of correct types.
 */
export function validateSchema<T>(
  data: unknown,
  schema: {
    requiredFields: Array<{ name: keyof T; type: string }>;
  }
): ParseResult<T> {
  if (typeof data !== 'object' || data === null) {
    return { success: false, error: "Expected an object" };
  }

  const obj = data as Record<string, unknown>;

  for (const field of schema.requiredFields) {
    if (!(field.name in obj)) {
      return { success: false, error: `Missing required field: ${String(field.name)}` };
    }
    if (typeof obj[field.name] !== field.type) {
      return { success: false, error: `Field ${String(field.name)} must be ${field.type}, got ${typeof obj[field.name]}` };
    }
  }

  return { success: true, data: data as T };
}