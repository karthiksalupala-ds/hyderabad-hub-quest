import { Info } from "lucide-react";

export function DemoBanner() {
  return (
    <div
      role="status"
      className="mb-6 flex items-start gap-3 rounded-xl border border-accent bg-accent/50 px-4 py-3 text-sm text-accent-foreground"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>
        <span className="font-medium">Live integrations coming soon</span> — current opportunities are demo
        data created to demonstrate the product. Always confirm details on the organiser&apos;s own page.
      </p>
    </div>
  );
}
