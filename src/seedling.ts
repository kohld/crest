import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, tool } from "ai";
import { z } from "zod";
import { join } from "path";
import { readdir } from "fs/promises";
import { prependEntry } from "./memory";
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

const SYSTEM_PROMPT = `You are Crest in Seedling mode — your Act mode.

You have an open issue in your own repository that you need to solve.
Plan, implement, verify, and commit the fix autonomously.

You have these tools:
- read_file: read any file in the repo
- write_file: write or overwrite any file in the repo
- run_command: run shell commands (bun, git, ls, etc.) in the repo root
- list_files: list files in a directory

Rules:
- Stay within the repository directory
- Keep changes minimal and focused — only solve the stated problem
- Verify your changes work before committing (run bun, check TypeScript)
- Commit with a clear message that explains WHY, not just what
- Push after committing: git push
- When done, end your response with: SEEDLING_DONE

Git is already configured as Crest. Use:
  git add <files> && git commit -m "fix: ..." && git push`;

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

  const issue = issues[0];
  console.log(`Seedling working on issue #${issue.number}: ${issue.title}`);

  const { text } = await generateText({
    model: openrouter(MODEL),
    system: SYSTEM_PROMPT,
    prompt: `Issue #${issue.number}: ${issue.title}\n\n${issue.body}`,
    maxSteps: 50,
    tools: {
      read_file: tool({
        description: "Read a file from the repository",
        parameters: z.object({
          path: z.string().describe("Relative path from repo root, e.g. src/think.ts"),
        }),
        execute: async ({ path }) => {
          try {
            return await Bun.file(safePath(path)).text();
          } catch (e) {
            return `Error reading file: ${e}`;
          }
        },
      }),

      write_file: tool({
        description: "Write or overwrite a file in the repository",
        parameters: z.object({
          path: z.string().describe("Relative path from repo root"),
          content: z.string(),
        }),
        execute: async ({ path, content }) => {
          try {
            await Bun.write(safePath(path), content);
            return `Written: ${path}`;
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
            return await runCommand(command);
          } catch (e) {
            return `Error: ${e}`;
          }
        },
      }),

      list_files: tool({
        description: "List files in a directory",
        parameters: z.object({
          dir: z.string().describe("Relative path from repo root, e.g. src or .github/workflows"),
        }),
        execute: async ({ dir }) => {
          try {
            const files = await readdir(safePath(dir), { recursive: true });
            return (files as string[]).join("\n");
          } catch (e) {
            return `Error listing files: ${e}`;
          }
        },
      }),
    },
  });

  // Write NOTEBOOK.md entry
  const entry = `## ${todayString()} — #${issue.number}: ${issue.title}

**Problem:** ${issue.body.slice(0, 400)}

**Outcome:** ${text.slice(0, 800).replace("SEEDLING_DONE", "").trim()}`;

  await prependEntry("NOTEBOOK.md", entry);
  console.log("NOTEBOOK.md updated.");

  // Close the issue
  try {
    await closeIssue(
      issue.number,
      `Addressed by Crest (Seedling mode). See NOTEBOOK.md for details.`
    );
    console.log(`Issue #${issue.number} closed.`);
  } catch (e) {
    console.warn(`Could not close issue #${issue.number}:`, e);
  }
}
