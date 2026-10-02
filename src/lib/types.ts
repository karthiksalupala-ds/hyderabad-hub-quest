export type OpportunityKind = "hackathon" | "internship";

export type InterestTag =
  | "AI/ML"
  | "Data Science"
  | "Python"
  | "Analytics"
  | "Web Development"
  | "Software Engineering"
  | "Agentic AI"
  | "MCP"
  | "Cloud"
  | "Product";

export interface BaseOpportunity {
  id: string;
  kind: OpportunityKind;
  title: string;
  /** Organising body or hiring company */
  organizer: string;
  source: string;
  sourceUrl: string;
  description: string;
  summary: string;
  location: string | null;
  city: string | null;
  mode: "offline" | "online" | "hybrid" | "remote" | null;
  /** ISO date of the event start or the posting date; null when the source does not state it */
  startDate: string | null;
  /** ISO date of registration / application deadline; null when not stated */
  deadline: string | null;
  eligibility: string[];
  tags: InterestTag[];
  verified: boolean;
  verificationStatus: "unverified" | "verified" | "failed";
  /** ISO timestamp of the last time the source was checked; null for demo records */
  lastCheckedAt: string | null;
  /** true for built-in sample records, false for live database records */
  demo: boolean;
  postedAt: string;
}

export interface Hackathon extends BaseOpportunity {
  kind: "hackathon";
  endDate: string | null;
  /** 0 means free to enter, null means not stated */
  fee: number | null;
  teamSize: string | null;
  prizePool: number | null;
  studentFriendly: boolean;
}

export interface Internship extends BaseOpportunity {
  kind: "internship";
  role: string | null;
  duration: string | null;
  /** Monthly stipend in INR, 0 means unpaid, null means not stated */
  stipend: number | null;
  paid: boolean | null;
  openings: number | null;
}

export type Opportunity = Hackathon | Internship;

export const isHackathon = (o: Opportunity): o is Hackathon => o.kind === "hackathon";
export const isInternship = (o: Opportunity): o is Internship => o.kind === "internship";

export const ALL_TAGS: InterestTag[] = [
  "AI/ML",
  "Data Science",
  "Python",
  "Analytics",
  "Web Development",
  "Software Engineering",
  "Agentic AI",
  "MCP",
  "Cloud",
  "Product",
];
