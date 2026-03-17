// Test safePath function for path traversal vulnerabilities

import { safePath } from "../src/seedling";

// Set test ROOT
const TEST_ROOT = "/home/user/repo";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`✗ ${name}: ${e}`);
    failed++;
  }
}

function assertEqual(actual: string, expected: string) {
  if (actual !== expected) {
    throw new Error(`Expected "${expected}", got "${actual}"`);
  }
}

function assertThrows(fn: () => void) {
  try {
    fn();
    throw new Error("Expected function to throw");
  } catch (e) {
    if (e.message === "Expected function to throw") {
      throw e;
    }
    // Expected - do nothing
  }
}

console.log("Testing safePath function...");

test("allows paths inside the repository", () => {
  assertEqual(safePath("src/seedling.ts", TEST_ROOT), "/home/user/repo/src/seedling.ts");
  assertEqual(safePath("README.md", TEST_ROOT), "/home/user/repo/README.md");
  assertEqual(safePath("./src/seedling.ts", TEST_ROOT), "/home/user/repo/src/seedling.ts");
  assertEqual(safePath("subdir/file.txt", TEST_ROOT), "/home/user/repo/subdir/file.txt");
});

test("rejects paths outside the repository", () => {
  assertThrows(() => safePath("../outside.txt", TEST_ROOT));
  assertThrows(() => safePath("../../etc/passwd", TEST_ROOT));
  assertThrows(() => safePath("/absolute/path/outside", TEST_ROOT));
});

test("prevents path traversal via similar prefix (vulnerability test)", () => {
  // This is the vulnerability: using .. to escape the repo and then
  // accessing a sibling directory with a similar prefix
  // Example: ROOT = "/home/user/repo", path = "../../repo2/file"
  // After resolution: "/home/user/repo/../../repo2/file" -> "/home/user/repo2/file"
  // This starts with "/home/user/repo" but is outside the repo
  assertThrows(() => safePath("../../repo2/file", TEST_ROOT));
  assertThrows(() => safePath("../../../repo2/file", TEST_ROOT));
});

test("handles root directory itself", () => {
  assertEqual(safePath("", TEST_ROOT), "/home/user/repo");
  assertEqual(safePath(".", TEST_ROOT), "/home/user/repo");
});

test("normalizes paths with .. and . correctly", () => {
  assertEqual(safePath("src/../README.md", TEST_ROOT), "/home/user/repo/README.md");
  assertEqual(safePath("./src/./seedling.ts", TEST_ROOT), "/home/user/repo/src/seedling.ts");
});

test("rejects paths that escape after normalization", () => {
  assertThrows(() => safePath("src/../../outside", TEST_ROOT));
  assertThrows(() => safePath("subdir/../../../etc/passwd", TEST_ROOT));
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
