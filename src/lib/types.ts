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
  location: string;
  city: string | null;
  mode: "offline" | "online" | "hybrid" | "remote";
  /** ISO date of the event start or the posting date */
  startDate: string;
  /** ISO date of registration / application deadline */
  deadline: string;
  eligibility: string[];
  tags: InterestTag[];
  verified: boolean;
  /** Every record in this MVP is sample data */
  demo: true;
  postedAt: string;
}

export interface Hackathon extends BaseOpportunity {
  kind: "hackathon";
  endDate: string;
  /** 0 means free to enter */
  fee: number;
  teamSize: string;
  prizePool: number;
  studentFriendly: boolean;
}

export interface Internship extends BaseOpportunity {
  kind: "internship";
  role: string;
  duration: string;
  /** Monthly stipend in INR, 0 means unpaid */
  stipend: number;
  paid: boolean;
  openings: number;
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
