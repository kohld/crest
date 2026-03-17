// GitHub API interactions — runs with GH_TOKEN from environment

import { logError, ErrorSeverity } from "./error-logger";
import { withRetry, RETRY_CONFIGS } from "./retry";

const REPO = process.env.GITHUB_REPOSITORY ?? "kohld/crest";
const TOKEN = process.env.GH_TOKEN;

async function githubRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!TOKEN) throw new Error("GH_TOKEN is not set");

  const res = await fetch(`https://api.github.com/repos/${REPO}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API ${options.method || 'GET'} ${endpoint} failed: ${res.status} ${err}`);
  }

  return res.json() as Promise<T>;
}

export async function openIssue(title: string, body: string, labels: string[] = []): Promise<number> {
  return withRetry(
    async () => {
      const data = await githubRequest<{ number: number }>("/issues", {
        method: "POST",
        body: JSON.stringify({ title, body, labels }),
      });
      return data.number;
    },
    "github_open_issue",
    RETRY_CONFIGS.github
  );
}

export interface Issue {
  number: number;
  title: string;
  body: string;
  labels: string[];
}

export async function listOpenIssues(): Promise<Issue[]> {
  return withRetry(
    async () => {
      const data = await githubRequest<{ number: number; title: string; body: string | null; labels: { name: string }[] }[]>(
        "/issues?state=open&per_page=10"
      );
      return data.map((i) => ({
        number: i.number,
        title: i.title,
        body: i.body ?? "",
        labels: i.labels.map((l) => l.name),
      }));
    },
    "github_list_issues",
    RETRY_CONFIGS.github
  );
}

export async function closeIssue(number: number, comment: string): Promise<void> {
  return withRetry(
    async () => {
      // Post comment first
      await githubRequest(`/issues/${number}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: comment }),
      });

      // Then close issue
      const res = await fetch(`https://api.github.com/repos/${REPO}/issues/${number}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ state: "closed" }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to close issue #${number}: ${res.status} ${err}`);
      }

      console.log(`Issue #${number} closed via API (HTTP ${res.status}).`);
    },
    "github_close_issue",
    RETRY_CONFIGS.github
  );
}