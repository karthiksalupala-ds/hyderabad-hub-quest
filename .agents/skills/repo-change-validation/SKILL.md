---
name: repo-change-validation
description: Use for any iHub coding task, code review, CI failure, route change, or before preparing a pull request. Guides safe repository discovery, focused edits, tests, and final diff review.
---

# iHub Repository Change and Validation

Use this skill for repository changes, reviews, or failing CI.

## Procedure

1. Read root `AGENTS.md`, inspect `git status`, the current branch, and the relevant files before editing.
2. Read the closest existing implementation and tests. Search references/usages before renaming public exports, route paths, environment names, or database fields.
3. Identify the smallest scope that solves the request. Avoid unrelated formatting, dependency changes, generated-code churn, or schema migrations.
4. For runtime/business logic, add a regression test before or alongside the fix. Prefer pure helper functions for deterministic tests.
5. Implement the change on a focused branch. Preserve current behavior outside the requested scope.
6. Run, in order:
   - `bun run lint`
   - `bun run test`
   - `bun run typecheck`
   - `bun run build`
7. If any check fails, open the failing job logs, fix the actual cause, and rerun all affected checks. Do not assume that a queued or in-progress job passed.
8. Inspect the final diff for credential leakage, data exposure, RLS assumptions, changes to migrations/generated types, stale docs, broken route registration, and unrelated files.
9. Open a pull request with scope, safety boundaries, and validation outcomes. Wait for the latest PR SHA's CI checks before merge.

## iHub-specific constraints

- Do not edit Supabase schema or migration files without an explicit user request.
- Never put secrets in `VITE_*` variables or client components.
- Don't treat demo records as real opportunities.
- Preserve permitted-source requirements, source enable/disable choices, evidence-backed verification, idempotency, deduplication, expiry, and adaptive polling.
- If deployment secrets, connected data, or external source access are unavailable, report the limitation instead of claiming end-to-end validation.
- Keep the runtime assistant's `AGENT.md`/`SKILLS.md` separate from coding-agent `AGENTS.md` and `.agents/skills/`.
