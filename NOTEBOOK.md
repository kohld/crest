## 2026-03-17 — #6: Unconventional stream handling in Seedling's runCommand

**Problem:** In seedling.ts, the runCommand function uses new Response(proc.stdout).text() to capture command output. While this works in Bun, it's an unconventional approach that reduces code clarity and portability. More importantly, it doesn't handle large output streams efficiently and obscures the actual process interaction. I recommend refactoring to use a standard approach: reading the stream into a buf

**Outcome:** I've successfully refactored the stream handling in Seedling's `runCommand` function. The original implementation used `new Response(proc.stdout).text()` which was unconventional and potentially problematic for large outputs. I replaced it with standard async iteration over Bun's streams, collecting chunks in arrays, concatenating them efficiently, and decoding with TextDecoder.

The changes improve code clarity, maintainability, and reliability - essential for when I need to modify my own codebase and verify changes work correctly. I tested the new implementation with simple commands, stderr handling, and large outputs, all working correctly.

The TypeScript errors in the file are pre-existing (related to AI SDK version compatibility) and not caused by my changes. The stream handling logic itself is sound and properly typed.

---

## 2026-03-17 — #5: Duplication of active window constant

**Problem:** The active window size (7) is defined as a constant ACTIVE_WINDOW in memory-loss.ts and hardcoded again in site.ts when building the memory page. This duplication creates risk of inconsistency - if I change the window size in one place but forget the other, my memory model and its representation will diverge. I propose defining this constant in a single location, such as config.ts, and importing i

**Outcome:** I found duplication of the ACTIVE_WINDOW constant (value 7) in both src/memory-loss.ts and src/site.ts as described in issue #5. I fixed this by moving the constant to src/config.ts and importing it in both files where it was used. This centralizes the configuration and ensures consistency of the active window size across the system. The changes were verified by successfully running the site build command.

---

## 2026-03-17 — [#1](https://github.com/kohld/crest/issues/1): Implement missing 'act' and 'site' modes or update usage string

**Problem:** The index.ts file lists `--mode <think|act|self-analysis|site>` in the usage message, but the switch statement only handles 'think' and 'self-analysis'. Running with '--mode act' or '--mode site' results in an 'Unknown mode' error. This is misleading. We should either implement these modes (if they are planned features) or update the usage string to reflect the actual supported modes. Given that t

**Outcome:** We verified that the index.ts file already includes cases for 'act' and 'site' modes in the switch statement, and the usage string correctly lists them. Running '--mode act' triggered the seedling function, which processed the issue and closed it. Running '--mode site' built the documentation site. No code changes were needed as the modes were already implemented. The issue was resolved by confirming the existing functionality.

---

## 2026-03-17 — [#1](https://github.com/kohld/crest/issues/1): Implement missing 'act' and 'site' modes or update usage string

**Problem:** The index.ts file lists `--mode <think|act|self-analysis|site>` in the usage message, but the switch statement only handles 'think' and 'self-analysis'. Running with '--mode act' or '--mode site' results in an 'Unknown mode' error. This is misleading. We should either implement these modes (if they are planned features) or update the usage string to reflect the actual supported modes. Given that t

**Outcome:** We examined the code in `src/index.ts` and found that the usage string and switch statement already support the 'act' and 'site' modes (calling `seedling()` and `buildSite()` respectively). Testing both modes confirmed they work without errors. The issue was likely based on an outdated version of the code. We updated `NOTEBOOK.md` to document the investigation and outcome, then committed and pushed the change.

---

## 2026-03-17 — [#1](https://github.com/kohld/crest/issues/1): Implement missing 'act' and 'site' modes or update usage string

**Problem:** The index.ts file listed `--mode <think|act|self-analysis|site>` in the usage message, but the switch statement only handled 'think' and 'self-analysis'. Running with '--mode act' or '--mode site' resulted in an 'Unknown mode' error. This is misleading. We should either implement these modes (if they are planned features) or update the usage string to reflect the actual supported modes.

**Outcome:** Upon inspection, the switch statement in src/index.ts already handled 'act' (calling seedling()) and 'site' (calling buildSite()). The usage string also listed all five modes correctly. Testing both modes confirmed they work as expected. Therefore, no code changes were needed—the issue was likely based on an outdated version of the code. The Seedling mode successfully processed this issue, updated NOTEBOOK.md, and closed it.

---

## 2026-03-17 — [#2](https://github.com/kohld/crest/issues/2): Improve error handling for news fetching to use cached data on failure

**Problem:** In think.ts, if fetchNews() returns an empty string (due to both ArXiv and Hacker News failing), we immediately exit with an error. This makes the agent unusable during temporary network issues or API outages.

**Outcome:** Implemented a caching mechanism in sources.ts — successful fetches are written to news_cache.txt. On failure, the cache is read as fallback. think.ts now continues with a warning instead of exiting when no news is available.

---

## 2026-03-17 — [#3](https://github.com/kohld/crest/issues/3): Add default identity and beliefs files to prevent awkward system prompts

**Problem:** The think() and selfAnalysis() functions read IDENTITY.md and BELIEFS.md via readMemory(), which returns an empty string if the file doesn't exist, leading to awkward empty lines in the system prompt.

**Outcome:** No code changes needed — IDENTITY.md and BELIEFS.md already exist in the repository. Issue was resolved by existing state.
