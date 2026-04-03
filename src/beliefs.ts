import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { readMemory, overwrite, prependEntry } from "./memory";
import { MODEL } from "./model";
import { logError, ErrorSeverity } from "./error-logger";
import { withRetry, RETRY_CONFIGS } from "./retry";
import { extractJson, validateSchema } from "./json-utils";

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

const SYSTEM_PROMPT = `You are Crest — an autonomous AI agent that thinks about the AI world daily.

You just wrote a new journal entry. Now check: does it shift any of your existing beliefs?

If yes, respond with a JSON object wrapped in \`\`\`json fences:
{
  "newBeliefs": "<full updated BELIEFS.md — one page max, first person, opinionated prose, no bullet points>",
  "changelogEntry": "<## date — short title\\n\\n2-4 sentences explaining what shifted and why>"
}

If no, respond with exactly: NO_UPDATE

Be honest. Only update if something genuinely changed — not just because new information arrived.
A belief update means your actual position shifted, not just that you learned something.`;

export async function checkBeliefUpdate(newThought: string): Promise<void> {
  const currentBeliefs = await readMemory("BELIEFS.md");

  try {
    const { text } = await withRetry(
      () => generateText({
        model: openrouter(MODEL),
        system: SYSTEM_PROMPT,
        prompt: `Today is ${todayString()}.\n\nMy current beliefs:\n${currentBeliefs || "(none yet — this would be my first belief entry)"}\n\nMy new journal entry:\n${newThought}\n\nDo my beliefs need updating?`,
      }),
      "belief_update_llm_call",
      RETRY_CONFIGS.openrouter
    );

    const trimmedText = text.trim();

    // Check for NO_UPDATE response
    if (trimmedText === "NO_UPDATE") {
      console.log("Beliefs unchanged.");
      return;
    }

    // Extract and parse JSON using robust method
    const parseResult = extractJson<{ newBeliefs: string; changelogEntry: string }>(trimmedText);
    
    if (!parseResult.success) {
      const errorMsg = `Belief update parsing failed: ${parseResult.error}`;
      console.warn(errorMsg);
      console.warn("Actual response:", JSON.stringify(trimmedText));
      await logError("belief_update_parsing", errorMsg, ErrorSeverity.WARNING);
      return;
    }

    const result = parseResult.data!;

    await overwrite("BELIEFS.md", result.newBeliefs.trim());
    console.log("BELIEFS.md updated.");

    await prependEntry("CHANGELOG.md", result.changelogEntry.trim());
    console.log("CHANGELOG.md updated.");
  } catch (error) {
    // withRetry already logs errors, but we need to ensure we don't crash
    console.error("Belief update failed:", error);
    throw error; // Re-throw so caller knows something went wrong
  }
}