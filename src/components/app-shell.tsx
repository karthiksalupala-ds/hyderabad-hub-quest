import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bookmark,
  Cpu,
  LayoutDashboard,
  Menu,
  Search,
  Settings,
  Trophy,
  User,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useSaved } from "@/hooks/use-saved";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/hackathons", label: "Hackathons", icon: Trophy },
  { to: "/internships", label: "Internships", icon: Cpu },
  { to: "/saved", label: "Saved", icon: Bookmark },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <img src="/ihub-logo.svg" alt="" className="h-10 w-10 rounded-xl" />
      <span className="leading-tight">
        <span className="block font-display text-base font-bold tracking-tight"><span className="text-primary">i</span>Hub</span>
        <span className="block text-[11px] text-muted-foreground">Information Hub</span>
      </span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { saved } = useSaved();

  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon }) => {
        const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="flex-1">{label}</span>
            {to === "/saved" && saved.length > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1.5 text-[11px]">
                {saved.length}
              </Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  children,
  search,
  onSearchChange,
}: {
  children: ReactNode;
  search?: string;
  onSearchChange?: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [quick, setQuick] = useState("");
  const { saved } = useSaved();
  const { profile } = useProfile();

  const value = onSearchChange ? (search ?? "") : quick;
  const setValue = onSearchChange ?? setQuick;

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 lg:flex">
        <Brand />
        <div className="mt-8 flex-1">
          <NavLinks />
        </div>
        <div className="rounded-xl border bg-card p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Demo dataset</p>
          <p className="mt-1">Live integrations are not connected yet.</p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-sidebar p-4">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <Brand />
                <div className="mt-8">
                  <NavLinks onNavigate={() => setOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>

            <div className="lg:hidden">
              <Brand />
            </div>

            <div className="ml-auto flex flex-1 items-center justify-end gap-2">
              <div className="relative hidden w-full max-w-sm sm:block">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <label htmlFor="global-search" className="sr-only">
                  Search opportunities
                </label>
                <Input
                  id="global-search"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Search hackathons, internships, tags…"
                  className="pl-9"
                />
              </div>

              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link to="/saved">
                  <Bookmark className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">Saved</span>
                  <span className="tabular-nums">{saved.length}</span>
                </Link>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Profile menu">
                    <span className="bg-gradient-brand flex h-8 w-8 items-center justify-center rounded-full">
                      <User className="h-4 w-4 text-primary-foreground" aria-hidden />
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel className="font-normal">
                    <span className="block text-sm font-medium">{profile.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {profile.interests.slice(0, 3).join(" · ") || "No interests set"}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/settings">Profile & interests</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/saved">Saved opportunities</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {onSearchChange && (
            <div className="border-t px-4 py-2 sm:hidden">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <label htmlFor="mobile-search" className="sr-only">
                  Search opportunities
                </label>
                <Input
                  id="mobile-search"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Search…"
                  className="pl-9"
                />
              </div>
            </div>
          )}
        </header>

        <main className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
