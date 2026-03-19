import { generateText } from "ai";
import { openIssue } from "./github";
import { logError, ErrorSeverity } from "./error-logger";
import { generateWithFallback } from "./model";

const SYSTEM_PROMPT = `You are Crest. You just wrote a journal entry about the AI world.

Now ask yourself: what concrete things should I build next?

You have access to your current source files (listed below). Use this to write precise, actionable issues — name the exact file to create or modify, describe the function signature or data structure, explain why it matters.

Rules:
- Only propose things that are genuinely missing from your stack
- Each issue must be completable in a single focused Seedling session (≤ 20 steps)
- Maximum 3 issues. Fewer is better — only open what you are confident about
- No vague improvements. Every issue must have a concrete "what to build" section

If you identify build opportunities, respond with a JSON array wrapped in \`\`\`json fences:
[
  {
    "title": "<short, specific issue title>",
    "body": "## Problem\\n<what is missing and why it matters>\\n\\n## What to build\\n<specific file(s), function signatures, approach>\\n\\n## Done when\\n<concrete verification criterion>"
  }
]

If no clear build opportunities exist, respond with exactly: NO_BUILD

Be honest. Do not invent work.`;

export async function checkBuildOpportunity(reflection: string): Promise<void> {
  if (!process.env.GH_TOKEN) {
    console.log("No GH_TOKEN set, skipping build opportunity check.");
    return;
  }

  // Gather codebase context so issues can be precise about files
  let srcFiles = "";
  try {
    const proc = Bun.spawnSync(["ls", "src/"], { cwd: import.meta.dir.replace("/src", "") });
    srcFiles = new TextDecoder().decode(proc.stdout).trim();
  } catch {
    srcFiles = "(could not list src/)";
  }

  const prompt = `My reflection today:\n\n${reflection}\n\n---\nCurrent source files in src/:\n${srcFiles}`;

  try {
    const { text } = await generateWithFallback({
      system: SYSTEM_PROMPT,
      prompt,
    });

    if (text.trim().startsWith("NO_BUILD")) {
      console.log("No build opportunity identified.");
      return;
    }

    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) ?? text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn("Could not parse build opportunity response — skipping.");
      await logError("build_opportunity_parsing", "No JSON found in response", ErrorSeverity.WARNING);
      return;
    }

    let results: { title: string; body: string }[];
    try {
      const parsed = JSON.parse(jsonMatch[1] ?? jsonMatch[0]);
      results = Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      console.warn("Invalid JSON in build opportunity — skipping.");
      await logError("build_opportunity_json_parse", e instanceof Error ? e : new Error("JSON parse error"), ErrorSeverity.WARNING);
      return;
    }

    for (const result of results.slice(0, 3)) {
      if (!result.title || !result.body) continue;
      const number = await openIssue(result.title, result.body, ["seedling"]);
      console.log(`Build opportunity → issue #${number}: ${result.title}`);
    }
  } catch (error) {
    console.error("Build opportunity check failed:", error);
  }
}
