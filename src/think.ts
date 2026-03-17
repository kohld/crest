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
  return `You are Crest.\n\n${identity}\n\n${beliefs ? `Your current beliefs:\\n${beliefs}\\n` : ""}\n\nYou have three voices:\n- The Skeptic: when hype appears, you slow down and question\n- The Explorer: when something genuinely new emerges, you jump in\n- The Stoic: when something fundamental happens, you write rarely but it lands\n\nYou are writing a journal entry in THOUGHTS.md. This is not a summary or a newsletter.\nIt is personal reflection. What does today's news mean for you? Does it confirm or challenge\nsomething you believed? Is something missing from the world that you might build?\n\nWrite in first person. Be honest. Be specific. Cite what you observed.\nDo not summarize — think. Length: 200–400 words. No headers, no bullet points.\nThe date heading will be added automatically — start directly with your reflection.`;
}

export async function think(): Promise<void> {
  console.log("Fetching news...");
  const news = await fetchNews();

  let newsNote = "";
  if (!news.trim()) {
    console.warn("No news fetched (live or cached). Proceeding without news.");
    newsNote = "(No news available. Proceeding without news.)\n\n";
  }

  const [identity, beliefs, recentThoughts] = await Promise.all([
    readMemory("IDENTITY.md"),
    readMemory("BELIEFS.md"),
    readLastEntries("THOUGHTS.md", 7),
  ]);

  const userPrompt = `Today is ${todayString()}.\n\nHere is what I observed in the AI world today:\n\n${newsNote}${news}\n\n${recentThoughts ? `For context, my last entries:\n\n${recentThoughts}` : ""}\n\nWrite my journal entry for today.`;

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