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

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, "0");
function ymd(y: number, m: number, d: number): string | null {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 ? `${y}-${pad(m)}-${pad(d)}` : null;
}

/**
 * Returns an ISO date (YYYY-MM-DD) only when the input parses unambiguously.
 * Numeric dates like 03/04/2026 are rejected unless one part is > 12 (then read as Indian DD/MM).
 */
export function toIsoDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/);
  if (m) return ymd(+m[1]!, +m[2]!, +m[3]!);
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) {
    const a = +m[1]!, b = +m[2]!, y = +m[3]!;
    if (a > 12 && b <= 12) return ymd(y, b, a);
    if (b > 12 && a <= 12) return ymd(y, a, b);
    return a === b ? ymd(y, a, b) : null; // ambiguous
  }
  m = t.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})/);
  if (m) { const mo = MONTHS[m[2]!.slice(0, m[2]!.toLowerCase().startsWith("sept") ? 4 : 3).toLowerCase()]; return mo ? ymd(+m[3]!, mo, +m[1]!) : null; }
  m = t.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
  if (m) { const mo = MONTHS[m[1]!.slice(0, 3).toLowerCase()]; return mo ? ymd(+m[3]!, mo, +m[2]!) : null; }
  // RFC 2822 / ISO timestamps from feeds
  if (/^[A-Za-z]{3},\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4}/.test(t) || /^\d{4}-\d{2}-\d{2}T/.test(t) || /^\d{13}$/.test(t)) {
    const d = new Date(/^\d{13}$/.test(t) ? Number(t) : t);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  return null;
}

/** Stable key for safe fuzzy dedupe: organizer + title (+ date when known). */
export function dedupeKey(organizer: string, title: string, date: string | null): string {
  return [normalizeOrganizer(organizer), normalizeText(title), date ?? ""].join("|");
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
  const m = text.match(/\b(Hyderabad|Secunderabad|Bengaluru|Bangalore|Pune|Chennai|Mumbai|Delhi|Noida|Gurugram)\b/i);
  if (!m) return null;
  const c = (m[1] ?? "").toLowerCase();
  if (c === "secunderabad") return "Hyderabad";
  return c === "bangalore" ? "Bengaluru" : c.charAt(0).toUpperCase() + c.slice(1);
}

export function detectMode(text: string): "offline" | "online" | "hybrid" | "remote" | null {
  if (/\bhybrid\b/i.test(text)) return "hybrid";
  if (/\b(remote|work from home|wfh)\b/i.test(text)) return "remote";
  if (/\b(online|virtual)\b/i.test(text)) return "online";
  if (/\b(in[- ]person|offline|on[- ]site)\b/i.test(text)) return "offline";
  return null;
}
