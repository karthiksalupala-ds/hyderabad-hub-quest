import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { InterestTag } from "@/lib/types";

const STORAGE_KEY = "ohub.profile.v1";

export interface Profile {
  name: string;
  interests: InterestTag[];
  locations: string[];
  notifyEmail: boolean;
  notifyDeadline: boolean;
  notifyWeekly: boolean;
}

export const DEFAULT_PROFILE: Profile = {
  name: "B.Tech Data Science Student",
  interests: ["AI/ML", "Data Science", "Python", "Agentic AI"],
  locations: ["Hyderabad", "Remote"],
  notifyEmail: true,
  notifyDeadline: true,
  notifyWeekly: false,
};

interface ProfileContextValue {
  profile: Profile;
  hydrated: boolean;
  update: (patch: Partial<Profile>) => void;
  reset: () => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setProfile({ ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<Profile>) });
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // ignore
    }
  }, [profile, hydrated]);

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile,
      hydrated,
      update: (patch) => setProfile((p) => ({ ...p, ...patch })),
      reset: () => setProfile(DEFAULT_PROFILE),
    }),
    [profile, hydrated],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
