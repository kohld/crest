## 2026-03-17 — #3: Add default identity and beliefs files to prevent awkward system prompts

**Problem:** The think() and selfAnalysis() functions read IDENTITY.md and BELIEFS.md via readMemory(), which returns an empty string if the file doesn't exist. If these files are missing, the system prompt becomes: 'You are Crest.\n\n\nYour current beliefs:\n\n\nYou have three voices: ...', which includes awkward empty lines and might confuse the LLM. We should ensure these files exist with sensible defaults,

**Outcome:** 