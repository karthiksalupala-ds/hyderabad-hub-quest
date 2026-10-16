/**
 * Provider adapters. Every provider returns the common RawOpportunity shape (RawItem).
 * Configuration is environment-driven; when it is missing the adapter reports NOT_CONFIGURED
 * and fetches nothing. No adapter ever invents records, URLs or credentials.
 */
import type { Tables } from "@/integrations/supabase/types";
import { mapRecord, pick, type FieldMapping, type RawItem } from "./mapping";
import { canonicalizeUrl, stripHtml, toIsoDate } from "./normalize";
import { hostOf } from "./verify";

export type { RawItem } from "./mapping";
export type RawOpportunity = RawItem;
export type SourceRow = Tables<"source_registry">;

export const NOT_CONFIGURED = "NOT_CONFIGURED" as const;

export interface SourceAdapter {
  id: string;
  provider: "rss" | "rest" | "careers" | "apify" | "webmcp" | "webhook" | "blocked";
  /** null when runnable, otherwise a human-readable reason (status NOT_CONFIGURED). */
  missingRequirement(): string | null;
  /** Domains whose links count as source-backed for this adapter. */
  allowedDomains(): string[];
  fetchItems(): Promise<RawItem[]>;
}

type Kind = "hackathon" | "internship";
const UA = "HyderabadOpportunityHub/1.0 (+permitted feed/API reader)";
const isKind = (k: unknown): k is Kind => k === "hackathon" || k === "internship";

/** Parses a JSON array from an env var; invalid JSON or entries are dropped, never guessed. */
export function readJsonEnv<T>(envName: string, valid: (x: T) => boolean): T[] {
  const raw = process.env[envName];
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? (v as T[]).filter(valid) : [];
  } catch {
    return [];
  }
}
const httpsOk = (u: unknown) => typeof u === "string" && u.startsWith("https://") && !!canonicalizeUrl(u);
const cfgEnv = (src: SourceRow, fallback: string) => ((src.adapter_config as { env?: string } | null)?.env ?? fallback);
const authHeader = (tokenEnv?: string): Record<string, string> => {
  const t = tokenEnv ? process.env[tokenEnv] : undefined;
  return t ? { authorization: `Bearer ${t}` } : {};
};

async function getJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(url, { ...init, headers: { "user-agent": UA, accept: "application/json", ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`${hostOf(url)} responded ${res.status}`);
  return res.json();
}

/* ---------------- RSS / Atom ---------------- */

interface FeedConfig { url: string; kind: Kind; organizer?: string }

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? stripHtml((m[1] ?? "").replace(/^<!\[CDATA\[|\]\]>$/g, "")) || null : null;
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
      deadline: null, // never guessed from a feed
      location: null,
      evidence: { feed: cfg.url, xml: b.slice(0, 4000) },
    });
  }
  return items;
}

function feedAdapter(src: SourceRow, envName: string): SourceAdapter {
  const feeds = () => readJsonEnv<FeedConfig>(envName, (f) => httpsOk(f?.url) && isKind(f?.kind));
  return {
    id: src.id,
    provider: "rss",
    missingRequirement: () => (feeds().length ? null : `${NOT_CONFIGURED}: ${envName} not set`),
    allowedDomains: () => [...src.official_domains, ...feeds().map((f) => hostOf(f.url)!).filter(Boolean)],
    async fetchItems() {
      const out: RawItem[] = [];
      for (const cfg of feeds()) {
        const res = await fetch(cfg.url, { headers: { "user-agent": UA, accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" } });
        if (!res.ok) throw new Error(`${cfg.url} responded ${res.status}`);
        out.push(...parseFeed(await res.text(), cfg));
      }
      return out;
    },
  };
}

/* ---------------- Generic REST / JSON API ---------------- */

export interface RestConfig {
  url: string;
  kind: Kind;
  mapping: FieldMapping;
  itemsPath?: string;
  tokenEnv?: string;
  domains?: string[];
}

export function extractList(payload: unknown, itemsPath?: string): unknown[] {
  const v = itemsPath ? pick(payload, itemsPath) : payload;
  return Array.isArray(v) ? v : [];
}

function restAdapter(src: SourceRow, envName: string): SourceAdapter {
  const cfgs = () => readJsonEnv<RestConfig>(envName, (c) => httpsOk(c?.url) && isKind(c?.kind) && !!c?.mapping && typeof c.mapping === "object");
  return {
    id: src.id,
    provider: "rest",
    missingRequirement: () => (cfgs().length ? null : `${NOT_CONFIGURED}: ${envName} not set`),
    allowedDomains: () => [...src.official_domains, ...cfgs().flatMap((c) => c.domains ?? [hostOf(c.url)!]).filter(Boolean)],
    async fetchItems() {
      const out: RawItem[] = [];
      for (const c of cfgs()) {
        const rows = extractList(await getJson(c.url, { headers: authHeader(c.tokenEnv) }), c.itemsPath);
        out.push(...rows.map((r) => mapRecord(r, c.mapping, c.kind)).filter((x): x is RawItem => !!x));
      }
      return out;
    },
  };
}

/* ---------------- Greenhouse / Lever career boards ---------------- */

export interface CareerConfig { url: string; organizer: string; format: "greenhouse" | "lever"; includeAll?: boolean }
const INTERN_RE = /\b(intern|internship|trainee|apprentice)\b/i;

export function parseGreenhouse(payload: unknown, cfg: CareerConfig): RawItem[] {
  const jobs = extractList(payload, "jobs") as Array<Record<string, unknown>>;
  return jobs.flatMap((j) => {
    const title = typeof j["title"] === "string" ? j["title"] : null;
    const url = typeof j["absolute_url"] === "string" ? j["absolute_url"] : null;
    if (!title || !url || (!cfg.includeAll && !INTERN_RE.test(title))) return [];
    const loc = (j["location"] as { name?: string } | undefined)?.name ?? null;
    return [{
      kind: "internship" as const, title, role: title, organizer: cfg.organizer, url, applicationUrl: url,
      description: typeof j["content"] === "string" ? stripHtml(j["content"].replace(/&lt;/g, "<").replace(/&gt;/g, ">")) : null,
      publishedAt: toIsoDate(typeof j["updated_at"] === "string" ? j["updated_at"] : null),
      deadline: null, location: loc, evidence: { board: cfg.url, job: j },
    }];
  });
}

export function parseLever(payload: unknown, cfg: CareerConfig): RawItem[] {
  const jobs = extractList(payload) as Array<Record<string, unknown>>;
  return jobs.flatMap((j) => {
    const title = typeof j["text"] === "string" ? j["text"] : null;
    const url = typeof j["hostedUrl"] === "string" ? j["hostedUrl"] : null;
    const cats = (j["categories"] ?? {}) as { location?: string; commitment?: string };
    if (!title || !url || (!cfg.includeAll && !INTERN_RE.test(`${title} ${cats.commitment ?? ""}`))) return [];
    return [{
      kind: "internship" as const, title, role: title, organizer: cfg.organizer, url,
      applicationUrl: typeof j["applyUrl"] === "string" ? j["applyUrl"] : url,
      description: typeof j["descriptionPlain"] === "string" ? j["descriptionPlain"] : null,
      publishedAt: typeof j["createdAt"] === "number" ? toIsoDate(String(j["createdAt"])) : null,
      deadline: null, location: cats.location ?? null, evidence: { board: cfg.url, job: j },
    }];
  });
}

function careersAdapter(src: SourceRow, envName: string): SourceAdapter {
  const cfgs = () => readJsonEnv<CareerConfig>(envName, (c) => httpsOk(c?.url) && !!c?.organizer && (c.format === "greenhouse" || c.format === "lever"));
  return {
    id: src.id,
    provider: "careers",
    missingRequirement: () => (cfgs().length ? null : `${NOT_CONFIGURED}: ${envName} not set`),
    allowedDomains: () => [...src.official_domains, "boards.greenhouse.io", "job-boards.greenhouse.io", "jobs.lever.co", ...cfgs().map((c) => hostOf(c.url)!)],
    async fetchItems() {
      const out: RawItem[] = [];
      for (const c of cfgs()) {
        const data = await getJson(c.url);
        out.push(...(c.format === "greenhouse" ? parseGreenhouse(data, c) : parseLever(data, c)));
      }
      return out;
    },
  };
}

/* ---------------- Apify integration ---------------- */

export const APIFY_API_BASE = "https://api.apify.com/v2";
function apifyHeaders() {
  return {
    Authorization: `Bearer ${process.env["APIFY_API_KEY"] ?? ""}`,
    "Content-Type": "application/json",
  };
}

export function apifyMissing(src: SourceRow): string | null {
  if (!process.env["APIFY_API_KEY"]) return `${NOT_CONFIGURED}: Apify not connected (APIFY_API_KEY)`;
  if (!src.actor_id) return `${NOT_CONFIGURED}: actor_id not set on source`;
  if (!src.allowed_start_urls.length) return `${NOT_CONFIGURED}: allowed_start_urls not set`;
  if (!src.official_domains.length) return `${NOT_CONFIGURED}: official_domains allowlist not set`;
  return null;
}

function mapRows(src: SourceRow, rows: unknown[]): RawItem[] {
  const kind: Kind = src.default_kind === "internship" ? "internship" : "hackathon";
  return rows.map((r) => mapRecord(r, src.field_mapping as FieldMapping, kind)).filter((x): x is RawItem => !!x);
}

export async function readApifyDataset(src: SourceRow, datasetId: string): Promise<RawItem[]> {
  const res = await fetch(`${APIFY_API_BASE}/datasets/${encodeURIComponent(datasetId)}/items?clean=true&limit=500`, { headers: apifyHeaders() });
  if (!res.ok) throw new Error(`Apify dataset ${datasetId} [${res.status}]: ${(await res.text()).slice(0, 300)}`);
  return mapRows(src, (await res.json()) as unknown[]);
}

function apifyAdapter(src: SourceRow): SourceAdapter {
  return {
    id: src.id,
    provider: "apify",
    missingRequirement: () => apifyMissing(src),
    allowedDomains: () => src.official_domains,
    async fetchItems() {
      const res = await fetch(`${APIFY_API_BASE}/acts/${encodeURIComponent(src.actor_id!)}/run-sync-get-dataset-items?timeout=240`, {
        method: "POST",
        headers: apifyHeaders(),
        body: JSON.stringify({ startUrls: src.allowed_start_urls.map((url) => ({ url })) }),
      });
      if (!res.ok) throw new Error(`Apify actor ${src.actor_id} [${res.status}]: ${(await res.text()).slice(0, 300)}`);
      return mapRows(src, (await res.json()) as unknown[]);
    },
  };
}

/* ---------------- WebMCP / MCP tool sources ---------------- */

export interface McpToolConfig {
  endpoint: string;
  tool: string;
  kind: Kind;
  mapping: FieldMapping;
  arguments?: Record<string, unknown>;
  itemsPath?: string;
  tokenEnv?: string;
  domains?: string[];
}

/** Reads a JSON-RPC tools/call result: structuredContent first, then JSON text content. */
export function parseMcpResult(payload: unknown, itemsPath?: string): unknown[] {
  const result = (payload as { result?: { structuredContent?: unknown; content?: { type?: string; text?: string }[]; isError?: boolean }; error?: { message?: string } })?.result;
  if (!result || result.isError) return [];
  if (result.structuredContent !== undefined) return extractList(result.structuredContent, itemsPath);
  for (const c of result.content ?? []) {
    if (c.type !== "text" || !c.text) continue;
    try {
      const list = extractList(JSON.parse(c.text), itemsPath);
      if (list.length) return list;
    } catch { /* non-JSON text is ignored, never interpreted */ }
  }
  return [];
}

function webMcpAdapter(src: SourceRow, envName: string): SourceAdapter {
  const cfgs = () => readJsonEnv<McpToolConfig>(envName, (c) => httpsOk(c?.endpoint) && !!c?.tool && isKind(c?.kind) && !!c?.mapping);
  return {
    id: src.id,
    provider: "webmcp",
    missingRequirement: () => (cfgs().length ? null : `${NOT_CONFIGURED}: ${envName} not set`),
    allowedDomains: () => [...src.official_domains, ...cfgs().flatMap((c) => c.domains ?? [])],
    async fetchItems() {
      const out: RawItem[] = [];
      for (const c of cfgs()) {
        const payload = await getJson(c.endpoint, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...authHeader(c.tokenEnv) },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: c.tool, arguments: c.arguments ?? {} } }),
        });
        out.push(...parseMcpResult(payload, c.itemsPath).map((r) => mapRecord(r, c.mapping, c.kind)).filter((x): x is RawItem => !!x));
      }
      return out;
    },
  };
}

/* ---------------- Router ---------------- */

function blocked(src: SourceRow, reason: string, provider: SourceAdapter["provider"] = "blocked"): SourceAdapter {
  return { id: src.id, provider, missingRequirement: () => reason, allowedDomains: () => src.official_domains, fetchItems: async () => [] };
}

export function adapterFor(src: SourceRow): SourceAdapter {
  switch (src.id) {
    case "devpost": return blocked(src, `${NOT_CONFIGURED}: Devpost has no public API; needs written permission or a partner feed`);
    case "unstop": return blocked(src, `${NOT_CONFIGURED}: Unstop partner API access required (UNSTOP_API_KEY + API docs)`);
    case "internshala": return blocked(src, `${NOT_CONFIGURED}: Internshala partner API access required (INTERNSHALA_API_KEY + API docs)`);
    case "linkedin": return blocked(src, "Not allowed: LinkedIn prohibits scraping; approved partner access only");
  }
  switch (src.kind) {
    case "rss": return feedAdapter(src, cfgEnv(src, src.id === "college_pages" ? "COLLEGE_FEEDS" : "INGEST_FEEDS"));
    case "careers": return careersAdapter(src, cfgEnv(src, "CAREER_FEEDS"));
    case "api": return restAdapter(src, cfgEnv(src, "REST_SOURCES"));
    case "apify": return apifyAdapter(src);
    case "mcp": return webMcpAdapter(src, cfgEnv(src, "WEBMCP_TOOLS"));
    case "webhook":
      return blocked(src, process.env["WEBHOOK_SIGNING_SECRET"] ? "Push-only: receives signed events at /api/public/ingest/events" : `${NOT_CONFIGURED}: WEBHOOK_SIGNING_SECRET not set`, "webhook");
  }
  return blocked(src, src.requirement ?? `${NOT_CONFIGURED}: no adapter for this source type`);
}
