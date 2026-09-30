import { daysLeft } from "./format";
import { isHackathon, type Opportunity } from "./types";

export function matchesQuery(o: Opportunity, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [o.title, o.organizer, o.location, o.summary, o.description, ...o.tags]
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

export type SortKey = "deadline" | "date" | "newest" | "reward";

export function sortOpportunities(list: Opportunity[], key: SortKey) {
  const sorted = [...list];
  sorted.sort((a, b) => {
    switch (key) {
      case "deadline":
        return a.deadline.localeCompare(b.deadline);
      case "date":
        return a.startDate.localeCompare(b.startDate);
      case "newest":
        return b.postedAt.localeCompare(a.postedAt);
      case "reward": {
        const val = (o: Opportunity) => (isHackathon(o) ? o.prizePool : o.stipend);
        return val(b) - val(a);
      }
    }
  });
  return sorted;
}

export const isOpen = (o: Opportunity) => daysLeft(o.deadline) >= 0;

export function recommendFor(list: Opportunity[], interests: string[], limit = 4) {
  if (interests.length === 0) return [];
  return list
    .filter(isOpen)
    .map((o) => ({ o, score: o.tags.filter((t) => interests.includes(t)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.o.deadline.localeCompare(b.o.deadline))
    .slice(0, limit)
    .map((x) => x.o);
}
