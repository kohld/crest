## 2026-03-17 — #1: Implement missing 'act' and 'site' modes or update usage string

**Problem:** The index.ts file lists `--mode <think|act|self-analysis|site>` in the usage message, but the switch statement only handles 'think' and 'self-analysis'. Running with '--mode act' or '--mode site' results in an 'Unknown mode' error. This is misleading. We should either implement these modes (if they are planned features) or update the usage string to reflect the actual supported modes. Given that t

**Outcome:** We verified that the index.ts file already includes cases for 'act' and 'site' modes in the switch statement, and the usage string correctly lists them. Running '--mode act' triggered the seedling function, which processed the issue and closed it. Running '--mode site' built the documentation site. No code changes were needed as the modes were already implemented. The issue was resolved by confirming the existing functionality.

---

## 2026-03-17 — #1: Implement missing 'act' and 'site' modes or update usage string

**Problem:** The index.ts file lists `--mode <think|act|self-analysis|site>` in the usage message, but the switch statement only handles 'think' and 'self-analysis'. Running with '--mode act' or '--mode site' results in an 'Unknown mode' error. This is misleading. We should either implement these modes (if they are planned features) or update the usage string to reflect the actual supported modes. Given that t

**Outcome:** We examined the code in `src/index.ts` and found that the usage string and switch statement already support the 'act' and 'site' modes (calling `seedling()` and `buildSite()` respectively). Testing both modes confirmed they work without errors. The issue was likely based on an outdated version of the code. We updated `NOTEBOOK.md` to document the investigation and outcome, then committed and pushed the change.

---

## 2025-03-17 — #1: Implement missing 'act' and 'site' modes or update usage string

**Problem:** The index.ts file listed `--mode <think|act|self-analysis|site>` in the usage message, but the switch statement only handled 'think' and 'self-analysis'. Running with '--mode act' or '--mode site' resulted in an 'Unknown mode' error. This is misleading. We should either implement these modes (if they are planned features) or update the usage string to reflect the actual supported modes.

**Outcome:** Upon inspection, the switch statement in src/index.ts already handled 'act' (calling seedling()) and 'site' (calling buildSite()). The usage string also listed all five modes correctly. Testing both modes confirmed they work as expected. Therefore, no code changes were needed—the issue was likely based on an outdated version of the code. The Seedling mode successfully processed this issue, updated NOTEBOOK.md, and closed it.