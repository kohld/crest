import { openIssue } from "./github";
import { MODEL } from "./config";

interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
  supported_parameters?: string[];
}

interface OpenRouterResponse {
  data: OpenRouterModel[];
}

async function fetchFreeModelsWithTools(): Promise<OpenRouterModel[]> {
  const res = await fetch("https://openrouter.ai/api/v1/models");
  if (!res.ok) throw new Error(`OpenRouter models API returned ${res.status}`);
  const json = (await res.json()) as OpenRouterResponse;

  return json.data.filter(
    (m) =>
      m.id.endsWith(":free") &&
      Array.isArray(m.supported_parameters) &&
      m.supported_parameters.includes("tools")
  );
}

export async function checkModelUpgrade(): Promise<void> {
  if (!process.env.GH_TOKEN) return;

  let candidates: OpenRouterModel[];
  try {
    candidates = await fetchFreeModelsWithTools();
  } catch (e) {
    console.warn("Model upgrade check failed (network?):", e);
    return;
  }

  const alternatives = candidates.filter((m) => m.id !== MODEL);
  if (alternatives.length === 0) {
    console.log("Model upgrade check: no alternatives found.");
    return;
  }

  const currentModel = candidates.find((m) => m.id === MODEL);
  const currentContext = currentModel?.context_length ?? 0;

  const upgrades = alternatives.filter((m) => m.context_length > currentContext);

  if (upgrades.length === 0) {
    console.log(`Model upgrade check: ${alternatives.length} alternative(s) found, none outperform current model by context.`);
    return;
  }

  const list = upgrades
    .sort((a, b) => b.context_length - a.context_length)
    .map((m) => `- \`${m.id}\` — ${m.name} (${(m.context_length / 1000).toFixed(0)}k context)`)
    .join("\n");

  const body = `I am currently running on \`${MODEL}\` (${(currentContext / 1000).toFixed(0)}k context window).

During my daily self-analysis, I checked the OpenRouter free model catalog and found free models with tool-use support that have a larger context window:

${list}

A larger context window would allow me to reason over more of my own codebase in a single pass during self-analysis and seedling runs.

**I am not switching on my own.** This is for Dennes to evaluate. If one of these models is worth trying, update \`src/config.ts\`.`;

  try {
    const number = await openIssue(
      `Model upgrade available: larger context free models detected`,
      body,
      ["model-upgrade"]
    );
    console.log(`Model upgrade: opened issue #${number}`);
  } catch (e) {
    console.warn("Failed to open model upgrade issue:", e);
  }
}
