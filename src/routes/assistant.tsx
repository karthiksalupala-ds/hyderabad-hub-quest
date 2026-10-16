import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, ExternalLink, LoaderCircle, Send, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/use-profile";

type AgentOpportunity = {
  id: string;
  kind: "hackathon" | "internship";
  title: string;
  organizer: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  applicationUrl: string | null;
  location: string | null;
  city: string | null;
  mode: string | null;
  deadline: string | null;
  startDate: string | null;
  eligibility: string[];
  tags: string[];
  stipend: number | null;
  prizePool: number | null;
  fee: number | null;
  lastChangeAt: string | null;
  lastChangeSummary: string | null;
};

type Skill = "discovery" | "verification" | "matching" | "changes";
type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  skill?: Skill;
  opportunities?: AgentOpportunity[];
  grounded?: boolean;
};

const PROMPTS = [
  "Find AI and data science internships in Hyderabad",
  "Recommend opportunities for my profile",
  "Show recent deadline or stipend changes",
  "Verify this opportunity's eligibility and apply link",
];

const SKILL_LABEL: Record<Skill, string> = {
  discovery: "Opportunity discovery",
  verification: "Source verification",
  matching: "Personalized matching",
  changes: "Recent changes",
};

export const Route = createFileRoute("/assistant")({
  head: () => ({
    meta: [
      { title: "Ask iHub — AI Opportunity Assistant" },
      { name: "description", content: "Ask iHub to find and explain verified student opportunities from its connected sources." },
    ],
  }),
  component: AssistantPage,
});

function dateLabel(value: string | null) {
  if (!value) return "Not stated";
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function money(value: number | null, suffix = "") {
  if (value === null) return "Not stated";
  return value === 0 ? (suffix === "stipend" ? "Unpaid" : "Free") : `₹${value.toLocaleString("en-IN")}${suffix === "stipend" ? "/month" : ""}`;
}

function OpportunityEvidence({ opportunity }: { opportunity: AgentOpportunity }) {
  return (
    <Card className="space-y-3 border bg-background/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{opportunity.organizer}</p>
          <h3 className="mt-1 font-semibold leading-snug">
            <Link to="/opportunity/$id" params={{ id: opportunity.id }} className="hover:underline">
              {opportunity.title}
            </Link>
          </h3>
        </div>
        <Badge variant="secondary">Verified · Live data</Badge>
      </div>
      {opportunity.summary && <p className="text-sm text-muted-foreground">{opportunity.summary}</p>}
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">Location</dt>
          <dd className="mt-1">{opportunity.location ?? "Not stated"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Deadline</dt>
          <dd className="mt-1">{dateLabel(opportunity.deadline)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{opportunity.kind === "internship" ? "Stipend" : "Prize pool"}</dt>
          <dd className="mt-1">{money(opportunity.kind === "internship" ? opportunity.stipend : opportunity.prizePool, opportunity.kind === "internship" ? "stipend" : "")}</dd>
        </div>
      </dl>
      {opportunity.eligibility.length > 0 && (
        <p className="text-sm"><span className="text-muted-foreground">Eligibility: </span>{opportunity.eligibility.join(" · ")}</p>
      )}
      {opportunity.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {opportunity.tags.slice(0, 5).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <a href={opportunity.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
          Source: {opportunity.sourceName} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
        {opportunity.applicationUrl && (
          <a href={opportunity.applicationUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
            Apply <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        )}
      </div>
    </Card>
  );
}

function AssistantPage() {
  const { profile } = useProfile();
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Hey! I’m iHub’s opportunity assistant. Ask me to discover internships or hackathons, check details against connected source records, match opportunities to your interests, or summarize tracked changes. I only present verified live records as real opportunities.",
    },
  ]);

  async function ask(rawQuestion: string) {
    const text = rawQuestion.trim();
    if (text.length < 2 || pending) return;
    const userMessage: Message = { id: `user-${Date.now()}`, role: "user", text };
    setMessages((previous) => [...previous, userMessage]);
    setQuestion("");
    setPending(true);
    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          message: text,
          profile: { interests: profile.interests, locations: profile.locations },
        }),
      });
      const payload = await response.json() as {
        error?: string;
        code?: string;
        skill?: Skill;
        answer?: string;
        opportunities?: AgentOpportunity[];
        grounded?: boolean;
      };
      if (!response.ok) throw new Error(payload.error ?? "iHub could not answer that yet.");
      setMessages((previous) => [...previous, {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: payload.answer ?? "No answer returned.",
        skill: payload.skill,
        opportunities: payload.opportunities ?? [],
        grounded: payload.grounded,
      }]);
    } catch (error) {
      setMessages((previous) => [...previous, {
        id: `error-${Date.now()}`,
        role: "assistant",
        text: error instanceof Error ? error.message : "Connection failed. Please try again.",
      }]);
    } finally {
      setPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(question);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Bot className="h-6 w-6" aria-hidden />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl font-semibold">Ask iHub</h1>
              <Badge variant="outline" className="gap-1"><Sparkles className="h-3 w-3" aria-hidden /> AI assistant</Badge>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Discovery, verification, profile matching, and recent changes — grounded in iHub’s verified active listings.
            </p>
          </div>
        </div>

        <Card className="mt-6 space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap gap-2">
            {PROMPTS.map((prompt) => (
              <Button key={prompt} variant="outline" size="sm" className="h-auto whitespace-normal text-left" disabled={pending} onClick={() => void ask(prompt)}>
                {prompt}
              </Button>
            ))}
          </div>

          <div className="space-y-5" aria-live="polite" aria-label="Conversation">
            {messages.map((message) => (
              <div key={message.id} className={message.role === "user" ? "ml-auto max-w-[90%]" : "max-w-full"}>
                <div className={message.role === "user"
                  ? "ml-auto w-fit max-w-full whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground"
                  : "rounded-2xl rounded-bl-md border bg-muted/40 px-4 py-3 text-sm"}>
                  {message.role === "assistant" && (
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Bot className="h-3.5 w-3.5" aria-hidden />
                      <span>iHub assistant</span>
                      {message.skill && <Badge variant="secondary">{SKILL_LABEL[message.skill]}</Badge>}
                      {message.grounded && <Badge variant="outline">Source-grounded</Badge>}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
                </div>
                {!!message.opportunities?.length && (
                  <div className="mt-3 grid gap-3">
                    {message.opportunities.map((opportunity) => <OpportunityEvidence key={opportunity.id} opportunity={opportunity} />)}
                  </div>
                )}
              </div>
            ))}
            {pending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> Checking verified iHub records…
              </div>
            )}
          </div>

          <form onSubmit={submit} className="border-t pt-4">
            <label htmlFor="ihub-question" className="mb-2 block text-sm font-medium">What opportunities are you looking for?</label>
            <div className="flex items-end gap-2">
              <Textarea
                id="ihub-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask about internships, hackathons, eligibility, deadlines…"
                rows={2}
                maxRows={5}
                maxLength={1200}
                disabled={pending}
                className="min-h-16 resize-y"
              />
              <Button type="submit" size="icon" className="shrink-0" disabled={pending || question.trim().length < 2} aria-label="Send question">
                {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Your question and selected interests/location preferences are sent to the server. Only verified active database listings are included as evidence; this conversation is not saved to your profile.
            </p>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
