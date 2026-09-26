---
name: plan-with-fable-implement-with-opus
description: Development workflow for this repo — when the user asks to build a new feature or to change, extend, refactor, or fix existing functionality, FIRST produce a concrete implementation plan using the Fable model, THEN implement that plan yourself with Opus, following the repo's conventions. Use this skill whenever the user requests feature work or a modification (add, build, create, implement, change, extend, refactor, fix, wire up, integrate a capability), even if they never say "plan" or name a model. Do NOT use it for pure questions, explanations, code reviews, or trivial one-line edits (a rename, a label, a copy tweak) where a planning round adds latency without value.
---

# Plan with Fable, implement with Opus

This repo's development flow deliberately splits a change across two models: **Fable plans, Opus
implements.** Fable is fast and good at reasoning about *what* to do and in what order; Opus is
strong at writing the code well. Keeping them separate means the plan gets real thought before a
single line is written, and the implementation follows a plan instead of improvising.

Apply this whenever the user asks for a new capability or a change to an existing one.

## The workflow

### 1. Plan with Fable

Delegate the planning to a **Fable** subagent — do not plan the implementation yourself at this
stage; the whole point is to get Fable's take first. Spawn the `Plan` agent with the Fable model:

```
Agent(
  subagent_type: "Plan",
  model: "fable",
  description: "Plan <short feature name>",
  prompt: "<the user's request, verbatim or lightly clarified>

           Plan the implementation for THIS repository. Return a concrete, step-by-step plan:
           the files to create/modify, the approach and order of changes, the unit + integration
           tests to add, and any DB migrations or cross-module ports needed. Do NOT write the
           code — only the plan."
)
```

Give the planner what it needs to be concrete, so its plan lands instead of floating:
- The exact request and any acceptance criteria the user stated.
- Where the relevant code lives — point it at the module/files/endpoints you already know, so it
  doesn't re-derive them.
- The repo's hard rules it must plan **around**, so the plan doesn't fight them. These live in the
  `CLAUDE.md` files (root, `backend/CLAUDE.md`, the relevant `frontend/apps/*/CLAUDE.md`): tests are
  mandatory (unit + integration), a Supabase migration accompanies every JPA/entity change,
  `ddl-auto` stays `validate`, no direct cross-module imports (ports & adapters), every endpoint
  guards its own role, Conventional-Commits messages, and never push without explicit confirmation.

A good plan names concrete files, the order of steps, the tests, and the verification commands. If
Fable's plan is vague, misses a repo rule, or is plainly wrong, send it back (`SendMessage` to the
same agent) with the gap named — don't silently paper over it, because the next request benefits
from Fable planning well.

### 2. Surface the plan

The subagent's plan is not shown to the user automatically — relay it, tightly: the key steps, the
files, the tests. For anything large, ambiguous, or destructive, pause for a nod before building;
for a clear, well-scoped plan, say what you're about to do and proceed.

### 3. Implement with Opus

Implement the plan yourself — this session is Opus. Follow the plan faithfully, but with judgment:
if a step turns out wrong or the plan missed something, adapt and say so rather than blindly
following a broken step.

Honor the repo's conventions while implementing (they're documented in the CLAUDE.md files and are
not optional):
- Write the unit + integration tests the plan calls for — no feature is "done" without them.
- Compile/typecheck and run the relevant tests before calling it done: backend
  `./mvnw clean test-compile` then the affected `mvn test`; each touched frontend app
  `pnpm exec tsc -b --noEmit`, `pnpm run test`, and eslint on changed files.
- Add a Supabase migration in the same change for any schema/entity change; keep `ddl-auto: validate`.
- Commit with Conventional-Commits, grouped by functionality. **Never `git push` without the user's
  explicit confirmation.**

### 4. Report

Tell the user what changed, what verification actually showed (tests passing/failing, with real
output — never claim green without running it), and that it's committed locally and waiting for
their go-ahead to push.

## When NOT to use this

Skip the Fable planning round for pure questions, explanations, code reviews, or trivial edits (a
rename, a label change, a one-line fix) where planning adds latency without value — just make the
change directly, still honoring the repo's test and commit rules.
