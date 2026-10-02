export const NOT_STATED = "Not stated";

export function formatDate(iso: string | null) {
  if (!iso) return NOT_STATED;
  const d = new Date(iso.length === 10 ? iso + "T00:00:00Z" : iso);
  if (Number.isNaN(d.getTime())) return NOT_STATED;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function formatDateTime(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function formatDateRange(start: string | null, end: string | null) {
  if (!start) return "Dates not stated";
  return !end || start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`;
}

/** Whole days between today (UTC) and the date. Negative when past; null when no date. */
export function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const target = new Date(iso + "T00:00:00Z").getTime();
  if (Number.isNaN(target)) return null;
  return Math.round((target - today) / 86_400_000);
}

export function deadlineLabel(iso: string | null) {
  const d = daysLeft(iso);
  if (d === null) return "Deadline not stated";
  if (d < 0) return "Closed";
  if (d === 0) return "Closes today";
  if (d === 1) return "1 day left";
  return `${d} days left`;
}

export function deadlineTone(iso: string | null): "closed" | "urgent" | "soon" | "open" {
  const d = daysLeft(iso);
  if (d === null) return "open";
  if (d < 0) return "closed";
  if (d <= 3) return "urgent";
  if (d <= 7) return "soon";
  return "open";
}

export function formatINR(amount: number | null) {
  if (amount === null) return NOT_STATED;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}
