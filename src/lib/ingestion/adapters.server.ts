import { canonicalizeUrl, stripHtml, toIsoDate } from "./normalize";

/** Raw item as found in a source — only fields the source actually provides. */
export interface RawItem {
  kind: "hackathon" | "internship";
  title: string;
  organizer: string | null;
  url: string;
  description: string | null;
  publishedAt: string | null;
  deadline: string | null;
  location: string | null;
}

export interface SourceAdapter {
  id: string;
  /** Returns null when configured, or a human-readable reason it cannot run. */
  missingRequirement(): string | null;
  /** discover + fetch + extract */
  fetchItems(): Promise<RawItem[]>;
}

interface FeedConfig {
  url: string;
  kind: "hackathon" | "internship";
  organizer?: string;
}

function readFeeds(envName: string): FeedConfig[] {
  const raw = process.env[envName];
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as FeedConfig[];
    return parsed.filter((f) => canonicalizeUrl(f.url) && (f.kind === "hackathon" || f.kind === "internship"));
  } catch {
    return [];
  }
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? stripHtml(m[1]) || null : null;
}

function atomLink(block: string): string | null {
  const m = block.match(/<link[^>]*href="([^"]+)"[^>]*\/?>/i);
  return m ? m[1] : null;
}

export function parseFeed(xml: string, cfg: FeedConfig): RawItem[] {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];
  const feedTitle = tag(xml.split(/<(item|entry)[\s>]/i)[0] ?? "", "title");
  const items: RawItem[] = [];
  for (const b of blocks) {
    const title = tag(b, "title");
    const url = tag(b, "link") ?? atomLink(b);
    if (!title || !url) continue;
    items.push({
      kind: cfg.kind,
      title,
      organizer: cfg.organizer ?? tag(b, "author") ?? tag(b, "dc:creator") ?? feedTitle,
      url,
      description: tag(b, "description") ?? tag(b, "summary") ?? tag(b, "content"),
      publishedAt: toIsoDate(tag(b, "pubDate") ?? tag(b, "published") ?? tag(b, "updated")),
      deadline: null, // feeds rarely state deadlines; never guess
      location: null,
    });
  }
  return items;
}

function feedAdapter(id: string, envName: string): SourceAdapter {
  return {
    id,
    missingRequirement: () => (readFeeds(envName).length ? null : `${envName} secret is not set`),
    async fetchItems() {
      const out: RawItem[] = [];
      for (const cfg of readFeeds(envName)) {
        const res = await fetch(cfg.url, {
          headers: { "user-agent": "HyderabadOpportunityHub/1.0 (+feed reader)", accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
        });
        if (!res.ok) throw new Error(`${cfg.url} responded ${res.status}`);
        out.push(...parseFeed(await res.text(), cfg));
      }
      return out;
    },
  };
}

/** Stub for a source that needs a partner API or written permission. */
function permissionStub(id: string, keyName: string, reason: string): SourceAdapter {
  return {
    id,
    missingRequirement: () => (process.env[keyName] ? `${reason} (key found, adapter not implemented until API docs are provided)` : reason),
    async fetchItems() {
      return [];
    },
  };
}

export function getAdapters(): SourceAdapter[] {
  return [
    feedAdapter("rss", "INGEST_FEEDS"),
    feedAdapter("careers", "CAREER_FEEDS"),
    permissionStub("devpost", "DEVPOST_API_KEY", "Devpost has no public API; needs permission or a partner feed"),
    permissionStub("unstop", "UNSTOP_API_KEY", "Unstop partner API access required"),
    permissionStub("internshala", "INTERNSHALA_API_KEY", "Internshala partner API access required"),
  ];
}
