import { Info, Radio, WifiOff } from "lucide-react";

import { useOpportunities } from "@/hooks/use-opportunities";
import { formatDateTime } from "@/lib/format";

export function DemoBanner() {
  const { isLive, online, lastSyncedAt } = useOpportunities();

  if (!online) {
    return (
      <div role="status" className="mb-6 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/15 px-4 py-3 text-sm">
        <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          <span className="font-medium">You&apos;re offline.</span> Showing the last saved list
          {lastSyncedAt ? ` from ${formatDateTime(lastSyncedAt)}` : ""}. It will sync when you reconnect.
        </p>
      </div>
    );
  }

  if (isLive) {
    return (
      <div role="status" className="mb-6 flex items-center gap-3 rounded-xl border border-success/30 bg-success/10 px-4 py-2.5 text-sm">
        <Radio className="h-4 w-4 shrink-0 text-success" aria-hidden />
        <p>
          <span className="font-medium">Live listings</span> — new opportunities appear automatically. Always confirm
          details on the organiser&apos;s own page.
        </p>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="mb-6 flex items-start gap-3 rounded-xl border border-accent bg-accent/50 px-4 py-3 text-sm text-accent-foreground"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>
        <span className="font-medium">Live integrations coming soon</span> — no live sources are connected yet, so
        current opportunities are demo data created to demonstrate the product. They are not real listings.
      </p>
    </div>
  );
}
