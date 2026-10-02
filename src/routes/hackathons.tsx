import { createFileRoute } from "@tanstack/react-router";
import { BrowsePage } from "@/components/browse-page";
import { useOpportunities } from "@/hooks/use-opportunities";

export const Route = createFileRoute("/hackathons")({
  head: () => ({
    meta: [
      { title: "Hyderabad Hackathons — Opportunity Hub" },
      { name: "description", content: "Browse offline hackathons across Hyderabad with deadlines, prizes and team sizes." },
      { property: "og:title", content: "Hyderabad Hackathons — Opportunity Hub" },
      { property: "og:description", content: "In-person hackathons in Hyderabad for B.Tech students." },
    ],
  }),
  component: function Page() {
    const { items } = useOpportunities();
    return (
    <BrowsePage
      kind="hackathon"
      title="Hackathons"
      description="In-person and hybrid hackathons across Hyderabad."
      items={items.filter((o) => o.kind === "hackathon")}
    />
  );
  },
});
