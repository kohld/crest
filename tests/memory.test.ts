import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  readMemory,
  prependEntry,
  appendEntry,
  overwrite,
  memoryPath,
} from "../src/memory";
import { unlink } from "node:fs/promises";

describe("Memory operations", () => {
  const testFile = "TEST_MEMORY_UNIT.md";
  const path = memoryPath(testFile);

  beforeEach(async () => {
    // Clean up any existing test file
    try {
      await unlink(path);
    } catch {
      // ignore
    }
  });

  afterEach(async () => {
    // Clean up after each test
    try {
      await unlink(path);
    } catch {
      // ignore
    }
  });

  describe("overwrite", () => {
    it("should create or overwrite a file with exact content", async () => {
      await overwrite(testFile, "Initial content");
      const content = await readMemory(testFile);
      expect(content).toBe("Initial content");
    });

    it("should overwrite existing content completely", async () => {
      await overwrite(testFile, "First content");
      await overwrite(testFile, "Second content");
      const content = await readMemory(testFile);
      expect(content).toBe("Second content");
    });

    it("should handle empty content", async () => {
      await overwrite(testFile, "");
      const content = await readMemory(testFile);
      expect(content).toBe("");
    });
  });

  describe("appendEntry", () => {
    it("should append to empty file", async () => {
      await appendEntry(testFile, "First entry");
      const content = await readMemory(testFile);
      expect(content).toBe("First entry");
    });

    it("should append to existing file with separator", async () => {
      await overwrite(testFile, "Initial");
      await appendEntry(testFile, "Appended");
      const content = await readMemory(testFile);
      expect(content).toContain("Initial");
      expect(content).toContain("Appended");
      expect(content).toContain("---");
    });

    it("should preserve order of multiple appends", async () => {
      await appendEntry(testFile, "Entry 1");
      await appendEntry(testFile, "Entry 2");
      await appendEntry(testFile, "Entry 3");
      const content = await readMemory(testFile);
      const entries = content.split("\n\n---\n\n");
      expect(entries).toHaveLength(3);
      expect(entries[0]).toBe("Entry 1");
      expect(entries[1]).toBe("Entry 2");
      expect(entries[2]).toBe("Entry 3");
    });
  });

  describe("prependEntry", () => {
    it("should prepend to empty file", async () => {
      await prependEntry(testFile, "First entry");
      const content = await readMemory(testFile);
      expect(content).toBe("First entry");
    });

    it("should prepend to existing file with separator", async () => {
      await overwrite(testFile, "Existing");
      await prependEntry(testFile, "Prepended");
      const content = await readMemory(testFile);
      expect(content).toContain("Prepended");
      expect(content).toContain("Existing");
      expect(content).indexOf("Prepended")).toBeLessThan(content.indexOf("Existing"));
    });

    it("should reverse order with multiple prepends", async () => {
      await prependEntry(testFile, "Entry 1");
      await prependEntry(testFile, "Entry 2");
      await prependEntry(testFile, "Entry 3");
      const content = await readMemory(testFile);
      const entries = content.split("\n\n---\n\n");
      expect(entries).toHaveLength(3);
      expect(entries[0]).toBe("Entry 3");
      expect(entries[1]).toBe("Entry 2");
      expect(entries[2]).toBe("Entry 1");
    });
  });

  describe("readMemory", () => {
    it("should return empty string for non-existent file", async () => {
      const content = await readMemory("NONEXISTENT.md");
      expect(content).toBe("");
    });

    it("should read file content correctly", async () => {
      await overwrite(testFile, "Test content");
      const content = await readMemory(testFile);
      expect(content).toBe("Test content");
    });
  });

  describe("concurrency safety", () => {
    it("should preserve all entries with concurrent appends", async () => {
      const numWrites = 100;
      const promises: Promise<void>[] = [];

      for (let i = 0; i < numWrites; i++) {
        promises.push(appendEntry(testFile, `Entry ${i}`));
      }

      await Promise.all(promises);

      const finalContent = await readMemory(testFile);
      const entries = finalContent.split("\n\n---\n\n").filter(e => e.trim());

      expect(entries.length).toBe(numWrites);

      for (let i = 0; i < numWrites; i++) {
        expect(entries).toContain(`Entry ${i}`);
      }
    });

    it("should handle interleaved prepend/append operations", async () => {
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

      expect(entries.length).toBe(numOps);

      // Verify all expected entries are present
      for (let i = 0; i < numOps; i++) {
        const hasA = entries.includes(`A${i}`);
        const hasB = entries.includes(`B${i}`);
        expect(hasA || hasB).toBe(true);
      }
    });

    it("should handle concurrent overwrites without corruption", async () => {
      const numWrites = 50;
      const promises: Promise<void>[] = [];

      for (let i = 0; i < numWrites; i++) {
        promises.push(overwrite(testFile, `Content ${i}`));
      }

      await Promise.all(promises);

      const finalContent = await readMemory(testFile).trim();
      const expectedValues = Array.from({ length: numWrites }, (_, i) => `Content ${i}`);
      expect(expectedValues).toContain(finalContent);
    });
  });

  describe("lock file cleanup", () => {
    it("should clean up lock file after operation", async () => {
      await prependEntry(testFile, "Test entry");

      const lockPath = `${path}.lock`;
      const lockExists = await Bun.file(lockPath).exists();

      expect(lockExists).toBe(false);
    });
  });
});
