import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { allOpportunities as demoRecords } from "@/lib/data";
import type { InterestTag, Opportunity } from "@/lib/types";

type Row = Tables<"opportunities">;
type Status = "loading" | "live" | "empty" | "error" | "offline";

const CACHE_KEY = "ohub:live-cache:v1";

export function rowToOpportunity(r: Row): Opportunity {
  const base = {
    id: r.id,
    title: r.title,
    organizer: r.organizer,
    source: r.source_name,
    sourceUrl: r.source_url,
    description: r.description ?? "",
    summary: r.summary ?? "",
    location: r.location,
    city: r.city,
    mode: r.mode as Opportunity["mode"],
    startDate: r.start_date,
    deadline: r.deadline,
    eligibility: r.eligibility,
    tags: r.tags as InterestTag[],
    verified: r.verification_status === "verified",
    verificationStatus: r.verification_status as Opportunity["verificationStatus"],
    lastCheckedAt: r.last_checked_at,
    demo: false,
    postedAt: r.posted_at ?? r.first_seen_at,
  };
  if (r.kind === "hackathon") {
    return { ...base, kind: "hackathon", endDate: r.end_date, fee: r.fee, teamSize: r.team_size, prizePool: r.prize_pool, studentFriendly: true };
  }
  return {
    ...base,
    kind: "internship",
    role: r.role,
    duration: r.duration,
    stipend: r.stipend,
    paid: r.stipend === null ? null : r.stipend > 0,
    openings: r.openings,
  };
}

interface Ctx {
  /** Live records when present, otherwise labelled demo fallback */
  items: Opportunity[];
  isLive: boolean;
  status: Status;
  online: boolean;
  lastSyncedAt: string | null;
  refresh: () => void;
  get: (id: string) => Opportunity | undefined;
}

const OpportunitiesContext = createContext<Ctx | null>(null);

export function OpportunitiesProvider({ children }: { children: ReactNode }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [online, setOnline] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const rowsRef = useRef<Row[]>([]);

  const commit = useCallback((next: Row[], synced: boolean) => {
    rowsRef.current = next;
    setRows(next);
    if (synced) {
      const at = new Date().toISOString();
      setLastSyncedAt(at);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ at, rows: next }));
      } catch {
        /* storage full — ignore */
      }
    }
  }, []);

  const load = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline");
      return;
    }
    const { data, error } = await supabase
      .from("opportunities")
      .select("*")
      .eq("status", "active")
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(500);
    if (error) {
      setStatus(rowsRef.current.length ? "offline" : "error");
      return;
    }
    commit(data, true);
    setStatus(data.length ? "live" : "empty");
  }, [commit]);

  // Hydrate from cache, then fetch
  useEffect(() => {
    setOnline(navigator.onLine);
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") as { at: string; rows: Row[] } | null;
      if (cached?.rows?.length) {
        commit(cached.rows, false);
        setLastSyncedAt(cached.at);
      }
    } catch {
      /* ignore corrupt cache */
    }
    void load();
    const goOnline = () => {
      setOnline(true);
      toast.success("Back online — syncing opportunities");
      void load();
    };
    const goOffline = () => {
      setOnline(false);
      setStatus("offline");
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [load, commit]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("opportunities-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "opportunities" }, (payload) => {
        const cur = rowsRef.current;
        if (payload.eventType === "DELETE") {
          const id = (payload.old as Partial<Row>).id;
          commit(cur.filter((r) => r.id !== id), true);
        } else {
          const row = payload.new as Row;
          const rest = cur.filter((r) => r.id !== row.id);
          const next = row.status === "active" ? [...rest, row] : rest;
          commit(next, true);
          if (payload.eventType === "INSERT" && row.status === "active") {
            toast(`New ${row.kind}: ${row.title}`, { description: row.organizer });
          }
        }
        setStatus(rowsRef.current.length ? "live" : "empty");
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [commit]);

  const value = useMemo<Ctx>(() => {
    const live = rows.map(rowToOpportunity);
    const isLive = live.length > 0;
    const items = isLive ? live : demoRecords;
    return {
      items,
      isLive,
      status,
      online,
      lastSyncedAt,
      refresh: () => void load(),
      get: (id) => items.find((o) => o.id === id) ?? demoRecords.find((o) => o.id === id),
    };
  }, [rows, status, online, lastSyncedAt, load]);

  return <OpportunitiesContext.Provider value={value}>{children}</OpportunitiesContext.Provider>;
}

export function useOpportunities() {
  const ctx = useContext(OpportunitiesContext);
  if (!ctx) throw new Error("useOpportunities must be used inside OpportunitiesProvider");
  return ctx;
}
