/** Pure normalisation helpers shared by the ingestion pipeline. Never invent facts. */

const TRACKING_PARAMS = /^(utm_|fbclid$|gclid$|ref$|ref_src$|source$|mc_)/i;

export function canonicalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    u.protocol = "https:";
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    const keep = [...u.searchParams.entries()]
      .filter(([k]) => !TRACKING_PARAMS.test(k))
      .sort(([a], [b]) => a.localeCompare(b));
    u.search = "";
    for (const [k, v] of keep) u.searchParams.append(k, v);
    let s = u.toString();
    if (s.endsWith("/") && u.pathname !== "/") s = s.slice(0, -1);
    return s;
  } catch {
    return null;
  }
}

export function normalizeText(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/[^a-z0-9& ]+/g, " ")
    .replace(/\b(the|a|an|20\d\d)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeOrganizer(s: string): string {
  return normalizeText(s)
    .replace(/\b(pvt|private|ltd|limited|inc|llp|llc|corp|corporation|technologies|technology)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripHtml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function contentHash(parts: (string | number | null | undefined | string[])[]): Promise<string> {
  const text = JSON.stringify(parts.map((p) => p ?? null));
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Returns an ISO date (YYYY-MM-DD) only when the input parses unambiguously. */
export function toIsoDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

const TAG_RULES: [string, RegExp][] = [
  ["AI/ML", /\b(ai|ml|machine learning|deep learning|llm|genai)\b/i],
  ["Data Science", /\bdata scien/i],
  ["Python", /\bpython\b/i],
  ["Analytics", /\banalytic/i],
  ["Web Development", /\b(web|frontend|react|full ?stack)\b/i],
  ["Software Engineering", /\b(software|backend|sde)\b/i],
  ["Agentic AI", /\bagent/i],
  ["MCP", /\bmcp\b|model context protocol/i],
  ["Cloud", /\b(cloud|aws|azure|gcp|devops)\b/i],
  ["Product", /\bproduct\b/i],
];

/** Tags are derived only from words present in the source text. */
export function deriveTags(text: string): string[] {
  return TAG_RULES.filter(([, re]) => re.test(text)).map(([t]) => t);
}

export function detectCity(text: string): string | null {
  const m = text.match(/\b(Hyderabad|Bengaluru|Bangalore|Pune|Chennai|Mumbai|Delhi|Noida|Gurugram)\b/i);
  if (!m) return null;
  const c = (m[1] ?? "").toLowerCase();
  return c === "bangalore" ? "Bengaluru" : c.charAt(0).toUpperCase() + c.slice(1);
}

export function detectMode(text: string): "offline" | "online" | "hybrid" | "remote" | null {
  if (/\bhybrid\b/i.test(text)) return "hybrid";
  if (/\b(remote|work from home|wfh)\b/i.test(text)) return "remote";
  if (/\b(online|virtual)\b/i.test(text)) return "online";
  if (/\b(in[- ]person|offline|on[- ]site)\b/i.test(text)) return "offline";
  return null;
}
