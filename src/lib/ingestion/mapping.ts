/** Maps arbitrary source payloads (Apify datasets, signed events, AI output) into RawItem. Pure. */
import { z } from "zod";
import { stripHtml, toIsoDate } from "./normalize";

export interface RawItem {
  kind: "hackathon" | "internship";
  title: string;
  organizer: string | null;
  url: string;
  applicationUrl?: string | null;
  description: string | null;
  publishedAt: string | null;
  deadline: string | null;
  startDate?: string | null;
  endDate?: string | null;
  location: string | null;
  mode?: "offline" | "online" | "hybrid" | "remote" | null;
  role?: string | null;
  fee?: number | null;
  prize?: number | null;
  stipend?: number | null;
  eligibility?: string[];
  tags?: string[];
  /** Raw source record kept for audit. */
  evidence?: unknown;
}

export const MAPPABLE_FIELDS = [
  "title", "organizer", "url", "applicationUrl", "description", "location", "mode", "role",
  "startDate", "endDate", "deadline", "fee", "prize", "stipend", "eligibility", "tags", "kind", "publishedAt",
] as const;
export type FieldMapping = Partial<Record<(typeof MAPPABLE_FIELDS)[number], string>>;

export function pick(obj: unknown, path: string | undefined): unknown {
  if (!path) return undefined;
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
}
const str = (v: unknown): string | null => {
  if (typeof v === "number") return String(v);
  if (typeof v !== "string") return null;
  const s = stripHtml(v);
  return s || null;
};
/** Only parses explicit numbers — "₹10k" → 10000, "Unpaid" → 0, otherwise null. */
export function toAmount(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;
  if (/\b(unpaid|free|no fee)\b/i.test(v)) return 0;
  const m = v.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(k|l|lakh|lac)?/i);
  if (!m) return null;
  const n = Number(m[1]);
  const mult = !m[2] ? 1 : m[2].toLowerCase() === "k" ? 1000 : 100000;
  return n * mult;
}
const MODES = ["offline", "online", "hybrid", "remote"] as const;
function toMode(v: unknown): RawItem["mode"] {
  const s = str(v)?.toLowerCase() ?? "";
  if (/in[- ]?person|on[- ]?site/.test(s)) return "offline";
  return (MODES as readonly string[]).find((m) => s.includes(m)) as RawItem["mode"] ?? null;
}
const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(str).filter((x): x is string => !!x) : typeof v === "string" ? v.split(/[,;|]/).map((s) => s.trim()).filter(Boolean) : [];

export function mapRecord(rec: unknown, mapping: FieldMapping, defaultKind: "hackathon" | "internship"): RawItem | null {
  const f = (k: (typeof MAPPABLE_FIELDS)[number]) => pick(rec, mapping[k] ?? k);
  const title = str(f("title"));
  const url = str(f("url"));
  if (!title || !url) return null;
  const kindRaw = str(f("kind"))?.toLowerCase();
  return {
    kind: kindRaw === "hackathon" || kindRaw === "internship" ? kindRaw : defaultKind,
    title,
    organizer: str(f("organizer")),
    url,
    applicationUrl: str(f("applicationUrl")),
    description: str(f("description")),
    publishedAt: toIsoDate(str(f("publishedAt"))),
    deadline: toIsoDate(str(f("deadline"))),
    startDate: toIsoDate(str(f("startDate"))),
    endDate: toIsoDate(str(f("endDate"))),
    location: str(f("location")),
    mode: toMode(f("mode")) ?? null,
    role: str(f("role")),
    fee: toAmount(f("fee")),
    prize: toAmount(f("prize")),
    stipend: toAmount(f("stipend")),
    eligibility: list(f("eligibility")),
    tags: list(f("tags")),
    evidence: rec,
  };
}

/** Schema for AI extraction output. Everything nullable — unknown must stay null. */
export const aiExtractionSchema = z.object({
  kind: z.enum(["hackathon", "internship"]).nullable(),
  title: z.string().nullable(),
  organizer: z.string().nullable(),
  role: z.string().nullable(),
  location: z.string().nullable(),
  mode: z.enum(["offline", "online", "hybrid", "remote"]).nullable(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  deadline: z.string().nullable(),
  fee: z.number().nullable(),
  prize: z.number().nullable(),
  stipend: z.number().nullable(),
  eligibility: z.array(z.string()).nullable(),
  tags: z.array(z.string()).nullable(),
  relevance: z.number().nullable(),
});
export type AiExtraction = z.infer<typeof aiExtractionSchema>;

/** Returns null for anything that is not valid JSON matching the schema. */
export function parseAiExtraction(text: string): AiExtraction | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const r = aiExtractionSchema.safeParse(JSON.parse(m[0]));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/** True when the number literally appears in the evidence (commas ignored, "10k"/"1 lakh" style accepted). */
export function numberGrounded(n: number | null, evidence: string): number | null {
  if (n === null || !Number.isFinite(n) || n < 0) return null;
  const ev = evidence.replace(/,/g, "").toLowerCase();
  const forms = [String(n)];
  if (n >= 1000 && n % 1000 === 0) forms.push(`${n / 1000}k`, `${n / 1000} k`);
  if (n >= 100000 && n % 100000 === 0) forms.push(`${n / 100000} lakh`, `${n / 100000}l`, `${n / 100000} lac`);
  return forms.some((f) => new RegExp(`(^|[^\\d.])${f.replace(/\./g, "\\.")}(?![\\d])`).test(ev)) ? n : null;
}

/** AI dates are kept only when they parse and their year is stated in the evidence. */
export function dateGrounded(d: string | null, evidence: string): string | null {
  const iso = toIsoDate(d);
  return iso && evidence.includes(iso.slice(0, 4)) ? iso : null;
}

/** Merge AI output into gaps only; every fact must be grounded in the evidence, otherwise it stays null. */
export function mergeAi(item: RawItem, ai: AiExtraction, evidence: string): RawItem {
  const ev = evidence.toLowerCase();
  const grounded = (v: string | null) => (v && v.trim().length > 1 && ev.includes(v.toLowerCase()) ? v : null);
  const modeWord = ai.mode && (ai.mode === "offline" ? /in[- ]?person|offline|on[- ]?site/.test(ev) : ev.includes(ai.mode)) ? ai.mode : null;
  return {
    ...item,
    kind: item.kind,
    organizer: item.organizer ?? grounded(ai.organizer),
    role: item.role ?? grounded(ai.role),
    location: item.location ?? grounded(ai.location),
    mode: item.mode ?? modeWord,
    startDate: item.startDate ?? dateGrounded(ai.start_date, evidence),
    endDate: item.endDate ?? dateGrounded(ai.end_date, evidence),
    deadline: item.deadline ?? dateGrounded(ai.deadline, evidence),
    fee: item.fee ?? numberGrounded(ai.fee, evidence),
    prize: item.prize ?? numberGrounded(ai.prize, evidence),
    stipend: item.stipend ?? numberGrounded(ai.stipend, evidence),
    eligibility: item.eligibility?.length ? item.eligibility : (ai.eligibility ?? []).filter((e) => ev.includes(e.toLowerCase())),
    tags: item.tags?.length ? item.tags : (ai.tags ?? []).filter((tag) => ev.includes(tag.toLowerCase())),
  };
}
