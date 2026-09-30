export function formatDate(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateRange(start: string, end: string) {
  return start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`;
}

/** Whole days between today (UTC) and the given sample date. Negative when past. */
export function daysLeft(iso: string) {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const target = new Date(iso + "T00:00:00Z").getTime();
  return Math.round((target - today) / 86_400_000);
}

export function deadlineLabel(iso: string) {
  const d = daysLeft(iso);
  if (d < 0) return "Closed";
  if (d === 0) return "Closes today";
  if (d === 1) return "1 day left";
  return `${d} days left`;
}

export function deadlineTone(iso: string): "closed" | "urgent" | "soon" | "open" {
  const d = daysLeft(iso);
  if (d < 0) return "closed";
  if (d <= 3) return "urgent";
  if (d <= 7) return "soon";
  return "open";
}

export function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
