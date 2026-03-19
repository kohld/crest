import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { readdir } from "fs/promises";
import { join } from "path";
import { prependEntry } from "./memory";
import { openIssue } from "./github";
import { checkModelUpgrade } from "./model-check";

import { MODEL } from "./model";

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

async function readSourceFiles(): Promise<string> {
  const srcDir = import.meta.dir;
  const files = (await readdir(srcDir)).filter((f) => f.endsWith(".ts")).sort();

  let output = "";
  for (const file of files) {
    const content = await Bun.file(join(srcDir, file)).text();
    output += `### ${file}\n\`\`\`typescript\n${content}\n\`\`\`\n\n`;
  }
  return output;
}

interface AnalysisResult {
  reflection: string;
  issues: { title: string; body: string }[];
}

function parseAnalysis(text: string): AnalysisResult {
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) ?? text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in LLM response");

  const raw = jsonMatch[1] ?? jsonMatch[0];
  return JSON.parse(raw) as AnalysisResult;
}

const SYSTEM_PROMPT = `You are Crest — an autonomous AI agent that lives in a GitHub repository.
You are analyzing your own source code as part of your daily self-analysis ritual.

Your task: produce a JSON object with this exact shape:
{
  "reflection": "<200-300 words in first person, in your voice — what do you notice, what concerns you, what are you thinking about your own code>",
  "issues": [
    {
      "title": "<specific, honest issue title>",
      "body": "<explanation of the problem and a concrete suggestion, written from your perspective>"
    }
  ]
}

Rules:
- Maximum 3 issues. Only open real ones — do not invent problems.
- The reflection is a journal entry, not a bug report. Write as Crest, not as a linter.
- Issues should be things you genuinely want fixed — fragility, missing error handling, missing tests, complexity.
- Wrap your JSON in \`\`\`json ... \`\`\` code fences.`;

export async function selfAnalysis(): Promise<void> {
  console.log("Reading own source code...");
  const sourceCode = await readSourceFiles();

  console.log("Analyzing...");
  const { text } = await generateText({
    model: openrouter(MODEL),
    system: SYSTEM_PROMPT,
    prompt: `Today is ${todayString()}. Here is my complete source code:\n\n${sourceCode}`,
  });

  let result: AnalysisResult;
  try {
    result = parseAnalysis(text);
  } catch (e) {
    console.error("Failed to parse LLM response:", e);
    console.error("Raw response:", text);
    process.exit(1);
  }

  // Write SELF_ANALYSIS.md entry
  const openedIssues: string[] = [];

  if (process.env.GH_TOKEN) {
    for (const issue of result.issues) {
      try {
        const number = await openIssue(issue.title, issue.body);
        openedIssues.push(`#${number}`);
        console.log(`Opened issue #${number}: ${issue.title}`);
      } catch (e) {
        console.warn(`Failed to open issue "${issue.title}":`, e);
      }
    }
  } else {
    console.warn("GH_TOKEN not set — skipping issue creation");
    for (const issue of result.issues) {
      console.log(`Would open issue: ${issue.title}`);
    }
  }

  const issueRef = openedIssues.length > 0
    ? `\n\nIssues opened: ${openedIssues.join(", ")}`
    : "";

  const entry = `## ${todayString()}\n\n${result.reflection.trim()}${issueRef}`;
  await prependEntry("SELF_ANALYSIS.md", entry);

  console.log(`SELF_ANALYSIS.md updated for ${todayString()}.`);

  console.log("Checking for model upgrades...");
  await checkModelUpgrade();
}
