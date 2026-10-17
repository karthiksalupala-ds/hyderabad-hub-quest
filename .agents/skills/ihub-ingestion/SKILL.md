---
name: ihub-ingestion
description: Use when changing iHub's opportunity-source adapters, feeds, verification, normalization, deduplication, adaptive polling, expiry, webhooks, source registry behavior, or scheduled ingestion workflow.
---

# iHub Opportunity Ingestion Engineering

## Read first

- `src/lib/ingestion/adapters.server.ts`
- `src/lib/ingestion/pipeline.server.ts`
- `src/lib/ingestion/verify.ts`
- `src/lib/ingestion/normalize.ts`
- `src/lib/ingestion/mapping.ts`
- Relevant tests in `src/lib/ingestion/*.test.ts`
- `.github/workflows/ingestion.yml` and the API/webhook route being changed

## Required invariants

1. **Enabled state is authoritative.** Disabled sources are skipped for scheduled, manual/forced, and webhook-triggered ingestion. A successful run must never automatically re-enable a source. Missing credentials/configuration should surface status without overriding the operator's enable/disable choice.
2. **Use permitted sources.** Prefer official APIs, documented feeds, or authorized provider integrations. Never add unauthorized LinkedIn/Internshala scraping, anti-bot bypasses, or credential/session reuse.
3. **Validate source data.** Treat network responses as untrusted. Validate URL scheme/host and fields; reject placeholders; keep evidence/provenance for verification. Null means unknown—not a value to guess.
4. **Normalize and deduplicate.** Canonicalize URLs and stable fields before upsert. Repeated webhook delivery or polling should be idempotent.
5. **Preserve change/expiry behavior.** Don't treat an omitted source field as a confirmed deletion or field change. Expire only under the existing freshness/verification rules.
6. **Keep polling adaptive.** Respect `next_run_at`, configured interval, backoff, and the one-hour minimum. Scheduler ticks must not force every source to fetch each hour.
7. **Protect secrets.** Adapter credentials, service-role keys, webhook secrets, and `INGEST_SECRET` must remain server-side. Never place them in browser code or logs.
8. **Protect webhook paths.** Authenticate before processing, validate source identity and event status, reject disabled or unknown sources, and preserve replay/idempotency controls.
9. **No schema drift.** Do not modify Supabase migrations, RLS policies, schema, or generated types unless explicitly requested.

## Implementation workflow

1. Trace the flow from adapter output through normalization, evidence verification, dedupe/upsert, change detection, and final run status before editing.
2. Update the narrowest shared helper rather than duplicating validation across adapters.
3. Add or update deterministic tests for the exact regression (for example host lookalikes, ambiguous dates, disabled source behavior, missing fields, duplicate events, or backoff).
4. Run all four checks: `bun run lint`, `bun run test`, `bun run typecheck`, `bun run build`.
5. Review the diff and state which paths were tested. Do not claim a real provider or deployed DB was exercised unless it actually was.

## Done means

- Valid data can flow through the existing pipeline without weakening validation.
- Disabled-source choices remain respected.
- Retries remain safe/idempotent.
- Missing facts are not fabricated.
- No secrets, unauthorized-source behavior, or unrequested schema changes were introduced.
