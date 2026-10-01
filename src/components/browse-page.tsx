import { useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { DemoBanner } from "@/components/demo-banner";
import { EmptyState } from "@/components/empty-state";
import { FilterChip } from "@/components/filter-chip";
import { OpportunityCard } from "@/components/opportunity-card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { isOpen, matchesQuery, sortOpportunities, type SortKey } from "@/lib/filters";
import { ALL_TAGS, isHackathon, type InterestTag, type Opportunity } from "@/lib/types";

const MODES = ["all", "offline", "hybrid", "online", "remote"] as const;

export function BrowsePage({
  kind,
  title,
  description,
  items,
}: {
  kind: "hackathon" | "internship";
  title: string;
  description: string;
  items: Opportunity[];
}) {
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<InterestTag[]>([]);
  const [mode, setMode] = useState<(typeof MODES)[number]>("all");
  const [sort, setSort] = useState<SortKey>("deadline");
  const [openOnly, setOpenOnly] = useState(true);
  const [special, setSpecial] = useState(false);
  const [hydOnly, setHydOnly] = useState(false);

  const specialLabel = kind === "hackathon" ? "Free entry only" : "Paid only";

  const results = useMemo(() => {
    const list = items.filter((o) => {
      if (!matchesQuery(o, query)) return false;
      if (openOnly && !isOpen(o)) return false;
      if (mode !== "all" && o.mode !== mode) return false;
      if (tags.length && !tags.some((t) => o.tags.includes(t))) return false;
      if (hydOnly && o.city !== "Hyderabad" && o.mode !== "remote") return false;
      if (special) {
        if (isHackathon(o) ? o.fee > 0 : !o.paid) return false;
      }
      return true;
    });
    return sortOpportunities(list, sort);
  }, [items, query, openOnly, mode, tags, hydOnly, special, sort]);

  const reset = () => {
    setQuery("");
    setTags([]);
    setMode("all");
    setSort("deadline");
    setOpenOnly(true);
    setSpecial(false);
    setHydOnly(false);
  };

  return (
    <AppShell search={query} onSearchChange={setQuery}>
      <DemoBanner />
      <h1 className="font-display text-3xl font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>

      <section aria-label="Filters" className="card-elevated mt-6 space-y-4 rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap gap-2">
          {ALL_TAGS.map((t) => (
            <FilterChip
              key={t}
              label={t}
              active={tags.includes(t)}
              onToggle={() => setTags((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="mode">Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as (typeof MODES)[number])}>
              <SelectTrigger id="mode" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODES.map((m) => (
                  <SelectItem key={m} value={m} className="capitalize">
                    {m === "all" ? "All" : m[0].toUpperCase() + m.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="sort">Sort</Label>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger id="sort" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deadline">Deadline (soonest)</SelectItem>
                <SelectItem value="date">Start date</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="reward">{kind === "hackathon" ? "Prize pool" : "Stipend"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={openOnly} onCheckedChange={setOpenOnly} /> Open only
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={special} onCheckedChange={setSpecial} /> {specialLabel}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={hydOnly} onCheckedChange={setHydOnly} /> Hyderabad / remote
          </label>
          <Button variant="ghost" size="sm" onClick={reset} className="ml-auto">
            Reset
          </Button>
        </div>
      </section>

      <p className="mt-6 text-sm text-muted-foreground" aria-live="polite">
        {results.length} result{results.length === 1 ? "" : "s"}
      </p>
      <div className="mt-3">
        {results.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {results.map((o) => (
              <OpportunityCard key={o.id} opportunity={o} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No matches"
            description="Try removing a filter or changing your search."
            action={<Button onClick={reset}>Clear filters</Button>}
          />
        )}
      </div>
    </AppShell>
  );
}
