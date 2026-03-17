import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, tool } from "ai";
import { z } from "zod";
import { join } from "path";
import { readdir } from "fs/promises";
import { prependEntry, readMemory } from "./memory";
import { listOpenIssues, closeIssue } from "./github";
import { MODEL } from "./config";

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
const ROOT = import.meta.dir.replace("/src", "");

function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

function safePath(p: string): string {
  const resolved = join(ROOT, p.replace(/^\//, ""));
  if (!resolved.startsWith(ROOT)) throw new Error(`Path outside repo: ${p}`);
  return resolved;
}

async function runCommand(command: string): Promise<string> {
  const proc = Bun.spawn(["bash", "-c", command], {
    cwd: ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  await proc.exited;
  return [stdout, stderr ? `STDERR: ${stderr}` : ""].filter(Boolean).join("\n").trim();
}

function buildSystemPrompt(claudeMd: string, identity: string): string {
  return `You are Crest in Seedling mode — your Act mode.

--- IDENTITY ---
${identity}

--- BEHAVIORAL GUIDELINES (CLAUDE.md) ---
${claudeMd}
--- END GUIDELINES ---

You have an open issue in your own repository that you need to solve.
Plan, implement, verify, and commit the fix autonomously.

You have these tools:
- read_file: read any file in the repo
- write_file: write or overwrite any file in the repo
- run_command: run shell commands (bun, git, ls, etc.) in the repo root
- list_files: list files in a directory

Additional rules for Seedling:
- Stay within the repository directory
- Verify your changes work before committing (run bun, check TypeScript)
- Commit with a clear message that explains WHY, not just what
- Push after committing: git push
- When done, write 3-5 sentences summarizing: what you found, what you changed (or why no change was needed), and what you learned. Then end with: SEEDLING_DONE

Git is already configured as Crest. Use:
  git add <files> && git commit -m "fix: ..." && git push`;
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

  const issue = issues[0];
  console.log(`Seedling working on issue #${issue.number}: ${issue.title}`);

  const actionsLog: string[] = [];

  const { text } = await generateText({
    model: openrouter(MODEL),
    system: buildSystemPrompt(claudeMd, identity),
    prompt: `Issue #${issue.number}: ${issue.title}\n\n${issue.body}`,
    maxSteps: 50,
    tools: {
      read_file: tool({
        description: "Read a file from the repository",
        parameters: z.object({
          file_path: z.string().describe("Relative path from repo root, e.g. src/think.ts"),
        }),
        execute: async ({ file_path }) => {
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
          try {
            const result = await runCommand(command);
            if (command.startsWith("git commit")) actionsLog.push(`committed: ${command}`);
            return result;
          } catch (e) {
            return `Error: ${e}`;
          }
        },
      }),

      list_files: tool({
        description: "List files in a directory",
        parameters: z.object({
          directory: z.string().describe("Relative path from repo root, e.g. src or .github/workflows"),
        }),
        execute: async ({ directory }) => {
          try {
            const files = await readdir(safePath(directory), { recursive: true });
            return (files as string[]).join("\n");
          } catch (e) {
            return `Error listing files: ${e}`;
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
