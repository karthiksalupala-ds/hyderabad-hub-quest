# Claude Code Instructions

This repository also provides shared coding-agent rules in `AGENTS.md`. Read that file first and follow its safety, validation, and Git workflow requirements.

For Claude Code, load the relevant skill from `.claude/skills/`:

- `repo-change-validation` — every repository change, code review, CI failure, or pull request.
- `ihub-ingestion` — ingestion adapters, source validation, verification, deduplication, adaptive polling, webhooks, and scheduled ingestion.
- `ihub-runtime-agent` — the student-facing Ask iHub runtime agent, its API, routing, evidence, model instructions, or matching.

Do not confuse the student-facing runtime `AGENT.md` and `SKILLS.md` with coding-agent guidance. Do not modify Supabase schema or migrations without explicit user instruction. Keep all skill copies under `.agents/skills/`, `.github/skills/`, and `.claude/skills/` synchronized.

Before proposing a merge, run `bun run lint`, `bun run test`, `bun run typecheck`, and `bun run build`; confirm the latest CI results rather than assuming success.
