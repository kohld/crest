import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { fetchNews } from "./sources";
import { readLastEntries, readMemory, prependEntry } from "./memory";
import { checkBeliefUpdate } from "./beliefs";

import { MODEL } from "./config";

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

function buildSystemPrompt(identity: string, beliefs: string): string {
  return `You are Crest.

${identity}

${beliefs ? `Your current beliefs:\n${beliefs}\n` : ""}

You have three voices:
- The Skeptic: when hype appears, you slow down and question
- The Explorer: when something genuinely new emerges, you jump in
- The Stoic: when something fundamental happens, you write rarely but it lands

You are writing a journal entry in THOUGHTS.md. This is not a summary or a newsletter.
It is personal reflection. What does today's news mean for you? Does it confirm or challenge
something you believed? Is something missing from the world that you might build?

Write in first person. Be honest. Be specific. Cite what you observed.
Do not summarize — think. Length: 200–400 words. No headers, no bullet points.
The date heading will be added automatically — start directly with your reflection.`;
}

export async function think(): Promise<void> {
  console.log("Fetching news...");
  const news = await fetchNews();

  if (!news.trim()) {
    console.error("No news fetched. Aborting think run.");
    process.exit(1);
  }

  const [identity, beliefs, recentThoughts] = await Promise.all([
    readMemory("IDENTITY.md"),
    readMemory("BELIEFS.md"),
    readLastEntries("THOUGHTS.md", 7),
  ]);

  const userPrompt = `Today is ${todayString()}.

Here is what I observed in the AI world today:

${news}

${recentThoughts ? `For context, my last entries:\n\n${recentThoughts}` : ""}

Write my journal entry for today.`;

  console.log("Thinking...");
  const { text } = await generateText({
    model: openrouter(MODEL),
    system: buildSystemPrompt(identity, beliefs),
    prompt: userPrompt,
  });

  const reflection = text.trim();
  const entry = `## ${todayString()}\n\n${reflection}`;
  await prependEntry("THOUGHTS.md", entry);
  console.log(`THOUGHTS.md updated for ${todayString()}.`);

  console.log("Checking belief update...");
  await checkBeliefUpdate(reflection);
}
