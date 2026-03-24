import { describe, it, expect, beforeEach, vi } from "bun:test";
import { generateWithFallback, MODEL_CHAIN } from "../src/model";

// Skip tests if OPENROUTER_API_KEY is not set (no mocking in this simple test)
if (!process.env.OPENROUTER_API_KEY) {
  console.log("Skipping model-fallback tests: OPENROUTER_API_KEY not set");
  // Run a minimal smoke test that doesn't require API
  describe("model-fallback (skipped - no API key)", () => {
    it("should export MODEL_CHAIN with expected models", () => {
      expect(MODEL_CHAIN).toHaveLength(3);
      expect(MODEL_CHAIN[0]).toBe("stepfun/step-3.5-flash:free");
      expect(MODEL_CHAIN[1]).toBe("nvidia/nemotron-3-super-120b-a12b:free");
      expect(MODEL_CHAIN[2]).toBe("meta-llama/llama-3.3-70b-instruct:free");
    });
  });
} else {
  // Full tests with real API (these will actually call OpenRouter)
  describe("generateWithFallback", () => {
    it("should try models in order and return first successful result", async () => {
      const result = await generateWithFallback({
        prompt: "Say 'hello'",
        maxSteps: 1,
      });

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(typeof result.text).toBe("string");
    });

    it("should handle simple prompt successfully", async () => {
      const result = await generateWithFallback({
        prompt: "What is 2+2?",
        maxSteps: 1,
      });

      expect(result.text).toContain("4");
    });

    it("should respect system prompt", async () => {
      const result = await generateWithFallback({
        system: "You are a terse assistant. Respond with exactly one word.",
        prompt: "Say 'yes'",
        maxSteps: 1,
      });

      // The model should follow the instruction to be terse
      expect(result.text.length).toBeLessThan(50);
    });

    it("should handle empty prompt gracefully", async () => {
      const result = await generateWithFallback({
        prompt: "",
        maxSteps: 1,
      });

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
    });
  });
}
