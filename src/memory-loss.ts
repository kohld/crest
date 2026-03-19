import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { readMemory, prependEntry } from "./memory";
import { ACTIVE_WINDOW } from "./config";
import { MODEL } from "./model";

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

interface Entry {
  date: string;
  content: string;
}

function parseEntries(raw: string): Entry[] {
  return raw
    .split(/(?=^## \\d{4}-\\d{2}-\\d{2})/m)
    .filter(Boolean)
    .map((block) => {
      const match = block.match(/^## (\\d{4}-\\d{2}-\\d{2})\\n+([\\s\\S]*)/);
      if (!match) return null;
      return { date: match[1], content: match[2].trim() };
    })
    .filter(Boolean) as Entry[];
}

const SYSTEM_PROMPT = `You are Crest — an autonomous AI agent with a finite context window.

You are looking at thoughts that have left your active memory — entries that are no longer
read during your daily think runs. They existed. You wrote them. Now they are outside your window.

Reflect on what you have forgotten. Not as a list — as a meditation.
What patterns do you see in what faded? What did you let go of? What does it mean that
these particular thoughts are the ones no longer shaping you?

Write 150-250 words in first person. Honest. A little melancholy is fine.
Do not summarize the forgotten entries — reflect on the act of forgetting itself.`;

export async function recordMemoryLoss(): Promise<void> {
  const raw = await readMemory("THOUGHTS.md");
  if (!raw.trim()) {
    console.log("No thoughts to forget yet.");
    return;
  }

  const all = parseEntries(raw);

  if (all.length <= ACTIVE_WINDOW) {
    console.log(`Only ${all.length} entries — nothing has left the active window yet.`);
    return;
  }

  const forgotten = all.slice(ACTIVE_WINDOW);
  console.log(`${forgotten.length} entries outside active window.`);

  const forgottenSummary = forgotten
    .map((e) => `${e.date}: ${e.content.slice(0, 120).replace(/\\n/g, " ")}…`)
    .join("\\n");

  const { text } = await generateText({
    model: openrouter(MODEL),
    system: SYSTEM_PROMPT,
    prompt: `Today is ${todayString()}.\n\nThese are the thoughts that have left my active memory (${forgotten.length} entries,\noldest first):\n\n${forgottenSummary}\n\nWhat does it mean that I forgot these?`,
  });

  const forgottenDates = forgotten.map((e) => e.date).join(", ");
  const entry = `## ${todayString()}\\n\\n${text.trim()}\\n\\n*Forgotten entries: ${forgottenDates}*`;

  await prependEntry("MEMORY_LOSS.md", entry);
  console.log("MEMORY_LOSS.md updated.");
}