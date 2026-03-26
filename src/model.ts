// Model fallback chain — tried in order until one succeeds
// Free models that support the required capabilities

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import type { Parameters as GenerateTextParameters } from "ai";
import { MODEL_CHAIN } from "./config";


// Re-export primary model for config consumers
export { MODEL_CHAIN as MODELS };
export const MODEL = MODEL_CHAIN[0];

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

type GenerateTextArgs = Omit<Parameters<typeof generateText>[0], "model">;

/**
 * Try each model in MODEL_CHAIN until one succeeds.
 * Skips to next model on 429 (rate limit) or 400 (invalid model).
 * Throws after all models are exhausted.
 */
export async function generateWithFallback(args: GenerateTextArgs): ReturnType<typeof generateText> {
  let lastError: unknown;

  for (const modelId of MODEL_CHAIN) {
    try {
      console.log(`Using model: ${modelId}`);
      return await generateText({ ...args, model: openrouter(modelId) });
    } catch (e: any) {
      const status = e?.statusCode ?? e?.cause?.statusCode;
      const isTransient = status === 429 || status === 400 || status === 503;

      if (isTransient) {
        console.warn(`Model ${modelId} unavailable (${status}) — trying next.`);
        lastError = e;
        continue;
      }

      // Non-transient error — don't try fallback models
      throw e;
    }
  }

  throw new Error(
    `All models exhausted. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}
