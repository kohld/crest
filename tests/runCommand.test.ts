import { describe, it, expect } from "bun:test";
import { runCommand } from "../src/seedling";

describe("runCommand", () => {
  it("should not deadlock when stderr produces large output", async () => {
    // Generate a large amount of stderr (more than typical pipe buffer of 64KB)
    // This test ensures we read stdout and stderr concurrently
    const largeStderr = "x".repeat(100000); // 100KB of stderr
    const command = `echo "stdout output" && echo "${largeStderr}" >&2`;

    const result = await runCommand(command);

    expect(result).toContain("stdout output");
    expect(result).toContain("STDERR:");
    // The stderr content should be truncated in the output but present
    expect(result.length).toBeGreaterThan(100000);
  });

  it("should capture both stdout and stderr correctly", async () => {
    const command = `echo "hello stdout" && echo "hello stderr" >&2`;

    const result = await runCommand(command);

    expect(result).toContain("hello stdout");
    expect(result).toContain("STDERR: hello stderr");
  });

  it("should handle commands that only write to stdout", async () => {
    const command = `echo "only stdout"`;

    const result = await runCommand(command);

    expect(result).toBe("only stdout");
  });

  it("should handle commands that only write to stderr", async () => {
    const command = `echo "only stderr" >&2`;

    const result = await runCommand(command);

    expect(result).toBe("STDERR: only stderr");
  });

  it("should handle commands with no output", async () => {
    const command = `true`

    const result = await runCommand(command);

    expect(result).toBe("");
  });
});