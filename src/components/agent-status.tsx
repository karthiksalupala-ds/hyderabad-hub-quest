import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, PlugZap, RefreshCw, Wifi, WifiOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useOpportunities } from "@/hooks/use-opportunities";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatDateTime, relativeTime } from "@/lib/format";

type Source = Tables<"source_registry">;
type Run = Tables<"ingestion_runs">;

interface Stats {
  sources: Source[];
  runs: Run[];
  verified: number;
  unverified: number;
  failed: number;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-background/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function AgentStatus() {
  const { isLive, online, lastSyncedAt, refresh, status } = useOpportunities();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    const count = (v: string) =>
      supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("status", "active").eq("verification_status", v);
    const [s, r, v, u, f] = await Promise.all([
      supabase.from("source_registry").select("*").order("name"),
      supabase.from("ingestion_runs").select("*").order("started_at", { ascending: false }).limit(50),
      count("verified"),
      count("unverified"),
      count("failed"),
    ]);
    if (s.error || r.error) {
      setError("Could not reach the live database. Showing cached state.");
      return;
    }
    setStats({ sources: s.data, runs: r.data, verified: v.count ?? 0, unverified: u.count ?? 0, failed: f.count ?? 0 });
  };

  useEffect(() => {
    if (online) void load();
  }, [online]);

  const enabled = stats?.sources.filter((s) => s.enabled && s.status !== "not_configured") ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const todayRuns = stats?.runs.filter((r) => r.started_at.slice(0, 10) === today) ?? [];
  const sum = (k: "inserted" | "updated" | "expired") => todayRuns.reduce((a, r) => a + r[k], 0);
  const lastSuccess = stats?.runs.find((r) => r.status === "success");
  const errors = stats?.runs.filter((r) => r.error).slice(0, 3) ?? [];

  return (
    <Card className="card-elevated space-y-5 p-5" aria-labelledby="agent-status-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="agent-status-heading" className="font-semibold">Live Data / Agent Status</h2>
          <p className="text-sm text-muted-foreground">Where your listings come from and how fresh they are.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={!online}
          onClick={() => {
            refresh();
            void load();
          }}
        >
          <RefreshCw className="h-4 w-4" aria-hidden /> Check now
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {isLive ? (
          <Badge className="gap-1"><Database className="h-3 w-3" aria-hidden /> Live database connected</Badge>
        ) : (
          <Badge variant="outline" className="gap-1 border-dashed"><Database className="h-3 w-3" aria-hidden /> Fallback mode — demo data</Badge>
        )}
        {online ? (
          <Badge variant="outline" className="gap-1 border-success/40 text-success"><Wifi className="h-3 w-3" aria-hidden /> Online</Badge>
        ) : (
          <Badge variant="outline" className="gap-1 border-warning/50"><WifiOff className="h-3 w-3" aria-hidden /> Offline</Badge>
        )}
        <Badge variant="secondary">Last sync: {lastSyncedAt ? relativeTime(lastSyncedAt) : "never"}</Badge>
      </div>

      {!isLive && (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          {status === "loading"
            ? "Checking the live database…"
            : "No live listings yet. The cards you see are sample records for preview only — they are not real opportunities and their links do not work."}
        </p>
      )}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Active sources" value={stats ? `${enabled.length}/${stats.sources.length}` : "—"} />
        <Stat label="New today" value={stats ? sum("inserted") : "—"} />
        <Stat label="Updated today" value={stats ? sum("updated") : "—"} />
        <Stat label="Expired today" value={stats ? sum("expired") : "—"} />
        <Stat label="Verified" value={stats?.verified ?? "—"} />
        <Stat label="Unverified / failed" value={stats ? `${stats.unverified} / ${stats.failed}` : "—"} />
      </div>
      <p className="text-xs text-muted-foreground">
        Last successful import: {lastSuccess ? formatDateTime(lastSuccess.finished_at ?? lastSuccess.started_at) : "none yet"}
      </p>

      {stats && enabled.length === 0 && (
        <div className="flex gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
          <PlugZap className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="font-medium">No real sources are connected yet</p>
            <p className="mt-1 text-muted-foreground">
              Live listings will appear here automatically once a permitted feed or partner access is set up for one of the sources below.
            </p>
          </div>
        </div>
      )}

      {stats && (
        <ul className="divide-y rounded-lg border">
          {stats.sources.map((s) => {
            const ok = s.enabled && s.status === "ready";
            return (
              <li key={s.id} className="flex flex-wrap items-start justify-between gap-2 p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{s.name}</p>
                  {s.requirement && !ok && <p className="text-xs text-muted-foreground">Needs: {s.requirement}</p>}
                  {s.last_error && <p className="text-xs text-destructive">{s.last_error}</p>}
                </div>
                <Badge variant={ok ? "default" : "outline"} className="gap-1 capitalize">
                  {ok ? <CheckCircle2 className="h-3 w-3" aria-hidden /> : null}
                  {s.status.replace("_", " ")}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}

      {errors.length > 0 && (
        <div>
          <h3 className="text-sm font-medium">Latest errors</h3>
          <ul className="mt-2 space-y-1">
            {errors.map((r) => (
              <li key={r.id} className="flex gap-2 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {formatDateTime(r.started_at)} · {r.source_id ?? "pipeline"}: {r.error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
