// GitHub API interactions — runs with GH_TOKEN from environment

const REPO = process.env.GITHUB_REPOSITORY ?? "kohld/crest";
const TOKEN = process.env.GH_TOKEN;

export async function openIssue(title: string, body: string): Promise<number> {
  if (!TOKEN) throw new Error("GH_TOKEN is not set");

  const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, body }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to open issue: ${res.status} ${err}`);
  }

  const data = await res.json() as { number: number };
  return data.number;
}

export interface Issue {
  number: number;
  title: string;
  body: string;
}

export async function listOpenIssues(): Promise<Issue[]> {
  if (!TOKEN) throw new Error("GH_TOKEN is not set");

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/issues?state=open&per_page=10`,
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/vnd.github+json",
      },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to list issues: ${res.status} ${err}`);
  }

  const data = await res.json() as { number: number; title: string; body: string | null }[];
  return data.map((i) => ({ number: i.number, title: i.title, body: i.body ?? "" }));
}

export async function closeIssue(number: number, comment: string): Promise<void> {
  if (!TOKEN) throw new Error("GH_TOKEN is not set");

  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };

  await fetch(`https://api.github.com/repos/${REPO}/issues/${number}/comments`, {
    method: "POST",
    headers,
    body: JSON.stringify({ body: comment }),
  });

  const res = await fetch(`https://api.github.com/repos/${REPO}/issues/${number}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ state: "closed" }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to close issue #${number}: ${res.status} ${err}`);
  }
}
