/**
 * Orchestrator: discover → fetch → (optional AI extract) → normalize → verify → dedupe/upsert → change-detect → expire.
 * Idempotent per run key; polling is adaptive and never more frequent than MIN_POLL_MINUTES.
 */
import { adapterFor, type RawItem, type SourceRow } from "./adapters.server";
import { AiStop, aiExtract } from "./ai-extract.server";
import { mergeAi } from "./mapping";
import { canonicalizeUrl, contentHash, deriveTags, detectCity, detectMode, normalizeOrganizer, normalizeText } from "./normalize";
import { detectChanges, isExpired, isSameOpportunity, MIN_POLL_MINUTES, nextPollMinutes, verifyCandidate } from "./verify";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
const SNAP = "id,content_hash,deadline,start_date,location,city,mode,prize_pool,stipend,application_url,canonical_url,normalized_organizer,normalized_title";

/** Fields the gate needs; when any is missing the bounded AI stage may try to fill it from evidence. */
function needsAi(it: RawItem): boolean {
  if (!it.description || it.description.length < 40) return false;
  if (!it.organizer || !it.location) return true;
  return it.kind === "hackathon" ? !it.deadline && !it.startDate : !it.role;
}

/** Bounded, optional AI stage. Disabled with INGEST_AI_ENABLED=0; max items via INGEST_AI_MAX (default 5, cap 25). */
export async function aiStage(items: RawItem[]): Promise<{ items: RawItem[]; used: number; note: string | null }> {
  if (process.env["INGEST_AI_ENABLED"] === "0" || !process.env["LOVABLE_API_KEY"]) return { items, used: 0, note: null };
  const max = Math.min(25, Math.max(0, Number(process.env["INGEST_AI_MAX"] ?? 5) || 0));
  let used = 0;
  const out: RawItem[] = [];
  for (const it of items) {
    if (used >= max || !needsAi(it)) { out.push(it); continue; }
    const evidence = `${it.title}\n${it.organizer ?? ""}\n${it.location ?? ""}\n${it.description}`;
    try {
      used++;
      const ai = await aiExtract(evidence);
      out.push(ai ? mergeAi(it, ai, evidence) : it);
    } catch (e) {
      if (e instanceof AiStop) return { items: [...out, it, ...items.slice(out.length + 1)], used, note: e.message };
      out.push(it);
    }
  }
  return { items: out, used, note: null };
}

export interface RunOptions { trigger: string; idempotencyKey?: string | null; skipAi?: boolean }

export async function processItems(admin: Admin, src: SourceRow, rawItems: RawItem[], allowed: string[], opts: RunOptions) {
  const started = Date.now();
  const { data: run, error: runErr } = await admin
    .from("ingestion_runs")
    .insert({ source_id: src.id, trigger: opts.trigger, idempotency_key: opts.idempotencyKey ?? null })
    .select("id")
    .single();
  if (runErr?.code === "23505") return { duplicateRun: true as const };
  if (!run) throw new Error(`could not start run: ${runErr?.message}`);

  const ai = opts.skipAi ? { items: rawItems, used: 0, note: null } : await aiStage(rawItems);
  const c = { fetched: rawItems.length, inserted: 0, updated: 0, rejected: 0, duplicates: 0, accepted: 0, needs_verification: 0 };
  const errors: string[] = ai.note ? [ai.note] : [];
  const seen = new Set<string>();
  const today = new Date().toISOString().slice(0, 10);

  for (const it of ai.items) {
    try {
      const canonical = canonicalizeUrl(it.url);
      const gate = verifyCandidate({
        kind: it.kind, title: it.title, organizer: it.organizer, url: it.url, applicationUrl: it.applicationUrl ?? null,
        role: it.role ?? null, location: it.location, mode: it.mode ?? null, startDate: it.startDate ?? null,
        endDate: it.endDate ?? null, deadline: it.deadline, evidence: it.evidence,
      }, allowed);
      if (gate.status === "rejected" || !canonical) { c.rejected++; continue; }
      if (seen.has(canonical)) { c.duplicates++; continue; }
      seen.add(canonical);
      if (gate.status === "needs_verification") c.needs_verification++;

      const text = `${it.title} ${it.description ?? ""} ${it.location ?? ""}`;
      const row = {
        kind: it.kind, title: it.title.slice(0, 300), organizer: it.organizer!.slice(0, 200),
        normalized_title: normalizeText(it.title), normalized_organizer: normalizeOrganizer(it.organizer!),
        source_id: src.id, source_name: src.name, source_url: it.url, canonical_url: canonical,
        application_url: it.applicationUrl ?? null, summary: it.description?.slice(0, 280) ?? null, description: it.description,
        location: it.location, city: detectCity(text), mode: it.mode ?? detectMode(text),
        start_date: it.startDate ?? null, end_date: it.endDate ?? null, deadline: it.deadline, posted_at: it.publishedAt,
        fee: it.fee ?? null, prize_pool: it.prize ?? null, stipend: it.stipend ?? null, role: it.role ?? null,
        eligibility: it.eligibility ?? [], tags: it.tags?.length ? it.tags : deriveTags(text),
        verification_status: gate.status, verification_reasons: gate.reasons,
        status: isExpired({ deadline: it.deadline, end_date: it.endDate ?? null }, today) ? "expired" : "active",
        evidence_json: (it.evidence ?? null) as never,
        raw_source_hash: await contentHash([JSON.stringify(it.evidence ?? null)]),
      };
      const content_hash = await contentHash([row.title, row.organizer, row.description, row.deadline, row.start_date, row.location, row.stipend, row.prize_pool, row.application_url]);
      const now = new Date().toISOString();

      // Dedupe: canonical URL first, then normalized organizer+title with date agreement.
      let { data: ex } = await admin.from("opportunities").select(SNAP).eq("canonical_url", canonical).maybeSingle();
      if (!ex) {
        const { data: cands } = await admin.from("opportunities").select(SNAP)
          .eq("normalized_organizer", row.normalized_organizer).eq("normalized_title", row.normalized_title).limit(10);
        ex = (cands ?? []).find((x) => isSameOpportunity(x, row)) ?? null;
      }
      if (ex) {
        c.duplicates++;
        if (ex.content_hash === content_hash) {
          await admin.from("opportunities").update({ last_checked_at: now }).eq("id", ex.id);
          continue;
        }
        const changes = detectChanges(ex, { ...row, content_hash });
        await admin.from("opportunities").update({
          ...row, canonical_url: ex.canonical_url, content_hash, last_checked_at: now, updated_at: now,
          ...(changes.length ? { last_change_at: now, last_change_summary: changes.map((x) => x.change_type).join(", ") } : {}),
        }).eq("id", ex.id);
        if (changes.length) await admin.from("opportunity_changes").insert(changes.map((x) => ({ ...x, opportunity_id: ex!.id, run_id: run.id })));
        c.updated++;
      } else {
        const { data: ins, error } = await admin.from("opportunities").insert({ ...row, content_hash, last_checked_at: now }).select("id").single();
        if (error || !ins) { c.rejected++; errors.push(`insert failed: ${error?.message ?? "unknown"}`); continue; }
        c.inserted++;
        await admin.from("opportunity_changes").insert({ opportunity_id: ins.id, run_id: run.id, change_type: "new", new_value: row.title });
      }
      if (gate.status === "verified") c.accepted++;
    } catch (e) {
      c.rejected++;
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  const expired = await expireListings(admin, run.id);
  const fin = new Date().toISOString();
  const productive = c.inserted + c.updated > 0;
  const empty = productive ? 0 : src.consecutive_empty_runs + 1;
  await admin.from("ingestion_runs").update({
    ...c, expired, status: "success", finished_at: fin, duration_ms: Date.now() - started, errors: errors.slice(0, 20),
    error: errors[0] ?? null,
  }).eq("id", run.id);
  await admin.from("source_registry").update({
    status: "ready", enabled: true, requirement: null, last_run_at: fin, last_success_at: fin, last_error: null,
    last_counts: { ...c, expired, ai_used: ai.used }, consecutive_empty_runs: empty,
    next_run_at: new Date(Date.now() + nextPollMinutes(src.poll_interval_minutes, empty) * 60_000).toISOString(),
  }).eq("id", src.id);
  return { ...c, expired, ai_used: ai.used, run_id: run.id };
}

/** Safe expiry: a stated past deadline, or (without deadline) a stated past end date. Unknown dates never expire. */
export async function expireListings(admin: Admin, runId?: string) {
  const today = new Date().toISOString().slice(0, 10);
  const a = await admin.from("opportunities").update({ status: "expired" }).eq("status", "active").lt("deadline", today).select("id,deadline");
  const b = await admin.from("opportunities").update({ status: "expired" }).eq("status", "active").is("deadline", null).lt("end_date", today).select("id,end_date");
  const rows = [...(a.data ?? []).map((d) => ({ id: d.id, v: d.deadline })), ...(b.data ?? []).map((d) => ({ id: d.id, v: d.end_date }))];
  if (rows.length) await admin.from("opportunity_changes").insert(rows.map((d) => ({ opportunity_id: d.id, run_id: runId ?? null, change_type: "expired", old_value: d.v })));
  return rows.length;
}

export async function runSource(admin: Admin, src: SourceRow, opts: RunOptions) {
  const a = adapterFor(src);
  const missing = a.missingRequirement();
  if (missing) {
    await admin.from("source_registry").update({
      enabled: false, status: src.status === "disabled" ? "disabled" : "not_configured", requirement: missing,
    }).eq("id", src.id);
    return { status: "NOT_CONFIGURED" as const, reason: missing };
  }
  try {
    return await processItems(admin, src, await a.fetchItems(), a.allowedDomains(), opts);
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    const at = new Date().toISOString();
    await admin.from("ingestion_runs").insert({ source_id: src.id, trigger: opts.trigger, status: "error", error: msg, finished_at: at });
    await admin.from("source_registry").update({
      status: "error", last_error: msg, last_run_at: at,
      next_run_at: new Date(Date.now() + MIN_POLL_MINUTES * 60_000).toISOString(),
    }).eq("id", src.id);
    return { status: "error" as const, error: msg };
  }
}

/** True when a source is due under adaptive polling (never more often than MIN_POLL_MINUTES). */
export function isDue(src: Pick<SourceRow, "last_run_at" | "next_run_at" | "poll_interval_minutes">, now = Date.now()): boolean {
  if (src.last_run_at && now - new Date(src.last_run_at).getTime() < MIN_POLL_MINUTES * 60_000) return false;
  if (src.next_run_at) return now >= new Date(src.next_run_at).getTime();
  return !src.last_run_at || now - new Date(src.last_run_at).getTime() >= Math.max(MIN_POLL_MINUTES, src.poll_interval_minutes) * 60_000;
}

export async function runIngestion(admin: Admin, opts: { force?: boolean; sourceId?: string; trigger?: string } = {}) {
  let q = admin.from("source_registry").select("*").order("priority");
  if (opts.sourceId) q = q.eq("id", opts.sourceId);
  const { data: sources } = await q;
  const out: Record<string, unknown> = {};
  const hour = new Date().toISOString().slice(0, 13);
  for (const s of sources ?? []) {
    if (!opts.force && !isDue(s)) { out[s.id] = { status: "not_due", next_run_at: s.next_run_at }; continue; }
    const trigger = opts.trigger ?? (opts.force ? "manual" : "poll");
    // Polls are idempotent per source per hour; manual runs get their own key.
    const idem = opts.force ? `${trigger}:${s.id}:${Date.now()}` : `poll:${s.id}:${hour}`;
    out[s.id] = await runSource(admin, s, { trigger, idempotencyKey: idem });
  }
  return { sources: out, expired: await expireListings(admin) };
}
