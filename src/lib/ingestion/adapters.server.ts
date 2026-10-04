import type { Tables } from "@/integrations/supabase/types";
import { mapRecord, type FieldMapping, type RawItem } from "./mapping";
import { canonicalizeUrl, stripHtml, toIsoDate } from "./normalize";
import { hostOf } from "./verify";

export type { RawItem } from "./mapping";
export type SourceRow = Tables<"source_registry">;

export interface SourceAdapter {
  id: string;
  /** null when runnable, otherwise a human-readable reason. */
  missingRequirement(): string | null;
  /** Domains whose links count as source-backed for this adapter. */
  allowedDomains(): string[];
  fetchItems(): Promise<RawItem[]>;
}

interface FeedConfig {
  url: string;
  kind: "hackathon" | "internship";
  organizer?: string;
}

function readFeeds(envName: string): FeedConfig[] {
  const raw = process.env[envName];
  if (!raw) return [];
  try {
    return (JSON.parse(raw) as FeedConfig[]).filter((f) => canonicalizeUrl(f.url) && (f.kind === "hackathon" || f.kind === "internship"));
  } catch {
    return [];
  }
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? stripHtml(m[1] ?? "") || null : null;
}

export function parseFeed(xml: string, cfg: FeedConfig): RawItem[] {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];
  const feedTitle = tag(xml.split(/<(item|entry)[\s>]/i)[0] ?? "", "title");
  const items: RawItem[] = [];
  for (const b of blocks) {
    const title = tag(b, "title");
    const url = tag(b, "link") ?? b.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? null;
    if (!title || !url) continue;
    items.push({
      kind: cfg.kind,
      title,
      organizer: cfg.organizer ?? tag(b, "author") ?? tag(b, "dc:creator") ?? feedTitle,
      url,
      description: tag(b, "description") ?? tag(b, "summary") ?? tag(b, "content"),
      publishedAt: toIsoDate(tag(b, "pubDate") ?? tag(b, "published") ?? tag(b, "updated")),
      deadline: null, // never guessed
      location: null,
      evidence: { feed: cfg.url, xml: b.slice(0, 4000) },
    });
  }
  return items;
}

const UA = "HyderabadOpportunityHub/1.0 (+feed reader; respects robots)";

function feedAdapter(src: SourceRow, envName: string): SourceAdapter {
  return {
    id: src.id,
    missingRequirement: () => (readFeeds(envName).length ? null : `${envName} secret is not set`),
    allowedDomains: () => [...src.official_domains, ...readFeeds(envName).map((f) => hostOf(f.url)!).filter(Boolean)],
    async fetchItems() {
      const out: RawItem[] = [];
      for (const cfg of readFeeds(envName)) {
        const res = await fetch(cfg.url, { headers: { "user-agent": UA, accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" } });
        if (!res.ok) throw new Error(`${cfg.url} responded ${res.status}`);
        out.push(...parseFeed(await res.text(), cfg));
      }
      return out;
    },
  };
}

export const APIFY_GATEWAY = "https://connector-gateway.lovable.dev/apify";

function apifyHeaders() {
  return {
    Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
    "X-Connection-Api-Key": process.env["APIFY_API_KEY"] ?? "",
    "Content-Type": "application/json",
  };
}

export function apifyMissing(src: SourceRow): string | null {
  if (!process.env["APIFY_API_KEY"]) return "Apify is not connected (APIFY_API_KEY missing)";
  if (!src.actor_id) return "actor_id not configured";
  if (!src.allowed_start_urls.length) return "allowed_start_urls not configured";
  if (!src.official_domains.length) return "official_domains allowlist not configured";
  return null;
}

/** Reads items of a finished Apify dataset and maps them via the source's field_mapping. */
export async function readApifyDataset(src: SourceRow, datasetId: string): Promise<RawItem[]> {
  const res = await fetch(`${APIFY_GATEWAY}/datasets/${encodeURIComponent(datasetId)}/items?clean=true&limit=500`, { headers: apifyHeaders() });
  if (!res.ok) throw new Error(`Apify dataset ${datasetId} [${res.status}]: ${(await res.text()).slice(0, 300)}`);
  const rows = (await res.json()) as unknown[];
  const kind = src.default_kind === "internship" ? "internship" : "hackathon";
  return rows.map((r) => mapRecord(r, src.field_mapping as FieldMapping, kind)).filter((x): x is RawItem => !!x);
}

function apifyAdapter(src: SourceRow): SourceAdapter {
  return {
    id: src.id,
    missingRequirement: () => apifyMissing(src),
    allowedDomains: () => src.official_domains,
    async fetchItems() {
      // Short synchronous run; long actors should use the webhook path instead.
      const res = await fetch(`${APIFY_GATEWAY}/acts/${encodeURIComponent(src.actor_id!)}/run-sync-get-dataset-items?timeout=240`, {
        method: "POST",
        headers: apifyHeaders(),
        body: JSON.stringify({ startUrls: src.allowed_start_urls.map((url) => ({ url })) }),
      });
      if (!res.ok) throw new Error(`Apify actor ${src.actor_id} [${res.status}]: ${(await res.text()).slice(0, 300)}`);
      const rows = (await res.json()) as unknown[];
      const kind = src.default_kind === "internship" ? "internship" : "hackathon";
      return rows.map((r) => mapRecord(r, src.field_mapping as FieldMapping, kind)).filter((x): x is RawItem => !!x);
    },
  };
}

function blocked(src: SourceRow, reason: string): SourceAdapter {
  return { id: src.id, missingRequirement: () => reason, allowedDomains: () => src.official_domains, fetchItems: async () => [] };
}

export function adapterFor(src: SourceRow): SourceAdapter {
  switch (src.id) {
    case "rss": return feedAdapter(src, "INGEST_FEEDS");
    case "college_pages": return feedAdapter(src, "COLLEGE_FEEDS");
    case "careers": return feedAdapter(src, "CAREER_FEEDS");
    case "devpost": return blocked(src, "Devpost has no public API; needs written permission or a partner feed");
    case "unstop": return blocked(src, process.env["UNSTOP_API_KEY"] ? "Key found; adapter awaits Unstop partner API docs" : "Unstop partner API access required (UNSTOP_API_KEY)");
    case "internshala": return blocked(src, process.env["INTERNSHALA_API_KEY"] ? "Key found; adapter awaits Internshala API docs" : "Internshala partner API access required (INTERNSHALA_API_KEY)");
    case "linkedin": return blocked(src, "LinkedIn prohibits scraping; approved partner access only");
  }
  if (src.kind === "apify") return apifyAdapter(src);
  if (src.kind === "webhook") return blocked(src, "Push-only source: receives signed events at /api/public/ingest/events");
  return blocked(src, src.requirement ?? "No adapter for this source type");
}
