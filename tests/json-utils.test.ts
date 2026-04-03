// Test robust JSON parsing utilities

import { extractJson, validateSchema } from "../src/json-utils";

function testExtractJson<T>(input: string, expectedSuccess: boolean, expectedData?: T, description?: string): void {
  const result = extractJson<T>(input);
  const success = result.success === expectedSuccess;
  
  if (success && expectedSuccess && expectedData) {
    // Deep comparison for objects
    if (JSON.stringify(result.data) !== JSON.stringify(expectedData)) {
      console.log(`✗ FAIL: ${description || input.substring(0, 60)}${input.length > 60 ? '...' : ''}`);
      console.log(`  Expected: ${JSON.stringify(expectedData)}`);
      console.log(`  Got: ${JSON.stringify(result.data)}`);
      return;
    }
  }
  
  if (success) {
    console.log(`✓ PASS: ${description || input.substring(0, 60)}${input.length > 60 ? '...' : ''}`);
  } else {
    console.log(`✗ FAIL: ${description || input.substring(0, 60)}${input.length > 60 ? '...' : ''}`);
    console.log(`  Expected success: ${expectedSuccess}, Got: ${result.success}`);
    console.log(`  Error: ${result.error}`);
  }
}

console.log("Testing extractJson with various formats:");

// Test cases for beliefs schema
interface BeliefsResult {
  newBeliefs: string;
  changelogEntry: string;
}

// Valid cases - different fence styles
testExtractJson<BeliefsResult>(
  "```json\n{\"newBeliefs\": \"test\", \"changelogEntry\": \"## 2024-01-01 — test\\n\\nTest change\"}\n```",
  true,
  { newBeliefs: "test", changelogEntry: "## 2024-01-01 — test\n\nTest change" },
  "json fence"
);

testExtractJson<BeliefsResult>(
  "```JSON\n{\"newBeliefs\": \"test\", \"changelogEntry\": \"test\"}\n```",
  true,
  { newBeliefs: "test", changelogEntry: "test" },
  "JSON fence (uppercase)"
);

testExtractJson<BeliefsResult>(
  "```js\n{\"newBeliefs\": \"test\", \"changelogEntry\": \"test\"}\n```",
  true,
  { newBeliefs: "test", changelogEntry: "test" },
  "js fence"
);

testExtractJson<BeliefsResult>(
  "```\n{\"newBeliefs\": \"test\", \"changelogEntry\": \"test\"}\n```",
  true,
  { newBeliefs: "test", changelogEntry: "test" },
  "no language fence"
);

// Valid case - no fences, just JSON (bracket matching)
testExtractJson<BeliefsResult>(
  "{\"newBeliefs\": \"test\", \"changelogEntry\": \"test\"}",
  true,
  { newBeliefs: "test", changelogEntry: "test" },
  "bare JSON"
);

// Valid case - leading/trailing whitespace
testExtractJson<BeliefsResult>(
  "  \n```json\n{\"newBeliefs\": \"test\", \"changelogEntry\": \"test\"}\n```\n  ",
  true,
  { newBeliefs: "test", changelogEntry: "test" },
  "whitespace around fence"
);

// Valid case - JSON with nested structures
testExtractJson<BeliefsResult>(
  "```json\n{\"newBeliefs\": \"test with \\\"quotes\\\"\", \"changelogEntry\": \"## test\\n\\nDetails\"}\n```",
  true,
  { newBeliefs: "test with \"quotes\"", changelogEntry: "## test\n\nDetails" },
  "quotes in JSON"
);

// Invalid cases - these should fail extraction
testExtractJson<BeliefsResult>(
  "NO_UPDATE",
  false,
  undefined,
  "NO_UPDATE string"
);

testExtractJson<BeliefsResult>(
  "Some text before ```json\n{\"newBeliefs\": \"test\", \"changelogEntry\": \"test\"}\n```",
  false,
  undefined,
  "text before fence (fence not at start)"
);

testExtractJson<BeliefsResult>(
  "```json\n{ invalid json }\n```",
  false,
  undefined,
  "invalid JSON syntax"
);

testExtractJson<BeliefsResult>(
  "```json\n{\"newBeliefs\": \"test\", \"changelogEntry\": \"test\"}", // missing closing fence
  false,
  undefined,
  "incomplete fence"
);

// These will succeed in extraction but fail in validation - test separately
console.log("\nTesting extraction + validation flow:");

function testExtractAndValidate<T>(input: string, expectedSuccess: boolean, description: string): void {
  const extractResult = extractJson<T>(input);
  if (!extractResult.success) {
    if (expectedSuccess) {
      console.log(`✗ FAIL: ${description} - extraction failed: ${extractResult.error}`);
    } else {
      console.log(`✓ PASS: ${description} - extraction failed as expected`);
    }
    return;
  }
  
  // For BeliefsResult, validate required fields
  if (input.includes('newBeliefs') && input.includes('changelogEntry')) {
    const validationResult = validateSchema<BeliefsResult>(extractResult.data!, {
      requiredFields: [
        { name: "newBeliefs", type: "string" },
        { name: "changelogEntry", type: "string" }
      ]
    });
    
    if (validationResult.success === expectedSuccess) {
      console.log(`✓ PASS: ${description} - extraction + validation ${expectedSuccess ? 'succeeded' : 'failed'}`);
    } else {
      console.log(`✗ FAIL: ${description} - expected ${expectedSuccess}, got success=${validationResult.success}, error=${validationResult.error}`);
    }
  } else {
    // For other test cases, just report extraction success
    if (expectedSuccess) {
      console.log(`✓ PASS: ${description} - extraction succeeded`);
    } else {
      console.log(`✗ FAIL: ${description} - extraction succeeded but expected failure`);
    }
  }
}

// Test missing required fields - extraction succeeds but validation fails
testExtractAndValidate<BeliefsResult>(
  "```json\n{\"newBeliefs\": \"test\"}\n```", // missing changelogEntry
  false,
  "missing changelogEntry"
);

testExtractAndValidate<BeliefsResult>(
  "```json\n{\"changelogEntry\": \"test\"}\n```", // missing newBeliefs
  false,
  "missing newBeliefs"
);

// Test valid complete JSON
testExtractAndValidate<BeliefsResult>(
  "```json\n{\"newBeliefs\": \"test\", \"changelogEntry\": \"test\"}\n```",
  true,
  "complete valid JSON"
);

// Test with array (should work for bracket matching)
testExtractJson<{ items: string[] }>(
  "Some text before [{\"items\": [\"a\", \"b\"]}] after",
  true,
  { items: ["a", "b"] },
  "array with surrounding text"
);

// Test with nested objects and arrays
testExtractJson<{ nested: { arr: number[] } }>(
  "```json\n{\"nested\": {\"arr\": [1, 2, 3]}}\n```",
  true,
  { nested: { arr: [1, 2, 3] } },
  "nested structures"
);

// Test bracket matching with strings containing braces
testExtractJson<{ text: string }>(
  "prefix {\"text\": \"value with { and } inside\"} suffix",
  true,
  { text: "value with { and } inside" },
  "braces inside string"
);

// Test with multiple JSON objects - should get first one
testExtractJson<{ a: string }>(
  "{\"a\": \"first\"} and {\"b\": \"second\"}",
  true,
  { a: "first" },
  "multiple JSON objects"
);

console.log("\nTesting validateSchema:");

// Test validation
const validData = { newBeliefs: "test", changelogEntry: "test" };
const validated = validateSchema<BeliefsResult>(validData, {
  requiredFields: [
    { name: "newBeliefs", type: "string" },
    { name: "changelogEntry", type: "string" }
  ]
});

if (validated.success && validated.data) {
  console.log("✓ PASS: validateSchema with valid data");
} else {
  console.log("✗ FAIL: validateSchema with valid data");
}

const invalidData = { newBeliefs: 123, changelogEntry: "test" };
const invalidValidated = validateSchema<BeliefsResult>(invalidData, {
  requiredFields: [
    { name: "newBeliefs", type: "string" },
    { name: "changelogEntry", type: "string" }
  ]
});

if (!invalidValidated.success) {
  console.log("✓ PASS: validateSchema rejects invalid type");
} else {
  console.log("✗ FAIL: validateSchema should reject invalid type");
}

const missingFieldData = { newBeliefs: "test" };
const missingValidated = validateSchema<BeliefsResult>(missingFieldData, {
  requiredFields: [
    { name: "newBeliefs", type: "string" },
    { name: "changelogEntry", type: "string" }
  ]
});

if (!missingValidated.success && missingValidated.error?.includes("changelogEntry")) {
  console.log("✓ PASS: validateSchema detects missing field");
} else {
  console.log("✗ FAIL: validateSchema should detect missing field");
}