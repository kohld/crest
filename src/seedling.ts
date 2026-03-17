import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, tool } from "ai";
import { z } from "zod";
import { join } from "path";
import { prependEntry, readMemory } from "./memory";
import { listOpenIssues, closeIssue } from "./github";
import { MODEL } from "./config";
import { enforcePolicy } from "./policy";

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
const ROOT = import.meta.dir.replace("/src", "");

// History files must never be overwritten — only prepended via TypeScript code
const PROTECTED_FILES = new Set([
  "NOTEBOOK.md", "THOUGHTS.md", "BELIEFS.md", "CHANGELOG.md",
  "SELF_ANALYSIS.md", "MEMORY_LOSS.md", "IDENTITY.md",
]);

function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

function safePath(p: string): string {
  const resolved = join(ROOT, p.replace(/^\//, ""));
  if (!resolved.startsWith(ROOT)) throw new Error(`Path outside repo: ${p}`);
  return resolved;
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

  const stdoutChunks: Uint8Array[] = [];
  const stderrChunks: Uint8Array[] = [];

  // Collect stdout using async iteration
  for await (const chunk of proc.stdout) {
    stdoutChunks.push(chunk);
  }

  // Collect stderr using async iteration
  for await (const chunk of proc.stderr) {
    stderrChunks.push(chunk);
  }

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
- read_file: read any file in the repo (parameter: file_path)
- write_file: write or overwrite a file in the repo (parameters: file_path, content)
- run_command: run shell commands in the repo root — use this for ls, find, git, bun, etc.

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

  const { text } = await generateText({
    model: openrouter(MODEL),
    system: buildSystemPrompt(claudeMd, identity),
    prompt: `Issue #${issue.number}: ${issue.title}\n\n${issue.body}`,
    maxSteps: 20,
    experimental_repairToolCall: async ({ toolCall, error, messages, system }) => {
      console.warn(`Tool call repair needed for ${toolCall.toolName}: ${error.message}`);

      // Unknown tool name — repair is impossible, skip the step
      const validTools = ["read_file", "write_file", "run_command"];
      if (!validTools.includes(toolCall.toolName)) {
        console.warn(`Unknown tool '${toolCall.toolName}' — skipping.`);
        return null;
      }

      const { text: repairedArgs } = await generateText({
        model: openrouter(MODEL),
        system: system ?? "",
        messages: [
          ...messages,
          {
            role: "assistant" as const,
            content: [{ type: "tool-call" as const, ...toolCall }],
          },
          {
            role: "tool" as const,
            content: [{
              type: "tool-result" as const,
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              content: `Error: ${error.message}. Please retry with correct parameter names.`,
            }],
          },
        ],
      });
      return { ...toolCall, args: repairedArgs };
    },
    tools: {
      read_file: tool({
        description: "Read a file from the repository",
        parameters: z.object({
          file_path: z.string().describe("Relative path from repo root, e.g. src/think.ts"),
        }),
        execute: async ({ file_path }) => {
          // Pre-execution policy check
          enforcePolicy("read_file", { file_path });

          try {
            return await Bun.file(safePath(file_path)).text();
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
          // Pre-execution policy check
          enforcePolicy("write_file", { file_path, content });

          const filename = file_path.split("/").pop() ?? file_path;
          if (PROTECTED_FILES.has(filename)) {
            return `Refused: ${file_path} is a protected history file and must not be overwritten.`;
          }
          try {
            await Bun.write(safePath(file_path), content);
            actionsLog.push(`wrote: ${file_path}`);
            return `Written: ${file_path}`;
          } catch (e) {
            return `Error writing file: ${e}`;
          }
        },
      }),

      run_command: tool({
        description: "Run a shell command in the repository root",
        parameters: z.object({
          command: z.string().describe("Shell command to run, e.g. 'bun run think' or 'git status'"),
        }),
        execute: async ({ command }) => {
          // Pre-execution policy check
          enforcePolicy("run_command", { command });

          try {
            const result = await runCommand(command);
            if (command.startsWith("git commit")) actionsLog.push(`committed: ${command}`);
            return result;
          } catch (e) {
            return `Error: ${e}`;
          }
        },
      }),

    },
  });

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