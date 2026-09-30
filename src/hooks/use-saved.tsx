import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

const STORAGE_KEY = "ohub.saved.v1";

interface SavedContextValue {
  saved: string[];
  hydrated: boolean;
  isSaved: (id: string) => boolean;
  toggle: (id: string, title?: string) => void;
}

const SavedContext = createContext<SavedContextValue | null>(null);

export function SavedProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) setSaved(parsed.filter((v): v is string => typeof v === "string"));
      }
    } catch {
      // ignore corrupt storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // storage unavailable
    }
  }, [saved, hydrated]);

  const toggle = useCallback((id: string, title?: string) => {
    setSaved((prev) => {
      const exists = prev.includes(id);
      toast[exists ? "info" : "success"](
        exists ? "Removed from saved" : "Saved for later",
        title ? { description: title } : undefined,
      );
      return exists ? prev.filter((v) => v !== id) : [...prev, id];
    });
  }, []);

  const value = useMemo<SavedContextValue>(
    () => ({ saved, hydrated, isSaved: (id) => saved.includes(id), toggle }),
    [saved, hydrated, toggle],
  );

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved() {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error("useSaved must be used within SavedProvider");
  return ctx;
}
