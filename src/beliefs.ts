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

  if (text.trim().startsWith("NO_UPDATE")) {
    console.log("Beliefs unchanged.");
    return;
  }

  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) ?? text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.warn("Could not parse belief update response — skipping.");
    return;
  }

  const raw = jsonMatch[1] ?? jsonMatch[0];
  let result: { newBeliefs: string; changelogEntry: string };
  try {
    result = JSON.parse(raw);
  } catch {
    console.warn("Invalid JSON in belief update — skipping.");
    return;
  }

  await overwrite("BELIEFS.md", result.newBeliefs.trim());
  console.log("BELIEFS.md updated.");

  await prependEntry("CHANGELOG.md", result.changelogEntry.trim());
  console.log("CHANGELOG.md updated.");
}
