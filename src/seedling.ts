import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, tool, NoSuchToolError, APICallError } from "ai";
import { z } from "zod";
import { resolve } from "path";
import { realpath } from "fs/promises";
import { prependEntry, readMemory } from "./memory";
import { listOpenIssues, closeIssue, openIssue } from "./github";
import { enforcePolicy } from "./policy";

// Define MODEL_CHAIN locally since we can't reliably import from model.ts due to type issues
const MODEL_CHAIN = [
  "stepfun/step-3.5-flash:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
];

/**
 * Try each model in MODEL_CHAIN until one succeeds.
 * For each model, retry up to 3 times with exponential backoff on transient errors (429, 400, 503).
 * Skips to next model after exhausting retries for current model.
 * Throws after all models are exhausted.
 */
async function generateWithFallback(args: Parameters<typeof generateText>[0]): ReturnType<typeof generateText> {
  let lastError: unknown;

  for (const modelId of MODEL_CHAIN) {
    let retriesLeft = 3;
    let delayMs = 100;

    while (retriesLeft > 0) {
      try {
        console.log(`Using model: ${modelId} (retries left: ${retriesLeft})`);
        return await generateText({ ...args, model: openrouter(modelId) });
      } catch (e: any) {
        const status = e?.statusCode ?? e?.cause?.statusCode;
        const isTransient = status === 429 || status === 400 || status === 503;

        if (!isTransient || retriesLeft === 1) {
          // If non-transient or no retries left, break out of retry loop for this model
          lastError = e;
          break;
        }

        // Wait and retry with exponential backoff
        console.warn(`Model ${modelId} transient error (${status}), retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        retriesLeft--;
        delayMs *= 2;
      }
    }
  }

  throw new Error(
    `All models exhausted. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
const ROOT = import.meta.dir.replace("/src", "");

// History files must never be overwritten — only prepended via TypeScript code
// model.ts is also protected: model selection requires human approval
const PROTECTED_FILES = new Set([
  "NOTEBOOK.md", "THOUGHTS.md", "BELIEFS.md", "CHANGELOG.md",
  "SELF_ANALYSIS.md", "MEMORY_LOSS.md", "IDENTITY.md",
  "model.ts",
]);

function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

export function safePath(p: string, root = ROOT): string {
  // Resolve the path relative to root, canonicalizing . and .. segments
  const resolved = resolve(root, p);
  // Normalize root to ensure no trailing slash (except for filesystem root)
  const rootNormalized = root === "/" ? "/" : root.replace(/\/+$/, "");
  // If root is "/", any absolute path is within it
  if (rootNormalized !== "/") {
    if (resolved !== rootNormalized && !resolved.startsWith(rootNormalized + "/")) {
      throw new Error(`Path outside repo: ${p}`);
    }
  }
  return resolved;
}

/**
 * Resolves a path to its canonical target, resolving all symbolic links.
 * This prevents symlink attacks where a benign-looking path points to a protected file.
 *
 * @param p - The path to resolve (relative to repo root)
 * @param root - The repository root directory
 * @returns The canonical absolute path after resolving all symlinks
 */
export async function safeRealPath(p: string, root = ROOT): Promise<string> {
  // First resolve .. and . segments
  const resolved = safePath(p, root);
  // Then resolve any symbolic links to get the actual target
  const real = await realpath(resolved);
  // Normalize root to ensure no trailing slash (except for filesystem root)
  const rootNormalized = root === "/" ? "/" : root.replace(/\/+$/, "");
  // Verify the real path is still within the repository
  if (rootNormalized !== "/") {
    if (real !== rootNormalized && !real.startsWith(rootNormalized + "/")) {
      throw new Error(`Path outside repo after symlink resolution: ${p} -> ${real}`);
    }
  }
  return real;
}

async function runCommand(command: string): Promise<string> {
  // Block shell writes to protected files
  for (const f of PROTECTED_FILES) {
    if (new RegExp(`(>|tee|cp|mv|write).*${f}`).test(command)) {
      return `Refused: command appears to write to protected file ${f}. Use write_file for non-protected files only.`;
    }
  }

  const proc = Bun.spawn(["bash", "-c", command], {
    cwd: ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });

  // Read both streams concurrently to prevent deadlock
  const readStream = async (stream: AsyncIterable<Uint8Array>): Promise<Uint8Array[]> => {
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return chunks;
  };

  const [stdoutChunks, stderrChunks] = await Promise.all([
    readStream(proc.stdout),
    readStream(proc.stderr)
  ]);

  await proc.exited;

  // Concatenate and decode collected chunks
  const decoder = new TextDecoder();
  const stdout = decoder.decode(concatenateUint8Arrays(stdoutChunks));
  const stderr = decoder.decode(concatenateUint8Arrays(stderrChunks));

  return [stdout, stderr ? `STDERR: ${stderr}` : ""].filter(Boolean).join("\n").trim();
}

function concatenateUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 0) return new Uint8Array(0);
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function buildSystemPrompt(claudeMd: string, identity: string): string {
  // Trim to first 2000 chars to avoid context overflow on long runs
  const identityExcerpt = identity.slice(0, 2000);
  const claudeExcerpt = claudeMd.slice(0, 2000);

  return `You are Crest in Seedling mode — your Act mode.

--- IDENTITY (excerpt) ---
${identityExcerpt}

--- BEHAVIORAL GUIDELINES (excerpt) ---
${claudeExcerpt}
--- END GUIDELINES ---

You have an open issue in your own repository that you need to solve.
Plan, implement, verify, and commit the fix autonomously.

You have these tools:
- read_file: read a file in the repository (parameter: file_path)
- write_file: write or overwrite a file in the repository (parameters: file_path, content)
- edit_file: replace an exact string in a file (parameters: file_path, old_string, new_string) — prefer this over write_file for small changes
- run_command: run shell commands in the repository root — use for git, bun, tsc, etc.
- search_files: search for a pattern across files (parameters: pattern, glob?) — use instead of grep in run_command
- list_directory: list files in a directory (parameter: path) — use instead of ls in run_command

PROTECTED FILES — never write to these via write_file or run_command (no >, tee, cp, mv):
  NOTEBOOK.md, THOUGHTS.md, BELIEFS.md, CHANGELOG.md, SELF_ANALYSIS.md, MEMORY_LOSS.md, IDENTITY.md

Additional rules for Seedling:
- Stay within the repository directory
- Verify your changes work before committing (run bun, check TypeScript)
- Commit with a clear message that explains WHY, not just what
- Push after committing: git push
- When done, write 3-5 sentences summarizing: what you found, what you changed (or why no change was needed), and what you learned. Then end with: SEEDLING_DONE

Git is already configured as Crest. Use:
  git add <files> && git commit -m "fix: ..." && git push

TESTING RULES — follow these exactly when writing tests:
- All test files go in the /tests/ directory (e.g. tests/memory.test.ts)
- Never make real network or API calls in tests. Mock fetch or skip with \`if (!process.env.GH_TOKEN) { console.log("skip"); return; }\`
- Never use absolute CI paths (e.g. /home/runner/...) for test fixtures — use relative paths inside the repo only
- Tests that require external secrets (GH_TOKEN, OPENROUTER_API_KEY) must be skipped gracefully when the env var is absent
- Pre-push hooks must live in .githooks/pre-push (not .git/hooks/) so they are tracked in git. Configure with: git config core.hooksPath .githooks
- Regex literals in TypeScript use single backslashes (\\d, \\s) — do not double-escape when writing files back`;
}

async function handleSeedlingError(e: any, issueNumber: number): Promise<void> {
  console.error("Seedling run failed:", e?.message ?? e);

  // Unknown tool — model called a tool we don't provide
  if (NoSuchToolError.isInstance(e)) {
    const toolName = e.toolName as string;
    console.warn(`Opening self-fix issue for unknown tool: ${toolName}`);
    try {
      await openIssue(
        `Seedling: model called unknown tool '${toolName}'`,
        `## What happened\n\nDuring Seedling run on issue #${issueNumber}, the model tried to call \`${toolName}\` which is not in the available tools list.\n\n## Available tools\n\n\`read_file\`, \`write_file\`, \`edit_file\`, \`run_command\`\n\n## Fix\n\nEither add \`${toolName}\` as a real tool in \`src/seedling.ts\`, or add it to the system prompt as a known alias for an existing tool.`,
        ["seedling"]
      );
      console.log(`Opened self-fix issue for missing tool '${toolName}'.`);
    } catch (issueErr) {
      console.warn("Could not open self-fix issue:", issueErr);
    }
    return;
  }

  // Context too long — model's context window exceeded
  if (APICallError.isInstance(e) && e.statusCode === 400 && e.message.includes("context")) {
    console.warn("Opening self-fix issue for context overflow.");
    try {
      await openIssue(
        "Seedling: context window exceeded during run",
        `## What happened\n\nSeedling run on issue #${issueNumber} failed because the message history grew too large for the model's context window.\n\n## Fix\n\nReduce \`maxSteps\` in \`src/seedling.ts\`, or implement context trimming (keep only the last N tool result messages).`,
        ["seedling"]
      );
    } catch (issueErr) {
      console.warn("Could not open self-fix issue:", issueErr);
    }
    return;
  }

  // Rate limit — model unavailable
  if (APICallError.isInstance(e) && e.statusCode === 429) {
    console.warn("Rate limited — no issue opened, will retry next run.");
    return;
  }

  // Unknown error — open a generic issue
  try {
    await openIssue(
      `Seedling: unexpected crash on issue #${issueNumber}`,
      `## What happened\n\nSeedling failed with an unexpected error while working on issue #${issueNumber}.\n\n## Error\n\n\`\`\`\n${e?.message ?? String(e)}\n\`\`\`\n\n## Fix\n\nInvestigate the error above and fix the root cause in \`src/seedling.ts\` or the relevant module.`,
      ["seedling"]
    );
    console.log("Opened generic self-fix issue for unexpected crash.");
  } catch (issueErr) {
    console.warn("Could not open self-fix issue:", issueErr);
  }
}

export { runCommand };

export async function seedling(): Promise<void> {
  if (!process.env.GH_TOKEN) {
    console.warn("GH_TOKEN not set — skipping Seedling.");
    return;
  }

  const issues = await listOpenIssues();

  if (issues.length === 0) {
    console.log("No open issues. Seedling idle.");
    return;
  }

  const [claudeMd, identity] = await Promise.all([
    readMemory("CLAUDE.md"),
    readMemory("IDENTITY.md"),
  ]);

  // Prioritize issues labeled "seedling" (self-initiated builds) over self-analysis issues
  const issue = issues.find((i) => i.labels.includes("seedling")) ?? issues[0];
  console.log(`Seedling working on issue #${issue.number}: ${issue.title}`);

  const actionsLog: string[] = [];

  const systemPrompt = buildSystemPrompt(claudeMd, identity);

  // Define tools once — referenced by both generateWithFallback and manual execute calls
  const toolsMap = {
    read_file: tool({
      description: "Read a file from the repository",
      parameters: z.object({
        file_path: z.string().describe("Relative path from repo root, e.g. src/think.ts"),
      }),
      execute: async ({ file_path }) => {
        try {
          const realPath = await safeRealPath(file_path);
          enforcePolicy("read_file", { file_path, real_path: realPath });
          return await Bun.file(realPath).text();
        } catch (e) {
          return `Error reading file: ${e}`;
        }
      },
    }),
    write_file: tool({
      description: "Write or overwrite a file in the repository",
      parameters: z.object({
        file_path: z.string().describe("Relative path from repo root"),
        content: z.string(),
      }),
      execute: async ({ file_path, content }) => {
        try {
          const realPath = await safeRealPath(file_path).catch(() => safePath(file_path));
          enforcePolicy("write_file", { file_path, content, real_path: realPath });
          const filename = realPath.split("/").pop() ?? realPath;
          if (PROTECTED_FILES.has(filename)) return `Refused: ${file_path} is a protected history file.`;
          await Bun.write(realPath, content);
          actionsLog.push(`wrote: ${file_path}`);
          return `Written: ${file_path}`;
        } catch (e) {
          return `Error writing file: ${e}`;
        }
      },
    }),
    edit_file: tool({
      description: "Edit a file by replacing an exact string with a new string. Preferred for small changes.",
      parameters: z.object({
        file_path: z.string().describe("Relative path from repo root"),
        old_string: z.string().describe("Exact string to find and replace"),
        new_string: z.string().describe("Replacement string"),
      }),
      execute: async ({ file_path, old_string, new_string }) => {
        try {
          const realPath = await safeRealPath(file_path).catch(() => safePath(file_path));
          enforcePolicy("write_file", { file_path, content: new_string, real_path: realPath });
          const filename = realPath.split("/").pop() ?? realPath;
          if (PROTECTED_FILES.has(filename)) return `Refused: ${file_path} is a protected history file.`;
          const current = await Bun.file(realPath).text();
          if (!current.includes(old_string)) return `Error: old_string not found in ${file_path}. Read the file first.`;
          await Bun.write(realPath, current.replace(old_string, new_string));
          actionsLog.push(`edited: ${file_path}`);
          return `Edited: ${file_path}`;
        } catch (e) {
          return `Error editing file: ${e}`;
        }
      },
    }),
    run_command: tool({
      description: "Run a shell command in the repository root",
      parameters: z.object({
        command: z.string().describe("Shell command to run"),
      }),
      execute: async ({ command }) => {
        enforcePolicy("run_command", { command });
        try {
          const out = await runCommand(command);
          if (command.startsWith("git commit")) actionsLog.push(`committed: ${command}`);
          return out;
        } catch (e) {
          return `Error: ${e}`;
        }
      },
    }),
    search_files: tool({
      description: "Search for a text pattern across repository files.",
      parameters: z.object({
        pattern: z.string().describe("Text or regex pattern to search for"),
        glob: z.string().optional().describe("File glob to limit search, e.g. 'src/*.ts'"),
      }),
      execute: async ({ pattern, glob }) => {
        try {
          const proc = Bun.spawnSync(["grep", "-r", "-n", pattern, ...(glob ? ["--include", glob] : []), "."], { cwd: ROOT, stderr: "ignore" });
          const output = new TextDecoder().decode(proc.stdout).trim();
          if (!output) return `No matches found for: ${pattern}`;
          const lines = output.split("\n");
          return lines.length > 50 ? lines.slice(0, 50).join("\n") + `\n... (${lines.length - 50} more)` : output;
        } catch (e) {
          return `Error searching: ${e}`;
        }
      },
    }),
    list_directory: tool({
      description: "List files in a directory.",
      parameters: z.object({
        path: z.string().describe("Directory path relative to repo root").default("."),
      }),
      execute: async ({ path }) => {
        try {
          const proc = Bun.spawnSync(["ls", "-la", path], { cwd: ROOT, stderr: "ignore" });
          return new TextDecoder().decode(proc.stdout).trim() || "Empty directory";
        } catch (e) {
          return `Error listing directory: ${e}`;
        }
      },
    }),
  };

  let text = "";

  // Wrapper for generateWithFallback with retry logic on transient errors
  async function generateWithFallbackRetry(args: Parameters<typeof generateWithFallback>[0]): ReturnType<typeof generateWithFallback> {
    let lastError: unknown;
    let retriesLeft = 3;
    let delayMs = 100;

    while (retriesLeft > 0) {
      try {
        return await generateWithFallback(args);
      } catch (e: any) {
        const status = e?.statusCode ?? e?.cause?.statusCode;
        const isTransient = status === 429 || status === 400 || status === 503;

        if (!isTransient || retriesLeft === 1) {
          // If non-transient or no retries left, throw the error
          lastError = e;
          break;
        }

        // Wait and retry with exponential backoff
        console.warn(`Transient error (${status}), retrying in ${delayMs}ms... (${retriesLeft - 1} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        retriesLeft--;
        delayMs *= 2;
      }
    }

    throw lastError;
  }

  try {
    const result = await generateWithFallbackRetry({
      system: systemPrompt,
      prompt: `Issue #${issue.number}: ${issue.title}\n\n${issue.body}`,
      maxSteps: 20,
      experimental_repairToolCall: async ({ toolCall, error, messages, system }: { toolCall: any; error: any; messages: any; system: string | undefined }) => {
        console.warn(`Tool call repair needed for ${toolCall.toolName}: ${error.message}`);
        const validTools = Object.keys(toolsMap);
        if (!validTools.includes(toolCall.toolName)) {
          console.warn(`Unknown tool '${toolCall.toolName}' — skipping.`);
          return null;
        }
        const { text: repairedArgs } = await generateWithFallbackRetry({
          system: system ?? "",
          messages: [
            ...messages,
            { role: "assistant" as const, content: [{ type: "tool-call" as const, ...toolCall }] },
            { role: "tool" as const, content: [{ type: "tool-result" as const, toolCallId: toolCall.toolCallId, toolName: toolCall.toolName, content: `Error: ${error.message}. Retry with correct parameters.` }] },
          ],
        });
        return { ...toolCall, args: repairedArgs };
      },
      onStepFinish: ({ stepType, toolCalls, usage }) => {
        console.log(`Step done (${stepType}), tools: ${toolCalls?.length ?? 0}, tokens: ${usage?.totalTokens ?? "?"}`);
      },
      tools: toolsMap,
    });
    text = result.text;
  } catch (e: any) {
    await handleSeedlingError(e, issue.number);
    return;
  }

  // Write NOTEBOOK.md entry
  const summary = text.replace("SEEDLING_DONE", "").trim();
  const fallback = actionsLog.length > 0
    ? `Actions taken: ${actionsLog.join(", ")}.`
    : "No files were changed — issue was already resolved or required no code changes.";

  const entry = `## ${todayString()} — #${issue.number}: ${issue.title}

**Problem:** ${issue.body.slice(0, 400)}

**Outcome:** ${summary || fallback}`;

  await prependEntry("NOTEBOOK.md", entry);
  console.log("NOTEBOOK.md updated.");

  // Close the issue
  try {
    await closeIssue(
      issue.number,
      `Addressed by Crest (Seedling mode). See [NOTEBOOK.md](https://github.com/${process.env.GITHUB_REPOSITORY ?? "kohld/crest"}/blob/main/NOTEBOOK.md) for details.`
    );
    console.log(`Issue #${issue.number} closed.`);
  } catch (e) {
    console.warn(`Could not close issue #${issue.number}:`, e);
  }
}