import { getAdapters, type RawItem } from "./adapters.server";
import {
  canonicalizeUrl,
  contentHash,
  deriveTags,
  detectCity,
  detectMode,
  normalizeOrganizer,
  normalizeText,
} from "./normalize";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

async function normalize(item: RawItem, sourceId: string, sourceName: string) {
  const canonical = canonicalizeUrl(item.url);
  if (!canonical) return null; // validate
  if (/example\.(com|org|net)/i.test(canonical)) return null; // never store sample URLs
  if (!item.organizer || item.title.length < 4) return null;
  const text = `${item.title} ${item.description ?? ""} ${item.location ?? ""}`;
  const row = {
    kind: item.kind,
    title: item.title.slice(0, 300),
    organizer: item.organizer.slice(0, 200),
    normalized_title: normalizeText(item.title),
    normalized_organizer: normalizeOrganizer(item.organizer),
    source_id: sourceId,
    source_name: sourceName,
    source_url: item.url,
    canonical_url: canonical,
    summary: item.description ? item.description.slice(0, 280) : null,
    description: item.description,
    location: item.location,
    city: detectCity(text),
    mode: detectMode(text),
    deadline: item.deadline,
    posted_at: item.publishedAt,
    tags: deriveTags(text),
  };
  const content_hash = await contentHash([row.title, row.organizer, row.description, row.deadline, row.location]);
  return { ...row, content_hash };
}

/** verify: the canonical page must still resolve. */
async function verify(url: string): Promise<"verified" | "failed"> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    return res.ok || res.status === 405 ? "verified" : "failed";
  } catch {
    return "failed";
  }
}

export async function runIngestion(admin: Admin) {
  const { data: sources } = await admin.from("source_registry").select("id,name");
  const names = new Map((sources ?? []).map((s) => [s.id, s.name]));
  const summary: Record<string, unknown> = {};

  for (const adapter of getAdapters()) {
    const missing = adapter.missingRequirement();
    if (missing) {
      await admin.from("source_registry").update({ enabled: false, status: "not_configured", requirement: missing, updated_at: new Date().toISOString() }).eq("id", adapter.id);
      summary[adapter.id] = { skipped: missing };
      continue;
    }
    const { data: run } = await admin.from("ingestion_runs").insert({ source_id: adapter.id }).select("id").single();
    const counts = { fetched: 0, inserted: 0, updated: 0, rejected: 0 };
    try {
      const items = await adapter.fetchItems();
      counts.fetched = items.length;
      const seen = new Set<string>();
      for (const item of items) {
        const row = await normalize(item, adapter.id, names.get(adapter.id) ?? adapter.id);
        if (!row || seen.has(row.canonical_url)) {
          counts.rejected++;
          continue;
        }
        seen.add(row.canonical_url);
        // dedupe: same URL, or same organiser + title from another listing
        const { data: existing } = await admin
          .from("opportunities")
          .select("id,content_hash")
          .or(`canonical_url.eq.${row.canonical_url},and(normalized_organizer.eq."${row.normalized_organizer.replace(/"/g, "")}",normalized_title.eq."${row.normalized_title.replace(/"/g, "")}")`)
          .limit(1)
          .maybeSingle();
        const now = new Date().toISOString();
        if (existing) {
          if (existing.content_hash === row.content_hash) {
            await admin.from("opportunities").update({ last_checked_at: now }).eq("id", existing.id);
          } else {
            const verification_status = await verify(row.canonical_url);
            await admin.from("opportunities").update({ ...row, verification_status, last_checked_at: now, updated_at: now }).eq("id", existing.id);
            counts.updated++;
          }
        } else {
          const verification_status = await verify(row.canonical_url);
          const { error } = await admin.from("opportunities").insert({ ...row, verification_status });
          if (error) counts.rejected++;
          else counts.inserted++;
        }
      }
      const { data: expired } = await admin.rpc("expire_opportunities");
      await admin.from("ingestion_runs").update({ ...counts, expired: expired ?? 0, status: "success", finished_at: new Date().toISOString() }).eq("id", run!.id);
      await admin.from("source_registry").update({ enabled: true, status: "ready", requirement: null, last_success_at: new Date().toISOString(), last_error: null }).eq("id", adapter.id);
      summary[adapter.id] = counts;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin.from("ingestion_runs").update({ ...counts, status: "error", error: msg, finished_at: new Date().toISOString() }).eq("id", run!.id);
      await admin.from("source_registry").update({ status: "error", last_error: msg }).eq("id", adapter.id);
      summary[adapter.id] = { error: msg };
    }
  }
  const { data: expired } = await admin.rpc("expire_opportunities");
  return { sources: summary, expired };
}
