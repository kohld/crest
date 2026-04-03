import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { readMemory, overwrite, prependEntry } from "./memory";
import { MODEL } from "./model";
import { logError, ErrorSeverity } from "./error-logger";
import { withRetry, RETRY_CONFIGS } from "./retry";

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

    const jsonMatch = trimmedText.match(/```json\n([\s\S]*?)\n```/) ?? trimmedText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      const errorMsg = "Belief update response format invalid — expected 'NO_UPDATE' or JSON. Skipping update.";
      console.warn(errorMsg);
      console.warn("Actual response:", JSON.stringify(trimmedText));
      await logError("belief_update_parsing", errorMsg, ErrorSeverity.WARNING);
      return;
    }

    const rawJson = jsonMatch[1] ?? jsonMatch[0];
    let result: { newBeliefs: string; changelogEntry: string };
    
    try {
      result = JSON.parse(rawJson);
    } catch (error) {
      const errorMsg = "Invalid JSON in belief update response — skipping update.";
      console.warn(errorMsg);
      console.warn("Parse error:", error instanceof Error ? error.message : String(error));
      console.warn("Raw JSON:", JSON.stringify(rawJson));
      await logError("belief_update_json_parse", error instanceof Error ? error : new Error("JSON parse error"), ErrorSeverity.WARNING);
      return;
    }

    // Validate required fields
    if (!result.newBeliefs || typeof result.newBeliefs !== 'string' || 
        !result.changelogEntry || typeof result.changelogEntry !== 'string') {
      const errorMsg = "Belief update response missing required fields — skipping update.";
      console.warn(errorMsg);
      console.warn("Expected fields: newBeliefs (string), changelogEntry (string)");
      console.warn("Actual result:", JSON.stringify(result, null, 2));
      await logError("belief_update_validation", errorMsg, ErrorSeverity.WARNING);
      return;
    }

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