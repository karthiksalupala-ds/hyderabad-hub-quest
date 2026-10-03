import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DemoBanner } from "@/components/demo-banner";
import { EmptyState } from "@/components/empty-state";
import { DeadlinePill, SaveButton } from "@/components/opportunity-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getOpportunity } from "@/lib/data";
import { useOpportunities } from "@/hooks/use-opportunities";
import { SourceMeta } from "@/components/opportunity-card";
import { daysLeft, formatDate, formatDateRange, formatINR } from "@/lib/format";
import { isHackathon } from "@/lib/types";

export const Route = createFileRoute("/opportunity/$id")({
  head: ({ params }) => {
    const o = getOpportunity(params.id);
    const t = o ? `${o.title} — ${o.organizer} | Opportunity Hub` : "Opportunity details — Opportunity Hub";
    const d = o?.summary ?? "Hackathon or internship details: deadline, eligibility, stipend or prize and source link.";
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
      ],
    };
  },
  notFoundComponent: DetailNotFound,
  component: Detail,
});

function DetailNotFound() {
  return (
    <AppShell>
      <EmptyState
        title="Opportunity not found"
        description="It may have been removed."
        action={
          <Button asChild>
            <Link to="/">Back to dashboard</Link>
          </Button>
        }
      />
    </AppShell>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}

function Detail() {
  const { id } = Route.useParams();
  const { get, status } = useOpportunities();
  const o = get(id);
  if (!o) {
    if (status === "loading") return <AppShell><p className="text-sm text-muted-foreground" role="status">Loading opportunity…</p></AppShell>;
    return <DetailNotFound />;
  }
  const closed = (daysLeft(o.deadline) ?? 0) < 0;
  const back = isHackathon(o) ? "/hackathons" : "/internships";

  return (
    <AppShell>
      <DemoBanner />
      <Button asChild variant="ghost" size="sm" className="mb-4 gap-2">
        <Link to={back}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to {isHackathon(o) ? "hackathons" : "internships"}
        </Link>
      </Button>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="capitalize">{o.kind}</Badge>
              {o.demo ? <Badge variant="outline" className="border-dashed">Demo Data</Badge> : <Badge variant="outline" className="capitalize">{o.verificationStatus}</Badge>}
              <DeadlinePill deadline={o.deadline} />
            </div>
            <h1 className="mt-3 font-display text-3xl font-semibold">{o.title}</h1>
            <p className="mt-1 text-muted-foreground">{o.organizer} · {o.location ?? "Location not stated"}</p>
          </div>
          <Card className="card-elevated p-5">
            <h2 className="font-semibold">About</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{o.description || o.summary || "No description provided by the source."}</p>
          </Card>
          <Card className="card-elevated p-5">
            <h2 className="font-semibold">Eligibility</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {o.eligibility.length ? o.eligibility.map((e) => <li key={e}>{e}</li>) : <li>Not stated</li>}
            </ul>
          </Card>
          <div className="flex flex-wrap gap-2">
            {o.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
          </div>
        </div>
        <aside>
          <Card className="card-elevated sticky top-20 space-y-5 p-5">
            <dl className="grid grid-cols-2 gap-4">
              <Fact label="Deadline" value={formatDate(o.deadline)} />
              <Fact label="Mode" value={o.mode ? o.mode.charAt(0).toUpperCase() + o.mode.slice(1) : "Not stated"} />
              {isHackathon(o) ? (
                <>
                  <Fact label="Dates" value={formatDateRange(o.startDate, o.endDate)} />
                  <Fact label="Team" value={o.teamSize ?? "Not stated"} />
                  <Fact label="Prize pool" value={formatINR(o.prizePool)} />
                  <Fact label="Entry fee" value={o.fee === 0 ? "Free" : formatINR(o.fee)} />
                </>
              ) : (
                <>
                  <Fact label="Role" value={o.role ?? "Not stated"} />
                  <Fact label="Duration" value={o.duration ?? "Not stated"} />
                  <Fact label="Stipend" value={o.paid === null ? "Not stated" : o.paid ? `${formatINR(o.stipend)}/mo` : "Unpaid"} />
                  <Fact label="Openings" value={o.openings === null ? "Not stated" : String(o.openings)} />
                </>
              )}
            </dl>
            <div className="flex flex-col gap-2">
              {closed ? (
                <Button disabled>Applications closed</Button>
              ) : (
                <Button asChild className="gap-2">
                  <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {isHackathon(o) ? "Register" : "Apply"} <ExternalLink className="h-4 w-4" aria-hidden />
                  </a>
                </Button>
              )}
              <SaveButton id={o.id} title={o.title} variant="full" />
            </div>
            <SourceMeta o={o} />
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}
