// Test atomic file operations and concurrency safety

import { unlink } from "node:fs/promises";
import { readMemory, prependEntry, appendEntry, overwrite, memoryPath } from "../src/memory";

async function testAtomicWrite() {
  console.log("Testing atomic write operations...");

  const testFile = "TEST_MEMORY_CONCURRENCY.md";
  const path = memoryPath(testFile);

  // Clean up any existing test file
  try {
    await unlink(path);
  } catch (e) {
    // ignore
  }

  // Test 1: Basic overwrite
  await overwrite(testFile, "Initial content");
  const content1 = await readMemory(testFile);
  if (content1 !== "Initial content") {
    throw new Error(`Expected "Initial content", got "${content1}"`);
  }
  console.log("✓ Basic overwrite works");

  // Test 2: Append
  await appendEntry(testFile, "Second entry");
  const content2 = await readMemory(testFile);
  if (!content2.includes("Second entry") || !content2.includes("Initial content")) {
    throw new Error(`Append failed: ${content2}`);
  }
  console.log("✓ Append works");

  // Test 3: Prepend
  await prependEntry(testFile, "First entry");
  const content3 = await readMemory(testFile);
  if (!content3.startsWith("First entry") || !content3.includes("Second entry")) {
    throw new Error(`Prepend failed: ${content3}`);
  }
  console.log("✓ Prepend works");

  // Clean up
  await unlink(path);
  console.log("✓ Basic atomic operations passed");
}

async function testConcurrentWrites() {
  console.log("Testing concurrent writes...");

  const testFile = "TEST_CONCURRENT.md";
  const path = memoryPath(testFile);

  // Clean up
  try {
    await unlink(path);
  } catch (e) {
    // ignore
  }

  // Write initial content
  await overwrite(testFile, "");

  // Simulate concurrent writes
  const numWrites = 100;
  const promises: Promise<void>[] = [];

  for (let i = 0; i < numWrites; i++) {
    promises.push(appendEntry(testFile, `Entry ${i}`));
  }

  await Promise.all(promises);

  const finalContent = await readMemory(testFile);
  const entries = finalContent.split("\n\n---\n\n").filter(e => e.trim());

  if (entries.length !== numWrites) {
    throw new Error(`Expected ${numWrites} entries, got ${entries.length}. Some writes were lost!`);
  }

  // Verify all expected entries are present
  for (let i = 0; i < numWrites; i++) {
    if (!entries.includes(`Entry ${i}`)) {
      throw new Error(`Missing entry: Entry ${i}`);
    }
  }

  console.log(`✓ All ${numWrites} concurrent writes preserved`);

  // Clean up
  await unlink(path);
}

async function testInterleavedPrependAppend() {
  console.log("Testing interleaved prepend/append...");

  const testFile = "TEST_INTERLEAVED.md";
  const path = memoryPath(testFile);

  try {
    await unlink(path);
  } catch (e) {
    // ignore
  }

  await overwrite(testFile, "");

  const numOps = 50;
  const promises: Promise<void>[] = [];

  for (let i = 0; i < numOps; i++) {
    if (i % 2 === 0) {
      promises.push(appendEntry(testFile, `A${i}`));
    } else {
      promises.push(prependEntry(testFile, `B${i}`));
    }
  }

  await Promise.all(promises);

  const finalContent = await readMemory(testFile);
  const entries = finalContent.split("\n\n---\n\n").filter(e => e.trim());

  if (entries.length !== numOps) {
    throw new Error(`Expected ${numOps} entries, got ${entries.length}`);
  }

  // Verify all expected entries are present
  for (let i = 0; i < numOps; i++) {
    const expectedA = `A${i}`;
    const expectedB = `B${i}`;
    if (!entries.includes(expectedA) && !entries.includes(expectedB)) {
      throw new Error(`Missing entry for index ${i}`);
    }
  }

  console.log(`✓ All ${numOps} interleaved operations preserved`);

  await unlink(path);
}

async function testOverwriteConcurrency() {
  console.log("Testing concurrent overwrites...");

  const testFile = "TEST_OVERWRITE_CONCURRENT.md";
  const path = memoryPath(testFile);

  try {
    await unlink(path);
  } catch (e) {
    // ignore
  }

  const numWrites = 50;
  const promises: Promise<void>[] = [];

  for (let i = 0; i < numWrites; i++) {
    promises.push(overwrite(testFile, `Content ${i}`));
  }

  await Promise.all(promises);

  const finalContent = await readMemory(testFile);

  // The final content should be one of the written values (last write wins)
  const isValid = Array.from({ length: numWrites }, (_, i) => `Content ${i}`).includes(finalContent.trim());

  if (!isValid) {
    throw new Error(`Final content "${finalContent}" is not one of the expected values`);
  }

  console.log("✓ Concurrent overwrites completed without corruption");

  await unlink(path);
}

async function testLockFileCleanup() {
  console.log("Testing lock file cleanup...");

  const testFile = "TEST_LOCK_CLEANUP.md";
  const path = memoryPath(testFile);
  const lockPath = `${path}.lock`;

  try {
    await unlink(path);
    await unlink(lockPath);
  } catch (e) {
    // ignore
  }

  // Perform a write
  await prependEntry(testFile, "Test entry");

  // Lock file should be cleaned up
  const lockExists = await Bun.file(lockPath).exists();
  if (lockExists) {
    throw new Error("Lock file was not cleaned up after operation");
  }

  console.log("✓ Lock file cleanup works");

  await unlink(path);
}

async function runAllTests() {
  try {
    await testAtomicWrite();
    await testConcurrentWrites();
    await testInterleavedPrependAppend();
    await testOverwriteConcurrency();
    await testLockFileCleanup();

    console.log("✅ All concurrency safety tests passed!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.main) {
  await runAllTests();
}
