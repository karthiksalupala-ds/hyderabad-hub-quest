import { adapterFor, type RawItem, type SourceRow } from "./adapters.server";
import { canonicalizeUrl, contentHash, deriveTags, detectCity, detectMode, normalizeOrganizer, normalizeText } from "./normalize";
import { detectChanges, verifyCandidate } from "./verify";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

/** Process items for one source: validate → gate → dedupe → change-detect → upsert. */
export async function processItems(admin: Admin, src: SourceRow, items: RawItem[], allowed: string[], trigger: string) {
  const { data: run } = await admin.from("ingestion_runs").insert({ source_id: src.id, trigger }).select("id").single();
  const c = { fetched: items.length, inserted: 0, updated: 0, rejected: 0, duplicates: 0, accepted: 0 };
  const seen = new Set<string>();
  for (const it of items) {
    const canonical = canonicalizeUrl(it.url);
    const gate = verifyCandidate({ kind: it.kind, title: it.title, organizer: it.organizer, url: it.url, applicationUrl: it.applicationUrl ?? null, role: it.role ?? null, location: it.location, mode: it.mode ?? null, startDate: it.startDate ?? null, endDate: it.endDate ?? null, deadline: it.deadline }, allowed);
    if (gate.status === "rejected" || !canonical || seen.has(canonical)) { c.rejected++; continue; }
    seen.add(canonical);
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
      evidence_json: (it.evidence ?? null) as never,
      raw_source_hash: await contentHash([JSON.stringify(it.evidence ?? null)]),
    };
    const content_hash = await contentHash([row.title, row.organizer, row.description, row.deadline, row.location, row.stipend, row.prize_pool]);
    const now = new Date().toISOString();
    let { data: ex } = await admin.from("opportunities").select("id,content_hash,deadline,location,city,mode,prize_pool,stipend").eq("canonical_url", canonical).maybeSingle();
    if (!ex) ({ data: ex } = await admin.from("opportunities").select("id,content_hash,deadline,location,city,mode,prize_pool,stipend").eq("normalized_organizer", row.normalized_organizer).eq("normalized_title", row.normalized_title).limit(1).maybeSingle());
    if (ex) {
      c.duplicates++;
      if (ex.content_hash === content_hash) { await admin.from("opportunities").update({ last_checked_at: now }).eq("id", ex.id); continue; }
      const changes = detectChanges(ex, row);
      await admin.from("opportunities").update({ ...row, content_hash, last_checked_at: now, updated_at: now, last_change_at: changes.length ? now : null, last_change_summary: changes.map((x) => x.change_type).join(", ") || null }).eq("id", ex.id);
      if (changes.length) await admin.from("opportunity_changes").insert(changes.map((x) => ({ ...x, opportunity_id: ex!.id, run_id: run?.id })));
      c.updated++;
    } else {
      const { data: ins, error } = await admin.from("opportunities").insert({ ...row, content_hash }).select("id").single();
      if (error) { c.rejected++; continue; }
      c.inserted++;
      await admin.from("opportunity_changes").insert({ opportunity_id: ins.id, run_id: run?.id, change_type: "new", new_value: row.title });
    }
    if (gate.status === "verified") c.accepted++;
  }
  const expired = await expireListings(admin, run?.id);
  const fin = new Date().toISOString();
  await admin.from("ingestion_runs").update({ ...c, expired, status: "success", finished_at: fin }).eq("id", run!.id);
  await admin.from("source_registry").update({ status: "ready", enabled: true, requirement: null, last_run_at: fin, last_success_at: fin, last_error: null, last_counts: { ...c, expired } }).eq("id", src.id);
  return { ...c, expired };
}

export async function expireListings(admin: Admin, runId?: string) {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await admin.from("opportunities").update({ status: "expired" }).eq("status", "active").lt("deadline", today).select("id,deadline");
  if (data?.length) await admin.from("opportunity_changes").insert(data.map((d) => ({ opportunity_id: d.id, run_id: runId, change_type: "expired", old_value: d.deadline })));
  return data?.length ?? 0;
}

export async function runSource(admin: Admin, src: SourceRow, trigger: string) {
  const a = adapterFor(src);
  const missing = a.missingRequirement();
  if (missing) {
    await admin.from("source_registry").update({ enabled: false, status: src.status === "disabled" ? "disabled" : "not_configured", requirement: missing }).eq("id", src.id);
    return { skipped: missing };
  }
  try {
    return await processItems(admin, src, await a.fetchItems(), a.allowedDomains(), trigger);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin.from("ingestion_runs").insert({ source_id: src.id, trigger, status: "error", error: msg, finished_at: new Date().toISOString() });
    await admin.from("source_registry").update({ status: "error", last_error: msg, last_run_at: new Date().toISOString() }).eq("id", src.id);
    return { error: msg };
  }
}

/** Adaptive polling: only runs sources whose poll interval has elapsed. */
export async function runIngestion(admin: Admin, force = false) {
  const { data: sources } = await admin.from("source_registry").select("*").order("priority");
  const out: Record<string, unknown> = {};
  for (const s of sources ?? []) {
    const due = !s.last_run_at || Date.now() - new Date(s.last_run_at).getTime() >= s.poll_interval_minutes * 60_000;
    out[s.id] = force || due ? await runSource(admin, s, force ? "manual" : "poll") : { notDue: true };
  }
  return { sources: out, expired: await expireListings(admin) };
}
