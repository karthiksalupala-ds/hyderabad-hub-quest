/** Verification gate, safe dedupe matching, change detection and expiry. Pure functions — covered by tests. */
import { canonicalizeUrl, normalizeOrganizer, normalizeText } from "./normalize";

export type Mode = "offline" | "online" | "hybrid" | "remote";

export interface Candidate {
  kind: "hackathon" | "internship";
  title: string | null;
  organizer: string | null;
  url: string | null;
  applicationUrl: string | null;
  role: string | null;
  location: string | null;
  mode: Mode | null;
  startDate: string | null;
  endDate: string | null;
  deadline: string | null;
  /** Raw source text/record. Without evidence a listing can never be verified. */
  evidence?: unknown;
}

export type VerificationStatus = "verified" | "needs_verification" | "rejected";
export type GateResult = { status: VerificationStatus; reasons: string[]; evidence: Record<string, unknown> };

const PLACEHOLDER = /(^|\.)(example\.(com|org|net)|test|localhost|invalid|local|demo\.local)$/i;

export function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function isPlaceholderUrl(url: string): boolean {
  const h = hostOf(url);
  if (!h || PLACEHOLDER.test(h)) return true;
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(h)) return true; // raw IPs are never official sources
  return /\/(demo|sample|placeholder)(\/|$)/i.test(url);
}

export function hostAllowed(url: string, allowed: string[]): boolean {
  const h = hostOf(url);
  if (!h) return false;
  return allowed.some((d) => {
    const dd = d.toLowerCase().trim().replace(/^www\./, "");
    return !!dd && (h === dd || h.endsWith(`.${dd}`));
  });
}

export function isValidHttps(url: string | null): boolean {
  if (!url) return false;
  try {
    return new URL(url).protocol === "https:" && !!canonicalizeUrl(url);
  } catch {
    return false;
  }
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const hasEvidence = (e: unknown) =>
  e !== null && e !== undefined && (typeof e !== "string" || e.trim().length > 0) && (typeof e !== "object" || Object.keys(e as object).length > 0);

export function verifyCandidate(c: Candidate, allowedDomains: string[]): GateResult {
  const hard: string[] = [];
  const soft: string[] = [];
  if (!isValidHttps(c.url)) hard.push("source URL is not valid HTTPS");
  else if (isPlaceholderUrl(c.url!)) hard.push("placeholder/test URL");
  if (!c.title || c.title.trim().length < 4) hard.push("missing title");
  if (!c.organizer || !c.organizer.trim()) hard.push("missing organizer/company");
  for (const [k, v] of [["start date", c.startDate], ["end date", c.endDate], ["deadline", c.deadline]] as const) {
    if (v && !ISO.test(v)) hard.push(`unparseable ${k}`);
  }
  const evidence = { host: hostOf(c.url), allowlist: allowedDomains, hasEvidence: hasEvidence(c.evidence) };
  if (hard.length) return { status: "rejected", reasons: hard, evidence };

  if (!allowedDomains.length) soft.push("no official-domain allowlist configured for this source");
  else if (!hostAllowed(c.url!, allowedDomains)) soft.push("source domain not on allowlist");
  if (!evidence.hasEvidence) soft.push("no source evidence stored");
  if (c.startDate && c.endDate && c.endDate < c.startDate) soft.push("end date before start date");
  if (c.deadline && c.endDate && c.deadline > c.endDate) soft.push("deadline after event end");
  if (c.applicationUrl && (!isValidHttps(c.applicationUrl) || isPlaceholderUrl(c.applicationUrl))) soft.push("application URL invalid");
  else if (c.applicationUrl && allowedDomains.length && !hostAllowed(c.applicationUrl, allowedDomains)) soft.push("application URL off allowlist");

  if (c.kind === "hackathon") {
    if (!c.startDate && !c.endDate && !c.deadline) soft.push("no event date or deadline stated");
  } else {
    if (!c.role) soft.push("role not stated");
    if (!c.location && c.mode !== "remote") soft.push("location/remote not stated");
    const app = c.applicationUrl ?? c.url;
    if (!isValidHttps(app) || isPlaceholderUrl(app!)) soft.push("no valid application URL");
  }
  return soft.length ? { status: "needs_verification", reasons: soft, evidence } : { status: "verified", reasons: [], evidence };
}

/* ---------------- Safe dedupe matching ---------------- */

export interface MatchCandidate {
  canonical_url: string;
  normalized_organizer: string;
  normalized_title: string;
  deadline: string | null;
  start_date: string | null;
}

/**
 * Returns true when two records describe the same opportunity.
 * Canonical URL wins. Otherwise organizer+title must match exactly after normalisation and,
 * when both sides state a date, the dates must agree (yearly editions stay separate).
 */
export function isSameOpportunity(a: MatchCandidate, b: MatchCandidate): boolean {
  if (a.canonical_url === b.canonical_url) return true;
  if (!a.normalized_organizer || !a.normalized_title) return false;
  if (a.normalized_organizer !== b.normalized_organizer || a.normalized_title !== b.normalized_title) return false;
  const da = a.start_date ?? a.deadline;
  const db = b.start_date ?? b.deadline;
  return !da || !db || da === db;
}

export function matchKeyFor(organizer: string, title: string) {
  return { normalized_organizer: normalizeOrganizer(organizer), normalized_title: normalizeText(title) };
}

/* ---------------- Change detection ---------------- */

export type ChangeType =
  | "deadline_changed" | "location_changed" | "mode_changed" | "prize_changed"
  | "stipend_changed" | "application_url_changed" | "content_changed";

export interface Snapshot {
  deadline: string | null;
  location: string | null;
  city: string | null;
  mode: string | null;
  prize_pool: number | null;
  stipend: number | null;
  application_url?: string | null;
  content_hash?: string | null;
}

export function detectChanges(prev: Snapshot, next: Snapshot) {
  const out: { change_type: ChangeType; old_value: string | null; new_value: string | null }[] = [];
  const s = (v: unknown) => (v === null || v === undefined ? null : String(v));
  const cmp = (t: ChangeType, a: unknown, b: unknown) => {
    // A newly unknown value is not a change — sources often omit fields.
    if (b === null || b === undefined) return;
    if (s(a) !== s(b)) out.push({ change_type: t, old_value: s(a), new_value: s(b) });
  };
  cmp("deadline_changed", prev.deadline, next.deadline);
  cmp("location_changed", prev.location ?? prev.city, next.location ?? next.city);
  cmp("mode_changed", prev.mode, next.mode);
  cmp("prize_changed", prev.prize_pool, next.prize_pool);
  cmp("stipend_changed", prev.stipend, next.stipend);
  cmp("application_url_changed", prev.application_url, next.application_url);
  // Content change is only reported when nothing more specific explains it.
  if (!out.length && prev.content_hash && next.content_hash && prev.content_hash !== next.content_hash) {
    out.push({ change_type: "content_changed", old_value: null, new_value: null });
  }
  return out;
}

/* ---------------- Expiry ---------------- */

/**
 * Safe expiry: only a stated deadline in the past (or, without a deadline, a stated end date in the past)
 * closes a listing. Unknown dates never expire anything.
 */
export function isExpired(
  deadlineOrRow: string | null | { deadline: string | null; end_date?: string | null },
  today = new Date().toISOString().slice(0, 10),
): boolean {
  const r = typeof deadlineOrRow === "object" && deadlineOrRow !== null ? deadlineOrRow : { deadline: deadlineOrRow, end_date: null };
  if (r.deadline) return ISO.test(r.deadline) && r.deadline < today;
  return !!r.end_date && ISO.test(r.end_date) && r.end_date < today;
}

/* ---------------- Adaptive polling ---------------- */

export const MIN_POLL_MINUTES = 60;
export const MAX_POLL_MINUTES = 7 * 24 * 60;

/** Back off when runs find nothing new, up to 7 days; never below 60 minutes. */
export function nextPollMinutes(base: number, consecutiveEmpty: number): number {
  const b = Math.max(MIN_POLL_MINUTES, base || MIN_POLL_MINUTES);
  return Math.min(MAX_POLL_MINUTES, b * 2 ** Math.min(Math.max(consecutiveEmpty, 0), 6));
}
