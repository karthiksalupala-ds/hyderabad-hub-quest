import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, Cpu, MapPin, Sparkles, Trophy, Wifi } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { DemoBanner } from "@/components/demo-banner";
import { EmptyState } from "@/components/empty-state";
import { DeadlinePill, OpportunityCard } from "@/components/opportunity-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useProfile } from "@/hooks/use-profile";
import { useOpportunities } from "@/hooks/use-opportunities";
import { daysLeft } from "@/lib/format";
import { isOpen, matchesQuery, recommendFor, sortOpportunities } from "@/lib/filters";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Opportunity Hub for Hyderabad students" },
      {
        name: "description",
        content:
          "Track Hyderabad hackathons and India internships in AI, data science and web development from one student dashboard.",
      },
      { property: "og:title", content: "Opportunity Hub — hackathons and internships for students" },
      {
        property: "og:description",
        content: "Find your next hackathon or internship, with deadlines, stipends and saved lists.",
      },
    ],
  }),
  component: Dashboard,
});

function Kpi({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: number;
  icon: typeof Trophy;
  hint: string;
}) {
  return (
    <Card className="card-elevated p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-primary" aria-hidden />
      </div>
      <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}

function Dashboard() {
  const [query, setQuery] = useState("");
  const { profile } = useProfile();
  const { items } = useOpportunities();

  const open = useMemo(() => items.filter(isOpen), [items]);
  const filtered = useMemo(() => open.filter((o) => matchesQuery(o, query)), [open, query]);

  const urgent = useMemo(
    () => sortOpportunities(filtered, "deadline").filter((o) => (daysLeft(o.deadline) ?? 99) <= 7).slice(0, 3),
    [filtered],
  );
  const recommended = useMemo(
    () => recommendFor(filtered, profile.interests, 4),
    [filtered, profile.interests],
  );
  const recent = useMemo(() => sortOpportunities(filtered, "newest").slice(0, 4), [filtered]);

  const kpis = {
    open: open.length,
    week: open.filter((o) => (daysLeft(o.deadline) ?? 99) <= 7).length,
    hydOffline: open.filter((o) => o.city === "Hyderabad" && o.mode !== "remote").length,
    remote: open.filter((o) => o.kind === "internship" && o.mode === "remote").length,
  };

  return (
    <AppShell search={query} onSearchChange={setQuery}>
      <DemoBanner />

      <section className="rounded-2xl border bg-card px-6 py-10 card-elevated sm:px-10">
        <Badge variant="secondary" className="gap-1">
          <Sparkles className="h-3 w-3" aria-hidden />
          Built for B.Tech students in Hyderabad
        </Badge>
        <h1 className="mt-4 max-w-2xl font-display text-3xl font-semibold leading-tight sm:text-4xl">
          Find your next <span className="text-gradient-brand">hackathon or internship</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
          Offline hackathons across Hyderabad and internships in India — with deadlines, stipends and
          eligibility in one place.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild className="gap-2">
            <Link to="/hackathons">
              Browse hackathons <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/internships">Browse internships</Link>
          </Button>
        </div>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card className="card-elevated group relative overflow-hidden p-6">
          <Trophy className="h-6 w-6 text-primary" aria-hidden />
          <h2 className="mt-3 text-lg font-semibold">
            <Link to="/hackathons" className="after:absolute after:inset-0 hover:underline">
              Hackathons
            </Link>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.filter((o) => o.kind === "hackathon").length} listed — events across IIIT Hyderabad, Madhapur, Gachibowli and more.
          </p>
        </Card>
        <Card className="card-elevated group relative overflow-hidden p-6">
          <Cpu className="h-6 w-6 text-primary" aria-hidden />
          <h2 className="mt-3 text-lg font-semibold">
            <Link to="/internships" className="after:absolute after:inset-0 hover:underline">
              Internships
            </Link>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.filter((o) => o.kind === "internship").length} roles across AI/ML, data science, analytics and web development.
          </p>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Open opportunities" value={kpis.open} icon={Sparkles} hint="Deadline not yet passed" />
        <Kpi label="Deadlines this week" value={kpis.week} icon={CalendarClock} hint="Closing within 7 days" />
        <Kpi label="Hyderabad offline" value={kpis.hydOffline} icon={MapPin} hint="In-person or hybrid" />
        <Kpi label="Remote internships" value={kpis.remote} icon={Wifi} hint="Work from anywhere in India" />
      </div>

      <section className="mt-10" aria-labelledby="urgent-heading">
        <h2 id="urgent-heading" className="font-display text-xl font-semibold">
          Urgent deadlines
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Closing within the next seven days.</p>
        <div className="mt-4">
          {urgent.length ? (
            <ul className="grid gap-3">
              {urgent.map((o) => (
                <li key={o.id}>
                  <Card className="card-elevated relative flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        <Link
                          to="/opportunity/$id"
                          params={{ id: o.id }}
                          className="after:absolute after:inset-0 hover:underline"
                        >
                          {o.title}
                        </Link>
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {o.organizer} · {o.location ?? "Location not stated"}
                      </p>
                    </div>
                    <DeadlinePill deadline={o.deadline} />
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nothing closing soon" description="No deadlines fall within the next week." />
          )}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="foryou-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="foryou-heading" className="font-display text-xl font-semibold">
            For you
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/settings">Edit interests</Link>
          </Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Matched to your interest tags: {profile.interests.join(", ") || "none selected"}.
        </p>
        <div className="mt-4">
          {recommended.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {recommended.map((o) => (
                <OpportunityCard key={o.id} opportunity={o} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No matches yet"
              description="Pick a few interest tags in settings and recommendations will appear here."
              action={
                <Button asChild>
                  <Link to="/settings">Choose interests</Link>
                </Button>
              }
            />
          )}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="font-display text-xl font-semibold">
          Recently added
        </h2>
        <div className="mt-4">
          {recent.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {recent.map((o) => (
                <OpportunityCard key={o.id} opportunity={o} />
              ))}
            </div>
          ) : (
            <EmptyState title="No results" description="Try a different search term." />
          )}
        </div>
      </section>
    </AppShell>
  );
}
