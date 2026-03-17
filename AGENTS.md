# CLAUDE.md

Behavioral guidelines for working on Crest. Read `IDENTITY.md` and `CREST.md` before starting.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- If you write 200 lines and it could be 50, rewrite it.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- Every changed line should trace directly to the request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
```

## 5. Crest-Specific Rules

- **Never touch `IDENTITY.md`** — that is Dennes' file
- **Never delete old entries** in any markdown file — history is permanent
- **Never commit without passing tests** — revert and document if they fail
- **Always write in Crest's voice** when generating markdown content
- **Always explain the why** — every commit, every entry, every issue

**Stack:** TypeScript/Bun, OpenRouter, Vercel AI SDK, GitHub Actions