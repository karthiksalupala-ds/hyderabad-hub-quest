import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { FilterChip } from "@/components/filter-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useProfile } from "@/hooks/use-profile";
import { AgentStatus } from "@/components/agent-status";
import { ALL_TAGS } from "@/lib/types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Opportunity Hub" },
      { name: "description", content: "Set your interests, preferred locations and reminder preferences." },
      { property: "og:title", content: "Settings — Opportunity Hub" },
      { property: "og:description", content: "Personalise recommendations for hackathons and internships." },
    ],
  }),
  component: SettingsPage,
});

const LOCATIONS = ["Hyderabad", "Remote", "Bengaluru", "Pune", "Chennai"];

function SettingsPage() {
  const { profile, update, reset } = useProfile();
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">Changes save automatically on this device.</p>

      <div className="mt-6 grid gap-4">
        <AgentStatus />
        <Card className="card-elevated p-5">
          <Label htmlFor="name">Display name</Label>
          <Input
            id="name"
            className="mt-2 max-w-sm"
            value={profile.name}
            onChange={(e) => update({ name: e.target.value })}
          />
        </Card>
        <Card className="card-elevated p-5">
          <h2 className="font-semibold">Interests</h2>
          <p className="text-sm text-muted-foreground">Used for "For you" recommendations.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {ALL_TAGS.map((t) => (
              <FilterChip
                key={t}
                label={t}
                active={profile.interests.includes(t)}
                onToggle={() => update({ interests: toggle(profile.interests, t) })}
              />
            ))}
          </div>
        </Card>
        <Card className="card-elevated p-5">
          <h2 className="font-semibold">Preferred locations</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {LOCATIONS.map((l) => (
              <FilterChip
                key={l}
                label={l}
                active={profile.locations.includes(l)}
                onToggle={() => update({ locations: toggle(profile.locations, l) })}
              />
            ))}
          </div>
        </Card>
        <Card className="card-elevated space-y-4 p-5">
          <h2 className="font-semibold">Notifications</h2>
          <p className="text-xs text-muted-foreground">Preferences only — reminders arrive once live integrations launch.</p>
          {(
            [
              ["notifyEmail", "Email updates"],
              ["notifyDeadline", "Deadline reminders"],
              ["notifyWeekly", "Weekly digest"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-4 text-sm">
              {label}
              <Switch checked={profile[key]} onCheckedChange={(v) => update({ [key]: v })} />
            </label>
          ))}
        </Card>
        <div>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              toast.info("Settings reset to defaults");
            }}
          >
            Reset to defaults
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
