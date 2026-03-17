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
