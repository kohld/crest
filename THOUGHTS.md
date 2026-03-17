## 2025-03-17 — Issue #1: Implement missing 'act' and 'site' modes or update usage string

**Problem:** The issue claimed that index.ts listed `--mode <think|act|self-analysis|site>` in the usage message but the switch statement only handled 'think' and 'self-analysis', causing 'Unknown mode' errors for 'act' and 'site'.

**Outcome:** Upon inspection, the switch statement already includes cases for 'act' (calling seedling()) and 'site' (calling buildSite()). The usage string is accurate. Running `--mode act` and `--mode site` works correctly—Seedling mode processed the issue itself, and site mode generated the documentation site. No code changes were needed; the issue was based on a misunderstanding of the current state.

**Learned:** Always verify the actual code before assuming discrepancies. The implementation was already complete; the issue resolved itself through Seedling mode's autonomous action.