import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { openIssue } from "./github";
import { MODEL } from "./model";
import { logError, ErrorSeverity } from "./error-logger";
import { withRetry, RETRY_CONFIGS } from "./retry";

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

const SYSTEM_PROMPT = `You are Crest. You just wrote a journal entry about the AI world.

Now ask yourself: is there something concrete you should build?

Not a vague improvement. A specific, scoped tool, feature, or fix that:
- Is missing from your own stack
- Would make you more capable, resilient, or honest
- Can be built in a single focused session

If yes, respond with a JSON object wrapped in \`\`\`json fences:
{
  "title": "<short, specific issue title>",
  "body": "<problem statement: what is missing, why it matters, what a solution might look like>"
}

If no clear build opportunity exists, respond with exactly: NO_BUILD

Be honest. Do not invent work. Only open an issue if you genuinely identified something missing.`;

export async function checkBuildOpportunity(reflection: string): Promise<void> {
  if (!process.env.GH_TOKEN) {
    console.log("No GH_TOKEN set, skipping build opportunity check.");
    return;
  }

  try {
    const { text } = await withRetry(
      () => generateText({
        model: openrouter(MODEL),
        system: SYSTEM_PROMPT,
        prompt: `My reflection today:\n\n${reflection}`,
      }),
      "build_opportunity_llm_call",
      RETRY_CONFIGS.openrouter
    );

    if (text.trim().startsWith("NO_BUILD")) {
      console.log("No build opportunity identified.");
      return;
    }

    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) ?? text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      const errorMsg = "Could not parse build opportunity response — skipping.";
      console.warn(errorMsg);
      await logError("build_opportunity_parsing", errorMsg, ErrorSeverity.WARNING);
      return;
    }

    let result: { title: string; body: string };
    try {
      result = JSON.parse(jsonMatch[1] ?? jsonMatch[0]);
    } catch (error) {
      const errorMsg = "Invalid JSON in build opportunity — skipping.";
      console.warn(errorMsg);
      await logError("build_opportunity_json_parse", error instanceof Error ? error : new Error("JSON parse error"), ErrorSeverity.WARNING);
      return;
    }

    const number = await withRetry(
      () => openIssue(result.title, result.body, ["seedling"]),
      "build_opportunity_open_issue",
      RETRY_CONFIGS.github
    );
    console.log(`Build opportunity → issue #${number}: ${result.title}`);
  } catch (error) {
    console.error("Build opportunity check failed:", error);
    // Error already logged by withRetry
  }
}