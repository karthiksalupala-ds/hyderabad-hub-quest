/** Verification gate + change detection. Pure functions — covered by tests. */
import { canonicalizeUrl } from "./normalize";

export interface Candidate {
  kind: "hackathon" | "internship";
  title: string | null;
  organizer: string | null;
  url: string | null;
  applicationUrl: string | null;
  role: string | null;
  location: string | null;
  mode: "offline" | "online" | "hybrid" | "remote" | null;
  startDate: string | null;
  endDate: string | null;
  deadline: string | null;
}

export type GateResult = { status: "verified" | "needs_verification" | "rejected"; reasons: string[] };

const PLACEHOLDER = /(^|\.)(example\.(com|org|net)|test|localhost|invalid|demo\.local)$/i;

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
  return !h || PLACEHOLDER.test(h) || /\/demo(\/|$)/i.test(url);
}

export function hostAllowed(url: string, allowed: string[]): boolean {
  const h = hostOf(url);
  if (!h) return false;
  return allowed.some((d) => {
    const dd = d.toLowerCase().replace(/^www\./, "");
    return h === dd || h.endsWith(`.${dd}`);
  });
}

function validHttps(url: string | null): boolean {
  if (!url) return false;
  try {
    return new URL(url).protocol === "https:" && !!canonicalizeUrl(url);
  } catch {
    return false;
  }
}

export function verifyCandidate(c: Candidate, allowedDomains: string[]): GateResult {
  const hard: string[] = [];
  const soft: string[] = [];
  if (!validHttps(c.url)) hard.push("source URL is not valid HTTPS");
  else if (isPlaceholderUrl(c.url!)) hard.push("placeholder/test URL");
  if (!c.title || c.title.trim().length < 4) hard.push("missing title");
  if (!c.organizer || !c.organizer.trim()) hard.push("missing organizer/company");
  if (hard.length) return { status: "rejected", reasons: hard };

  if (!hostAllowed(c.url!, allowedDomains)) soft.push("source domain not on allowlist");
  if (c.kind === "hackathon") {
    if (!c.startDate && !c.endDate && !c.deadline) soft.push("no event date or deadline stated");
  } else {
    if (!c.role) soft.push("role not stated");
    if (!c.location && c.mode !== "remote") soft.push("location/remote not stated");
    const app = c.applicationUrl ?? c.url;
    if (!validHttps(app) || isPlaceholderUrl(app!)) soft.push("no valid application URL");
  }
  return soft.length ? { status: "needs_verification", reasons: soft } : { status: "verified", reasons: [] };
}

export type ChangeType = "deadline_changed" | "location_changed" | "mode_changed" | "prize_changed" | "stipend_changed";

export interface Snapshot {
  deadline: string | null;
  location: string | null;
  city: string | null;
  mode: string | null;
  prize_pool: number | null;
  stipend: number | null;
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
  return out;
}

export function isExpired(deadline: string | null, today = new Date().toISOString().slice(0, 10)): boolean {
  return !!deadline && deadline < today;
}
