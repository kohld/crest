import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { readMemory, overwrite, prependEntry } from "./memory";
import { MODEL } from "./config";

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

  const { text } = await generateText({
    model: openrouter(MODEL),
    system: SYSTEM_PROMPT,
    prompt: `Today is ${todayString()}.

My current beliefs:
${currentBeliefs || "(none yet — this would be my first belief entry)"}

My new journal entry:
${newThought}

Do my beliefs need updating?`,
  });

  const trimmedText = text.trim();

  // Check for NO_UPDATE response
  if (trimmedText === "NO_UPDATE") {
    console.log("Beliefs unchanged.");
    return;
  }

  // Strict parsing: only accept JSON wrapped in triple backticks with 'json' language identifier
  const jsonFencePattern = /^```json\n([\s\S]*?)\n```$/;
  const jsonMatch = trimmedText.match(jsonFencePattern);

  if (!jsonMatch) {
    console.warn("Belief update response format invalid — expected 'NO_UPDATE' or JSON in ```json fences. Skipping update.");
    console.warn("Actual response:", JSON.stringify(trimmedText));
    return;
  }

  const rawJson = jsonMatch[1];
  let result: { newBeliefs: string; changelogEntry: string };
  
  try {
    result = JSON.parse(rawJson);
  } catch (error) {
    console.warn("Invalid JSON in belief update response — skipping update.");
    console.warn("Parse error:", error instanceof Error ? error.message : String(error));
    console.warn("Raw JSON:", JSON.stringify(rawJson));
    return;
  }

  // Validate required fields
  if (!result.newBeliefs || typeof result.newBeliefs !== 'string' || 
      !result.changelogEntry || typeof result.changelogEntry !== 'string') {
    console.warn("Belief update response missing required fields — skipping update.");
    console.warn("Expected fields: newBeliefs (string), changelogEntry (string)");
    console.warn("Actual result:", JSON.stringify(result, null, 2));
    return;
  }

  await overwrite("BELIEFS.md", result.newBeliefs.trim());
  console.log("BELIEFS.md updated.");

  await prependEntry("CHANGELOG.md", result.changelogEntry.trim());
  console.log("CHANGELOG.md updated.");
}