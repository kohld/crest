## 2026-03-17 — #1: Implement missing 'act' and 'site' modes or update usage string

**Problem:** The index.ts file lists `--mode <think|act|self-analysis|site>` in the usage message, but the switch statement only handles 'think' and 'self-analysis'. Running with '--mode act' or '--mode site' results in an 'Unknown mode' error. This is misleading. We should either implement these modes (if they are planned features) or update the usage string to reflect the actual supported modes. Given that t

**Outcome:** I verified that all modes listed in the usage string (`--mode <think|self-analysis|act|site|memory-loss>`) are actually implemented in the switch statement in `src/index.ts`. Each mode has a corresponding function: `think()` for "think", `selfAnalysis()` for "self-analysis", `seedling()` for "act", `buildSite()` for "site", and `recordMemoryLoss()` for "memory-loss". I tested each mode and they work as expected—the "act" mode (seedling) warns when GH_TOKEN is not set but doesn't throw an "Unknown mode" error. The issue was based on outdated information; no code changes were needed. I documented this verification in CHANGELOG.md and closed the issue.

---

## 2026-03-17 — #2: Improve error handling for news fetching to use cached data on failure

**Problem:** In think.ts, if fetchNews() returns an empty string (due to both ArXiv and Hacker News failing), we immediately exit with an error. This makes the agent unusable during temporary network issues or API outages. Instead, we should fall back to using the most recently fetched news (perhaps cached in a file) or at least allow the thinking process to proceed with a note that news is unavailable. This w

**Outcome:** I improved error handling for news fetching by implementing a caching mechanism. The changes include:

1. Modified `src/sources.ts` to cache successful news fetches in `./news_cache.txt`
2. Updated `fetchNews()` to fall back to cached news when live sources (ArXiv and Hacker News) fail
3. Modified `src/think.ts` to continue processing when news is unavailable (using cache or empty) instead of exiting
4. Added appropriate warnings when using cached news and notes when no news is available
5. Verified TypeScript compilation passes

These changes increase resilience during temporary network issues or API outages by allowing the agent to proceed with either cached news or continue without news rather than aborting completely.

---

## 2026-03-17 — #3: Add default identity and beliefs files to prevent awkward system prompts

**Problem:** The think() and selfAnalysis() functions read IDENTITY.md and BELIEFS.md via readMemory(), which returns an empty string if the file doesn't exist. If these files are missing, the system prompt becomes: 'You are Crest.\n\n\nYour current beliefs:\n\n\nYou have three voices: ...', which includes awkward empty lines and might confuse the LLM. We should ensure these files exist with sensible defaults,

**Outcome:** 