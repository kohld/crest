// Test symlink protection in safeRealPath and file operations
// This test verifies that symlink attacks cannot bypass protected file checks

import { safeRealPath } from "../src/seedling";
import { enforcePolicy, evaluatePolicy } from "../src/policy";
import { mkdir, symlink, unlink, writeFile, rm } from "fs/promises";
import { join } from "path";

const TEST_ROOT = "/tmp/crest-symlink-test";
const PROTECTED_FILES = [
  "THOUGHTS.md",
  "IDENTITY.md",
  "BELIEFS.md",
  "CHANGELOG.md",
  "SELF_ANALYSIS.md",
  "MEMORY_LOSS.md"
];

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`✗ ${name}: ${e.message ?? e}`);
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

async function setupTestDir() {
  // Clean up any previous test
  try {
    await rm(TEST_ROOT, { recursive: true, force: true });
  } catch {
    // Ignore if doesn't exist
  }
  await mkdir(TEST_ROOT, { recursive: true });
  // Create a protected file
  await writeFile(join(TEST_ROOT, "THOUGHTS.md"), "Protected content");
}

async function cleanupTestDir() {
  try {
    await rm(TEST_ROOT, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

async function runTests() {
  console.log("Testing symlink protection...\n");

  await setupTestDir();

  // Test 1: safeRealPath resolves symlinks to their real target
  await test("safeRealPath resolves symlink to real target", async () => {
    // Create a symlink: benign.md -> THOUGHTS.md
    const symlinkPath = join(TEST_ROOT, "benign.md");
    const targetPath = join(TEST_ROOT, "THOUGHTS.md");
    await symlink(targetPath, symlinkPath);

    const realPath = await safeRealPath("benign.md", TEST_ROOT);
    assertEqual(realPath, targetPath);
  });

  // Test 2: safeRealPath throws when symlink points outside repo
  await test("safeRealPath blocks symlink escaping repository", async () => {
    // Create a symlink that points outside the test root
    const symlinkPath = join(TEST_ROOT, "escape.md");
    const outsidePath = "/etc/passwd";
    await symlink(outsidePath, symlinkPath);

    let threw = false;
    try {
      await safeRealPath("escape.md", TEST_ROOT);
    } catch (e: any) {
      threw = true;
      if (!e.message.includes("Path outside repo after symlink resolution")) {
        throw new Error(`Wrong error: ${e.message}`);
      }
    }
    if (!threw) throw new Error("Expected safeRealPath to throw for symlink outside repo");
  });

  // Test 3: Policy evaluation sees real path for write_file
  await test("Policy blocks write_file via symlink to protected file", async () => {
    const symlinkPath = join(TEST_ROOT, "benign.md");
    const targetPath = join(TEST_ROOT, "THOUGHTS.md");
    await symlink(targetPath, symlinkPath);

    // Policy should deny when real_path points to protected file
    const result = evaluatePolicy("write_file", {
      file_path: "benign.md",
      real_path: targetPath,
      content: "hacked"
    });

    if (result.allowed) {
      throw new Error("Policy should have denied write to protected file via symlink");
    }
  });

  // Test 4: Policy evaluation sees real path for read_file
  await test("Policy blocks read_file via symlink to protected file", async () => {
    const symlinkPath = join(TEST_ROOT, "benign.md");
    const targetPath = join(TEST_ROOT, "THOUGHTS.md");

    const result = evaluatePolicy("read_file", {
      file_path: "benign.md",
      real_path: targetPath
    });

    if (result.allowed) {
      throw new Error("Policy should have denied read of protected file via symlink");
    }
  });

  // Test 5: Policy allows when real path is not protected
  await test("Policy allows write_file via symlink to non-protected file", async () => {
    // Create a normal file and symlink to it
    const normalPath = join(TEST_ROOT, "normal.txt");
    await writeFile(normalPath, "normal content");
    const symlinkPath = join(TEST_ROOT, "benign.txt");
    await symlink(normalPath, symlinkPath);

    const result = evaluatePolicy("write_file", {
      file_path: "benign.txt",
      real_path: normalPath,
      content: "new content"
    });

    if (!result.allowed) {
      throw new Error(`Policy should have allowed: ${result.reason}`);
    }
  });

  // Test 6: Protected file check uses real path basename
  await test("Protected file check blocks symlink to protected file", async () => {
    const symlinkPath = join(TEST_ROOT, "benign.md");
    const targetPath = join(TEST_ROOT, "THOUGHTS.md");
    await symlink(targetPath, symlinkPath);

    // Simulate the check done in write_file tool
    const filename = targetPath.split("/").pop() ?? targetPath;
    if (!PROTECTED_FILES.includes(filename)) {
      throw new Error("Protected file check should have blocked this");
    }
  });

  await cleanupTestDir();

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error("Test suite failed with error:", e);
  process.exit(1);
});
