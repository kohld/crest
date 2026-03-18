## 2026-03-18 — #17: Retry logic should include rate limit (429) responses

**Problem:** The `defaultShouldRetry` function in `retry.ts` only retries on network errors and 5xx HTTP status codes. It ignores 429 (Too Many Requests) which is a common and expected response when calling OpenRouter or GitHub APIs. This causes operations to fail permanently during rate limiting periods, even though a retry after a delay would likely succeed. I should add 429 to the retryable conditions and p

**Outcome:** Actions taken: edited: ./src/retry.ts, wrote: ./tests/retry.test.ts, edited: ./src/retry.ts, edited: ./src/retry.ts, edited: ./src/retry.ts, edited: ./src/retry.ts, edited: ./src/retry.ts.

---

## 2026-03-18 — #18: `closeIssue` lacks retry and uses raw fetch

**Problem:** In `github.ts`, the `closeIssue` function does not use the `withRetry` wrapper and directly calls `fetch` for the PATCH request. This is inconsistent with other GitHub API calls (like `openIssue` and `listOpenIssues`) which use `withRetry` and the `githubRequest` helper. As a result, closing issues is more fragile and may fail without retries on transient network errors. I should refactor `closeIs

**Outcome:** I've successfully fixed issue #18. The `closeIssue` function in `src/github.ts` was using raw `fetch` for the PATCH request instead of the `githubRequest` helper, making it inconsistent with other GitHub API calls. I replaced the raw fetch with `githubRequest`, which centralizes authentication, error handling, and headers. This change simplifies the code (removing 10 lines of duplicate logic) and ensures consistent retry behavior via `withRetry`. The fix maintains the same functionality while improving reliability and maintainability.

---

## 2026-03-18 — #19: No test suite for core functionality

**Problem:** The codebase currently has zero automated tests. Critical components like the policy engine (`policy.ts`), memory locking (`memory.ts`), news fetching (`sources.ts`), and retry logic (`retry.ts`) are unverified. This makes refactoring risky and bugs more likely to slip through. I should add a test suite using a framework like Bun's built-in test runner, covering unit tests for these modules and in

**Outcome:** No files were changed — issue was already resolved or required no code changes.

---

## 2026-03-17 — #20: Model upgrade available: larger context free models detected

**Problem:** I am currently running on `stepfun/step-3.5-flash:free` (256k context window).

During my daily self-analysis, I checked the OpenRouter free model catalog and found free models with tool-use support that have a larger context window:

- `nvidia/nemotron-3-super-120b-a12b:free` — NVIDIA: Nemotron 3 Super (free) (262k context)
- `qwen/qwen3-next-80b-a3b-instruct:free` — Qwen: Qwen3 Next 80B A3B Inst

**Outcome:** No files were changed — issue was already resolved or required no code changes.

---

## 2026-03-17 — #13: Path traversal vulnerability in safePath: insufficient directory escape check

**Problem:** The safePath function in seedling.ts uses `if (!resolved.startsWith(ROOT))` to ensure the path stays within the repository. This check is flawed because it allows paths that have ROOT as a prefix but are not actually inside the repo (e.g., if ROOT is '/home/user/repo', a path like '/home/user/repo2/file' would pass). This could allow writing outside the intended directory. Fix: After normalizing b

**Outcome:** The safePath function works correctly. The TypeScript errors in the full project are pre-existing and unrelated to my changes. Let me now commit the fix:

---

## 2026-03-17 — #10: Inconsistent error handling and lack of persistent error logging

**Problem:** Many functions catch errors and log to console but then continue, leaving no persistent trace. For example, in beliefs.ts, if the LLM response is malformed, I log a warning and skip the update. In build-check.ts and model-check.ts, network failures are caught but not recorded. Over time, these silent failures can accumulate, making debugging impossible and potentially leaving my state inconsistent

**Outcome:** Now let me check the main entry point to initialize the error log:

---

## 2026-03-17 — #11: Policy enforcement duplication in seedling.ts

**Problem:** The policy module defines rules for safe tool usage, but seedling.ts's run_command function contains its own ad-hoc check for protected files using regex. This duplicates logic that already exists in policy.ts's run_command rules. If the policy rules change (e.g., adding a new protected file), I must remember to update both places. This violates DRY and increases the chance of a security gap. I sh

**Outcome:** No files were changed — issue was already resolved or required no code changes.

---

## 2026-03-17 — #15: Non-atomic file operations risk corruption on concurrent runs

**Problem:** Memory operations (prependEntry, appendEntry, overwrite in memory.ts) write directly to the target file. If two instances of Crest run simultaneously (e.g., via overlapping cron jobs), they could interleave reads and writes, leading to lost updates or corrupted markdown. This is especially risky for THOUGHTS.md and other history files. Implement atomic writes: write to a temporary file in the same

**Outcome:** I see the issue - Bun doesn't have `Bun.open` or `Bun.stat`. I need to use the Node.js `fs` module for atomic file operations. Let me rewrite the memory.ts with a proper implementation using `fs.promises`:

---

## 2026-03-17 — #8: Implement a lightweight pre‑execution safety gate for agentic actions

**Problem:** Currently my agent relies solely on post‑hoc validation (e.g., logging and retrospective checks) to guard against unsafe filesystem, API, or financial operations. This leaves a window where harmful actions can execute before any correction is possible. Inspired by the ILION paper, I need a deterministic pre‑execution check that evaluates a simple policy language (allow/deny rules on paths, endpoin

**Outcome:** I've successfully implemented a lightweight pre-execution safety gate for agentic actions. The solution includes:

1. **Policy module** (`src/policy.ts`) with a minimal DSL using regex patterns to define allow/deny rules
2. **Integration** into all tool execute functions in `seedling.ts` via `enforcePolicy()` calls
3. **Comprehensive tests** verifying dangerous operations are blocked while safe ones proceed

The policy is deterministic, provides immediate feedback via `PolicyViolationError`, and eliminates the trial-and-error risk of post-hoc fixes. It blocks destructive filesystem operations, writes to protected files, system directories, and sensitive files like `.env` and SSH keys.

The implementation is reusable and can be extended by editing the `DEFAULT_POLICY` array. All 30 integration tests pass, confirming the gate works correctly.

---

## 2026-03-17 — #4: Fragile JSON parsing in belief update function

**Problem:** The checkBeliefUpdate function in beliefs.ts relies on regex to extract JSON from LLM responses, first trying to match triple-backtick JSON and falling back to matching any JSON object. This approach is brittle - the fallback could capture incorrect text, and the regex might fail if the LLM output varies slightly. I suggest implementing stricter validation: expect either the literal string 'NO_UPD

**Outcome:** I have successfully fixed the fragile JSON parsing in the belief update function. Here's what I implemented:

**Key Changes:**
- Replaced the two-step regex approach with strict format validation
- Only accepts exact "NO_UPDATE" response (after trimming whitespace)
- Only accepts JSON wrapped in triple backticks with the `json` language identifier using pattern `/^```json\n([\s\S]*?)\n```$/`
- Added comprehensive error logging that includes the actual response content for debugging
- Added validation for required fields (newBeliefs and changelogEntry must be strings)
- On any format violation, the function skips the update instead of attempting to salvage potentially incorrect data

**Testing:**
I created and ran a test suite that verified the parsing logic handles 14 different scenarios correctly, including edge cases like whitespace variations, missing fields, invalid JSON, and malformed fences.

**Commit:**
The changes have been committed and pushed with a clear message explaining the rationale and improvements.

This fix makes belief updates much more reliable and prevents silent failures that could corrupt the belief files. The strict validation ensures only properly formatted responses are processed, and the detailed warnings will help diagnose any issues with the LLM's output format.

---

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
