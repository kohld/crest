// Test the new belief parsing logic

function testParseBeliefResponse(text: string): { success: boolean; reason?: string } {
  const trimmedText = text.trim();

  // Check for NO_UPDATE response
  if (trimmedText === "NO_UPDATE") {
    return { success: true, reason: "NO_UPDATE recognized" };
  }

  // Strict parsing: only accept JSON wrapped in triple backticks with 'json' language identifier
  const jsonFencePattern = /^```json\n([\s\S]*?)\n```$/;
  const jsonMatch = trimmedText.match(jsonFencePattern);

  if (!jsonMatch) {
    return { success: false, reason: "Invalid format - expected 'NO_UPDATE' or JSON in ```json fences" };
  }

  const rawJson = jsonMatch[1];
  try {
    const result = JSON.parse(rawJson);
    if (!result.newBeliefs || typeof result.newBeliefs !== 'string' || 
        !result.changelogEntry || typeof result.changelogEntry !== 'string') {
      return { success: false, reason: "Missing required fields: newBeliefs and changelogEntry (both strings)" };
    }
    return { success: true, reason: "Valid JSON with required fields" };
  } catch (error) {
    return { success: false, reason: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
}

// Test cases
const testCases = [
  // Valid cases
  { input: "NO_UPDATE", expected: true },
  { input: "```json\n{\"newBeliefs\": \"test\", \"changelogEntry\": \"## 2024-01-01 — test\\n\\nTest change\"}\n```", expected: true },
  { input: "  NO_UPDATE  ", expected: true }, // whitespace should be trimmed
  { input: "```json\n{\"newBeliefs\": \"test\", \"changelogEntry\": \"test\"}\n```", expected: true }, // valid simple case
  
  // Invalid cases
  { input: "Some text before NO_UPDATE", expected: false },
  { input: "NO_UPDATE with extra text", expected: false },
  { input: "```json\n{\"newBeliefs\": \"test\"}\n```", expected: false }, // missing changelogEntry
  { input: "```json\n{\"changelogEntry\": \"test\"}\n```", expected: false }, // missing newBeliefs
  { input: "```json\n{\"newBeliefs\": 123, \"changelogEntry\": \"test\"}\n```", expected: false }, // wrong type
  { input: "```json\n{ invalid json }\n```", expected: false },
  { input: "```json\n{\"newBeliefs\": \"test\", \"changelogEntry\": \"test\"}", expected: false }, // missing closing fence
  { input: "Some random text without proper format", expected: false },
  { input: "```json\n{\"newBeliefs\": \"test\", \"changelogEntry\": \"test\"}\n```", expected: true },
  { input: "```json\n{\"newBeliefs\": \"test\", \"changelogEntry\": \"test\"}\n```", expected: true },
];

console.log("Testing belief parsing logic:");
let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  const result = testParseBeliefResponse(testCase.input);
  const success = result.success === testCase.expected;
  
  if (success) {
    passed++;
    console.log(`✓ PASS: ${testCase.input.substring(0, 50)}${testCase.input.length > 50 ? '...' : ''}`);
  } else {
    failed++;
    console.log(`✗ FAIL: ${testCase.input.substring(0, 50)}${testCase.input.length > 50 ? '...' : ''}`);
    console.log(`  Expected: ${testCase.expected}, Got: ${result.success}`);
    console.log(`  Reason: ${result.reason}`);
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);