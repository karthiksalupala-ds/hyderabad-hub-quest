import { Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  Clock,
  IndianRupee,
  MapPin,
  Ticket,
  Trophy,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSaved } from "@/hooks/use-saved";
import { relativeTime } from "@/lib/format";
import { deadlineLabel, deadlineTone, formatDate, formatDateRange, formatINR } from "@/lib/format";
import { isHackathon, type Opportunity } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DeadlinePill({ deadline, className }: { deadline: string | null; className?: string }) {
  const tone = deadlineTone(deadline);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "urgent" && "bg-destructive/12 text-destructive",
        tone === "soon" && "bg-warning/20 text-warning-foreground",
        tone === "open" && "bg-success/15 text-success",
        tone === "closed" && "bg-muted text-muted-foreground",
        className,
      )}
    >
      <Clock className="h-3.5 w-3.5" aria-hidden />
      {deadlineLabel(deadline)}
    </span>
  );
}

export function SaveButton({
  id,
  title,
  variant = "icon",
}: {
  id: string;
  title: string;
  variant?: "icon" | "full";
}) {
  const { isSaved, toggle } = useSaved();
  const active = isSaved(id);
  const Icon = active ? BookmarkCheck : Bookmark;

  if (variant === "full") {
    return (
      <Button variant={active ? "secondary" : "outline"} onClick={() => toggle(id, title)} className="gap-2">
        <Icon className="h-4 w-4" aria-hidden />
        {active ? "Saved" : "Save"}
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-pressed={active}
      aria-label={active ? `Remove ${title} from saved` : `Save ${title}`}
      onClick={() => toggle(id, title)}
      className={cn("shrink-0", active && "text-primary")}
    >
      <Icon className="h-4.5 w-4.5" aria-hidden />
    </Button>
  );
}

const MODE_LABEL: Record<NonNullable<Opportunity["mode"]>, string> = {
  offline: "In-person",
  online: "Online",
  hybrid: "Hybrid",
  remote: "Remote",
};

export function OpportunityCard({
  opportunity,
  layout = "grid",
}: {
  opportunity: Opportunity;
  layout?: "grid" | "list";
}) {
  const o = opportunity;
  const hack = isHackathon(o);

  return (
    <Card
      className={cn(
        "card-elevated group relative flex gap-4 overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40",
        layout === "grid" ? "h-full flex-col" : "flex-col sm:flex-row sm:items-start",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={hack ? "default" : "secondary"} className="gap-1">
            {hack ? <Trophy className="h-3 w-3" aria-hidden /> : <Wallet className="h-3 w-3" aria-hidden />}
            {hack ? "Hackathon" : "Internship"}
          </Badge>
          {o.verified && (
            <Badge variant="outline" className="gap-1 border-success/40 text-success">
              <BadgeCheck className="h-3 w-3" aria-hidden />
              Verified
            </Badge>
          )}
          {o.demo ? (
            <Badge variant="outline" className="border-dashed text-muted-foreground">Demo Data</Badge>
          ) : !o.verified ? (
            <Badge variant="outline" className="capitalize text-muted-foreground">{o.verificationStatus}</Badge>
          ) : null}
        </div>

        <h3 className="mt-3 text-base font-semibold leading-snug">
          <Link
            to="/opportunity/$id"
            params={{ id: o.id }}
            className="after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {o.title}
          </Link>
        </h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{o.organizer}</p>
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{o.summary}</p>

        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            <dt className="sr-only">Location</dt>
            <dd className="truncate">
              {o.location ?? "Location not stated"} · {o.mode ? MODE_LABEL[o.mode] : "Mode not stated"}
            </dd>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
            <dt className="sr-only">Dates</dt>
            <dd className="truncate">
              {hack ? formatDateRange(o.startDate, o.endDate) : `Starts ${formatDate(o.startDate)}`}
            </dd>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            {hack ? (
              <Ticket className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <IndianRupee className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <dt className="sr-only">{hack ? "Entry fee" : "Stipend"}</dt>
            <dd className="truncate">
              {hack
                ? o.fee === 0
                  ? "Free entry"
                  : o.fee === null ? "Fee not stated" : `${formatINR(o.fee)} entry`
                : o.paid === null
                  ? "Stipend not stated"
                  : o.paid
                    ? `${formatINR(o.stipend)}/month`
                    : "Unpaid"}
            </dd>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            {hack ? (
              <Trophy className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <Clock className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <dt className="sr-only">{hack ? "Prize pool" : "Duration"}</dt>
            <dd className="truncate">{hack ? (o.prizePool === null ? "Prize not stated" : `${formatINR(o.prizePool)} prizes`) : (o.duration ?? "Duration not stated")}</dd>
          </div>
        </dl>

        <SourceMeta o={o} compact />
        <div className="mt-4 flex flex-wrap gap-1.5">
          {o.tags.map((t) => (
            <Badge key={t} variant="secondary" className="font-normal">
              {t}
            </Badge>
          ))}
        </div>
      </div>

      <div
        className={cn(
          "flex items-center gap-2",
          layout === "grid" ? "justify-between border-t pt-4" : "sm:flex-col sm:items-end sm:border-0 sm:pt-0",
        )}
      >
        <DeadlinePill deadline={o.deadline} />
        <div className="relative z-10 flex items-center gap-1">
          <SaveButton id={o.id} title={o.title} />
        </div>
      </div>
    </Card>
  );
}

export function OpportunityCardSkeleton() {
  return (
    <Card className="flex h-full flex-col gap-3 p-5">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="mt-auto flex gap-2 pt-3">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </Card>
  );
}

export function SourceMeta({ o, compact = false }: { o: Opportunity; compact?: boolean }) {
  if (o.demo) {
    return (
      <p className={cn("text-xs text-muted-foreground", compact ? "mt-3" : "")}>
        Source: {o.source} — sample record, not a real listing.
      </p>
    );
  }
  return (
    <p className={cn("relative z-10 text-xs text-muted-foreground", compact ? "mt-3" : "")}>
      Source:{" "}
      <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
        {o.source}
      </a>
      {" · "}
      <span className="capitalize">{o.verificationStatus}</span>
      {" · "}Checked {relativeTime(o.lastCheckedAt)}
    </p>
  );
}
