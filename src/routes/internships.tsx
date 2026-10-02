import { createFileRoute } from "@tanstack/react-router";
import { BrowsePage } from "@/components/browse-page";
import { useOpportunities } from "@/hooks/use-opportunities";

export const Route = createFileRoute("/internships")({
  head: () => ({
    meta: [
      { title: "Internships in India — Opportunity Hub" },
      { name: "description", content: "AI/ML, data science and web internships in India, prioritising Hyderabad and remote roles." },
      { property: "og:title", content: "Internships in India — Opportunity Hub" },
      { property: "og:description", content: "Find paid internships in Hyderabad and remote across India." },
    ],
  }),
  component: function Page() {
    const { items } = useOpportunities();
    return (
    <BrowsePage
      kind="internship"
      title="Internships"
      description="Roles across India, with Hyderabad and remote listings first in mind."
      items={items.filter((o) => o.kind === "internship")}
    />
  );
  },
});
