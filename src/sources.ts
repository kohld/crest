// Fetches recent AI news from ArXiv and Hacker News

interface NewsItem {
  title: string;
  url: string;
  summary?: string;
}

async function fetchArxiv(): Promise<NewsItem[]> {
  const res = await fetch("https://arxiv.org/rss/cs.AI");
  const xml = await res.text();

  const items: NewsItem[] = [];
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item = match[1];
    const title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? "";
    const link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ?? "";
    const desc = item.match(/<description>([\s\S]*?)<\/description>/)?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";

    if (title && link) {
      items.push({ title, url: link, summary: desc.slice(0, 400) });
    }
    if (items.length >= 10) break;
  }
  return items;
}

async function fetchHackerNews(): Promise<NewsItem[]> {
  const res = await fetch(
    "https://hn.algolia.com/api/v1/search?query=AI+LLM+language+model&tags=story&hitsPerPage=10&numericFilters=points>30"
  );
  const data = await res.json() as { hits: { title?: string; url?: string }[] };
  return data.hits
    .filter((h) => h.title && h.url)
    .slice(0, 10)
    .map((h) => ({ title: h.title!, url: h.url! }));
}

export async function fetchNews(): Promise<string> {
  const [arxiv, hn] = await Promise.allSettled([fetchArxiv(), fetchHackerNews()]);

  let output = "";

  if (arxiv.status === "fulfilled" && arxiv.value.length > 0) {
    output += "## ArXiv cs.AI\n";
    for (const item of arxiv.value) {
      output += `- ${item.title}\n  ${item.url}\n`;
      if (item.summary) output += `  ${item.summary}\n`;
    }
    output += "\n";
  } else {
    console.warn("ArXiv fetch failed:", arxiv.status === "rejected" ? arxiv.reason : "no results");
  }

  if (hn.status === "fulfilled" && hn.value.length > 0) {
    output += "## Hacker News\n";
    for (const item of hn.value) {
      output += `- ${item.title}\n  ${item.url}\n`;
    }
  } else {
    console.warn("HackerNews fetch failed:", hn.status === "rejected" ? hn.reason : "no results");
  }

  return output;
}
