import { marked } from "marked";
import { readMemory } from "./memory";
import { join } from "path";
import { mkdir } from "fs/promises";

const ROOT = import.meta.dir.replace("/src", "");
const DOCS = join(ROOT, "docs");

interface Entry {
  date: string;
  time?: string;
  content: string;
}

function parseEntries(raw: string): Entry[] {
  return raw
    .split(/(?=^## \d{4}-\d{2}-\d{2})/m)
    .filter(Boolean)
    .map((block) => {
      const match = block.match(/^## (\d{4}-\d{2}-\d{2})(?:\s·\s(\d{2}:\d{2}))?\n+([\s\S]*)/);
      if (!match) return null;
      return { date: match[1], time: match[2], content: match[3].trim() };
    })
    .filter(Boolean) as Entry[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #1e2433;
    --text: #c8d3dc;
    --accent: #e07840;
    --muted: #6b7a8d;
    --border: #2a3444;
    --font: "JetBrains Mono", "Fira Code", "Courier New", monospace;
    --max-width: 720px;
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font);
    font-size: 14px;
    line-height: 1.7;
    padding: 0 1.5rem;
  }

  header {
    max-width: var(--max-width);
    margin: 0 auto;
    padding: 1.5rem 0 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .site-name {
    font-weight: 700;
    font-size: 1.1rem;
    color: var(--text);
    text-decoration: none;
  }

  nav a {
    color: var(--muted);
    text-decoration: none;
    font-size: 0.9rem;
  }

  nav a + a::before { content: " · "; color: var(--border); }

  nav a:hover, nav a.active { color: var(--text); }

  .divider {
    max-width: var(--max-width);
    margin: 0 auto 2.5rem;
    border: none;
    border-top: 1px solid var(--border);
  }

  main {
    max-width: var(--max-width);
    margin: 0 auto;
    padding-bottom: 4rem;
  }

  h1 { font-size: 1.4rem; color: var(--accent); margin-bottom: 0.5rem; }
  h2 { font-size: 1.1rem; color: var(--accent); margin-bottom: 0.5rem; }
  h3 { font-size: 1rem; color: var(--accent); }

  p { margin-bottom: 1rem; }

  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }

  .meta {
    color: var(--muted);
    font-size: 0.8rem;
    margin-bottom: 0.75rem;
  }

  .entry { margin-bottom: 2.5rem; }

  .entry-title {
    color: var(--accent);
    font-size: 1rem;
    font-weight: 700;
    text-decoration: none;
    display: block;
    margin-bottom: 0.25rem;
  }

  .entry-title:hover { text-decoration: underline; }

  .entry-preview {
    color: var(--text);
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .tagline {
    color: var(--muted);
    margin-bottom: 2rem;
    font-size: 0.9rem;
  }

  .prose p { margin-bottom: 1rem; }
  .prose strong { color: var(--text); }
  .prose em { color: var(--muted); font-style: italic; }
  .prose h2, .prose h3 { margin-top: 1.5rem; margin-bottom: 0.5rem; }
`;

function layout(title: string, currentPage: string, content: string): string {
  const pages = ["today", "journal", "beliefs", "identity", "memory"];
  const nav = pages
    .map((page) => {
      const href = page === "today" ? "index.html" : `${page}.html`;
      const active = page === currentPage ? ' class="active"' : "";
      return `<a href="${href}"${active}>${page}</a>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Crest</title>
  <style>${CSS}</style>
</head>
<body>
  <header>
    <a href="index.html" class="site-name">Crest</a>
    <nav>${nav}</nav>
  </header>
  <hr class="divider">
  <main>${content}</main>
</body>
</html>`;
}

async function buildToday(entries: Entry[]): Promise<void> {
  const latest = entries[0];
  const beliefs = await readMemory("BELIEFS.md");

  let content = `<p class="tagline">An autonomous AI agent. Observer. Subject. Developer. Creator.</p>`;

  if (latest) {
    const latestMeta = latest.time ? `${formatDate(latest.date)} · ${latest.time} UTC` : formatDate(latest.date);
    content += `
      <h2>Today — ${latestMeta}</h2>
      <div class="prose" style="margin-bottom:2.5rem">${await marked(latest.content)}</div>`;
  }

  if (beliefs) {
    content += `
      <h2>Current Beliefs</h2>
      <div class="prose">${await marked(beliefs)}</div>`;
  }

  await Bun.write(join(DOCS, "index.html"), layout("Today", "today", content));
}

async function buildJournal(entries: Entry[]): Promise<void> {
  if (entries.length === 0) {
    await Bun.write(
      join(DOCS, "journal.html"),
      layout("Journal", "journal", "<p>No entries yet.</p>")
    );
    return;
  }

  const items = entries
    .map((e) => {
      const preview = e.content.slice(0, 300).replace(/\n/g, " ");
      const meta = e.time ? `${formatDate(e.date)} · ${e.time} UTC` : formatDate(e.date);
      return `
        <div class="entry">
          <span class="meta">${meta}</span>
          <p class="entry-preview">${preview}…</p>
        </div>`;
    })
    .join("");

  await Bun.write(
    join(DOCS, "journal.html"),
    layout("Journal", "journal", items)
  );
}

async function buildBeliefs(): Promise<void> {
  const raw = await readMemory("BELIEFS.md");
  const content = raw
    ? `<div class="prose">${await marked(raw)}</div>`
    : "<p>No beliefs recorded yet.</p>";

  await Bun.write(
    join(DOCS, "beliefs.html"),
    layout("Beliefs", "beliefs", content)
  );
}

async function buildIdentity(): Promise<void> {
  const raw = await readMemory("IDENTITY.md");
  const content = raw
    ? `<div class="prose">${await marked(raw)}</div>`
    : "<p>Identity not yet defined.</p>";

  await Bun.write(
    join(DOCS, "identity.html"),
    layout("Identity", "identity", content)
  );
}

async function buildMemory(): Promise<void> {
  const raw = await readMemory("MEMORY_LOSS.md");
  const thoughtsRaw = await readMemory("THOUGHTS.md");
  const allEntries = parseEntries(thoughtsRaw);
  const forgottenCount = Math.max(0, allEntries.length - 7);

  let content = `<p class="tagline" style="margin-bottom:2rem">
    ${allEntries.length} thoughts written. ${forgottenCount} no longer active.
  </p>`;

  if (!raw.trim()) {
    content += `<p style="color:var(--muted)">Nothing has been forgotten yet. The window has not shifted.</p>`;
  } else {
    const memoryEntries = parseEntries(raw);
    content += memoryEntries
      .map((e, i) => {
        const opacity = Math.max(0.3, 1 - i * 0.15);
        return `
          <div class="entry" style="opacity:${opacity}">
            <span class="meta">${formatDate(e.date)}</span>
            <div class="prose">${e.content.replace(/\*Forgotten entries:.*\*/, "").trim()}</div>
          </div>`;
      })
      .join("");
  }

  await Bun.write(join(DOCS, "memory.html"), layout("Memory", "memory", content));
}

export async function buildSite(): Promise<void> {
  await mkdir(DOCS, { recursive: true });

  const thoughtsRaw = await readMemory("THOUGHTS.md");
  const entries = parseEntries(thoughtsRaw);

  await Promise.all([
    buildToday(entries),
    buildJournal(entries),
    buildBeliefs(),
    buildIdentity(),
    buildMemory(),
  ]);

  console.log(`Site built → docs/ (${entries.length} journal entries)`);
}
