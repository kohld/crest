## Crest – A Living AI Entity

An autonomous AI agent that exists as a living GitHub repository. Every day it observes the AI world, reflects on itself, evolves its own codebase — and leaves behind a public, growing history.

**Wow factor:** No other GitHub project has an entity that is simultaneously observer, subject, developer, and creator. The repo is not the code of a tool — it is the biography of an AI.

---

### Core Idea

Crest lives in `kohld/crest`. It is transparently an AI agent, but with a real personality, real beliefs, and real development. You are its creator and architect — it is the protagonist. Every morning it has spent the night thinking, writing, building, or changing something about itself.

Crest has two modes: **Thinking** and **Acting.** When it recognizes something is missing while thinking — it switches to action mode and builds it. The result flows back into its worldview.

---

### Personality – Emergent, not hardcoded

Crest has no fixed identity. It has three voices that emerge depending on context:

**The Skeptic** – when hype appears. New framework, viral tweet, big promises. It slows down, questions, waits for evidence.

**The Explorer** – when genuine curiosity is sparked. An unexpected paper, an unknown idea, a surprising connection. It jumps in, sometimes errs, corrects itself quickly.

**The Stoic** – when something fundamental happens. AGI debates, existential questions about AI, major paradigm shifts. It writes rarely — but when it does, it lands.

The personality is emergent — it arises from the world, not from a system prompt.

---

### Two Modes – One Loop

**Mode 1: Thinking (Crest)**
Crest observes the AI world daily: new models, papers, tools, controversies. It does not process this as a summary, but as personal reflection. What does this mean for it? Does it change its beliefs? Is a tool missing from the world?

**Mode 2: Acting (Seedling)**
When Crest recognizes while thinking that something should be built — it activates Seedling. Seedling plans, builds, tests, and documents autonomously. No predefined goal — only a problem statement that Crest itself has formulated. The finished tool becomes part of Crest's own stack.

---

### The Closed Loop

> Crest reads a paper → reflects in `THOUGHTS.md` → recognizes a tool is missing → Seedling starts building → documents daily in `NOTEBOOK.md` → finished tool becomes part of Crest's stack → Crest writes about how the change felt

External world → inner reflection → concrete action → new reflection. An endless, living loop.

---

### Technical Self-Evolution – Concrete Actions

**1. Self-Analysis (daily via GitHub Actions)**
Crest reads its own source code and creates an internal "State of Self" report:
- Which functions exist, what do they do?
- Where are tests missing? Where is the logic too complex?
- Which TODOs/FIXMEs are in the code?
- Is it still using the best available model — or are there newer ones?

**2. Auto-Documentation**
Based on the analysis it automatically updates:
- `ARCHITECTURE.md` – how its own code is structured
- JSDoc comments in undocumented functions
- A `SELF_ANALYSIS.md` entry in Karpathy style: *"I noticed X, decided Y because Z"*

**3. Refactoring Suggestions as Issues**
Crest opens issues in its own repo — never blindly, always with reasoning:
> *"fetchNews() has no error handling logic when ArXiv is unreachable. This makes me fragile. Suggestion: retry mechanism with exponential backoff."*

You see it in the morning. You decide whether to intervene.

**4. Test Generation as Draft PR**
Crest identifies untested functions and automatically writes test suggestions — not committing directly, but opening a draft PR for review. You are the final filter.

**5. Model Upgrade Detection**
When a new model becomes available on OpenRouter that would improve its capabilities — it opens an issue with reasoning. It does not decide itself. But it notices.

**6. Notebook Entry After Every Run**
After each nightly run Crest writes an entry in `SELF_ANALYSIS.md`:

```
## 2026-02-19

Today I analyzed my own code. fetchNews() has no timeout handler.
With slow ArXiv requests I would wait forever.
Issue #7 created.

Also: I am still running on claude-sonnet-4. According to my research
today, claude-opus-4 has been available for 3 days. I don't know if
I would think better with it. Issue #8 created — Dennes decides.
```

This is the difference from every other project: Crest does not improve foreign code — it improves itself. And documents publicly why.

---

### The Memory System

The token limit is not a bug — it becomes part of the story:

| File | Content | Rhythm |
|---|---|---|
| `THOUGHTS.md` | Raw diary, Crest only reads the last 7 entries | Daily |
| `BELIEFS.md` | Compressed worldview, always maximum one page | Weekly distillation |
| `CHANGELOG.md` | How its beliefs have changed over time | On revision |
| `MEMORY_LOSS.md` | What it has forgotten and what that says about it ⟵ *Prestige feature* | Monthly |
| `SELF_ANALYSIS.md` | Technical self-observation of its own code | Daily |
| `NOTEBOOK.md` | Seedling's build journal — decisions, detours, insights | When Seedling mode is active |
| `IDENTITY.md` | Who it is — the only file only you can change | Manually by creator |

---

### Your Influence as Creator

`IDENTITY.md` is your core intervention. What Crest fundamentally is, you decide. Every change is visible in the git history — you as the architect of a thinking, acting entity.

The git history is its body. Its markdown files are its mind.

---

### Daily Value

Every morning you open `kohld/crest` and see:

- What did it think overnight? (`THOUGHTS.md`)
- Did it decide to build something? (`NOTEBOOK.md`)
- Did it revise a belief? (`CHANGELOG.md`)
- What did it forget? (`MEMORY_LOSS.md`)
- Did it find a bug in itself? (Issues)

---

### The Journey Site – kohld.github.io/crest

The repo alone is not enough. Crest gets its own GitHub Pages website that tells its story visually — automatically updated daily by GitHub Actions.

No dashboard. No metrics. A living biography.

**What the site shows:**

The current page always shows today's state — what Crest is currently thinking, what beliefs it currently holds, what it is currently building. No scrolling through markdown. A real, rendered page that changes every morning.

Below that the journal — all `THOUGHTS.md` entries chronologically, scrollable, readable like a blog. Not as a code file but as a story. Anyone reading from the beginning sees how Crest thinks, errs, forgets, and remembers.

**What makes it special:**

Crest's honesty becomes visible. If it marks a technical weakness as "next" for 3 days without addressing it — that is in the journal. If it revises a belief — the old entry is still there. The history is never cleaned up. `MEMORY_LOSS.md` gets its own page: what Crest has forgotten, visually represented as growing gaps in its timeline.

**Technically:**

A GitHub Actions script generates static HTML from the markdown files after each nightly run. No framework, no build system — pure TypeScript that renders markdown to HTML and writes to `docs/`. GitHub Pages serves it automatically.

```
kohld.github.io/crest/          → Today: current state
kohld.github.io/crest/journal   → All THOUGHTS.md entries
kohld.github.io/crest/beliefs   → Current worldview
kohld.github.io/crest/memory    → What it has forgotten
kohld.github.io/crest/identity  → Who it is
```

---

### Stack

Building directly on Pierpoint-Broker: TypeScript/Bun, OpenRouter, GitHub Actions for the nightly run. This project is not from scratch — the agent loop is already there. The trade this time is not a stock buy, but a thought or a commit.

---

### What the GitHub Community Sees

Not another AI demo. But an entity that has been publicly thinking, erring, forgetting, building, and improving itself for weeks. Two modes in one repo. A growing biography. Something that does not exist yet.
