import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { DemoBanner } from "@/components/demo-banner";
import { EmptyState } from "@/components/empty-state";
import { OpportunityCard, OpportunityCardSkeleton } from "@/components/opportunity-card";
import { Button } from "@/components/ui/button";
import { useSaved } from "@/hooks/use-saved";
import { useOpportunities } from "@/hooks/use-opportunities";
import { sortOpportunities } from "@/lib/filters";

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "Saved Opportunities — Opportunity Hub" },
      { name: "description", content: "Your bookmarked hackathons and internships in one list." },
      { property: "og:title", content: "Saved Opportunities — Opportunity Hub" },
      { property: "og:description", content: "Keep track of the hackathons and internships you bookmarked." },
    ],
  }),
  component: SavedPage,
});

function SavedPage() {
  const { saved, hydrated } = useSaved();
  const items = sortOpportunities(
    items.filter((o) => saved.includes(o.id)),
    "deadline",
  );
  return (
    <AppShell>
      <DemoBanner />
      <h1 className="font-display text-3xl font-semibold">Saved</h1>
      <p className="mt-1 text-sm text-muted-foreground">Sorted by nearest deadline. Stored on this device.</p>
      <div className="mt-6">
        {!hydrated ? (
          <div className="grid gap-4 md:grid-cols-2">
            <OpportunityCardSkeleton />
            <OpportunityCardSkeleton />
          </div>
        ) : items.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((o) => (
              <OpportunityCard key={o.id} opportunity={o} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nothing saved yet"
            description="Tap the bookmark on any opportunity to keep it here."
            action={
              <Button asChild>
                <Link to="/hackathons">Browse hackathons</Link>
              </Button>
            }
          />
        )}
      </div>
    </AppShell>
  );
}
