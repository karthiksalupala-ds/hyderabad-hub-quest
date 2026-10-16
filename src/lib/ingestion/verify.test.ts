import { describe, expect, test } from "bun:test";

import { parseFeed, parseGreenhouse, parseMcpResult } from "./adapters.server";
import { canonicalizeUrl, toIsoDate } from "./normalize";
import { detectChanges, hostAllowed, isDue, nextPollMinutes, verifyCandidate } from "./verify";

describe("source-grounded verification", () => {
  const candidate = {
    kind: "internship" as const,
    title: "Data Science Intern",
    organizer: "Acme Labs",
    url: "https://jobs.acme.com/openings/data-science-intern",
    applicationUrl: "https://jobs.acme.com/openings/data-science-intern/apply",
    role: "Data Science Intern",
    location: "Hyderabad",
    mode: "offline" as const,
    startDate: null,
    endDate: null,
    deadline: "2027-01-15",
    evidence: { pageTitle: "Data Science Intern", source: "Acme careers page" },
  };

  test("verifies complete source-backed internship facts on an allowed domain", () => {
    expect(verifyCandidate(candidate, ["acme.com"]).status).toBe("verified");
  });

  test("keeps records needing review when source evidence is absent", () => {
    expect(verifyCandidate({ ...candidate, evidence: null }, ["acme.com"]).status).toBe("needs_verification");
  });

  test("rejects placeholder listing URLs", () => {
    const result = verifyCandidate(
      { ...candidate, url: "https://example.com/demo/data-science-intern" },
      ["example.com"],
    );
    expect(result.status).toBe("rejected");
    expect(result.reasons).toContain("placeholder/test URL");
  });

  test("does not accept lookalike domains as allowlisted subdomains", () => {
    expect(hostAllowed("https://jobs.acme.com/role", ["acme.com"])).toBe(true);
    expect(hostAllowed("https://acme.com.attacker.test/role", ["acme.com"])).toBe(false);
  });
});

describe("adaptive source scheduling", () => {
  test("never polls more frequently than hourly and backs off after empty runs", () => {
    expect(nextPollMinutes(15, 0)).toBe(60);
    expect(nextPollMinutes(360, 1)).toBe(720);
    expect(nextPollMinutes(360, 6)).toBe(10080);
    expect(nextPollMinutes(360, 10)).toBe(10080);
  });

  test("honours next_run_at and the one-hour safety floor", () => {
    const source = {
      last_run_at: "2026-10-16T10:00:00.000Z",
      next_run_at: "2026-10-16T10:30:00.000Z",
      poll_interval_minutes: 360,
    };
    expect(isDue(source, Date.parse("2026-10-16T10:45:00.000Z"))).toBe(false);
    expect(isDue(source, Date.parse("2026-10-16T11:00:00.000Z"))).toBe(true);
  });
});

describe("ingestion normalization and change detection", () => {
  test("canonicalizes tracking links for stable deduplication", () => {
    expect(canonicalizeUrl("https://WWW.Acme.com/job/1?utm_source=newsletter&b=2&a=1#apply")).toBe(
      "https://acme.com/job/1?a=1&b=2",
    );
  });

  test("parses unambiguous dates and leaves ambiguous numeric dates unset", () => {
    expect(toIsoDate("16 Oct 2026")).toBe("2026-10-16");
    expect(toIsoDate("03/04/2026")).toBe(null);
  });

  test("does not mark a field as changed when the new source omitted it", () => {
    const prev = {
      deadline: "2026-11-01",
      location: "Hyderabad",
      city: "Hyderabad",
      mode: "offline",
      prize_pool: 10000,
      stipend: 0,
      application_url: "https://acme.com/apply",
      content_hash: "old-hash",
    };
    const changes = detectChanges(prev, { ...prev, deadline: null, stipend: null, content_hash: "new-hash" });
    expect(changes).toEqual([]);
  });

  test("detects explicit deadline changes", () => {
    const prev = {
      deadline: "2026-11-01",
      location: "Hyderabad",
      city: "Hyderabad",
      mode: "offline",
      prize_pool: null,
      stipend: null,
      application_url: null,
      content_hash: "same",
    };
    const changes = detectChanges(prev, { ...prev, deadline: "2026-11-15" });
    expect(changes.map((change) => change.change_type)).toEqual(["deadline_changed"]);
  });
});

describe("provider adapter parsing", () => {
  test("parses an RSS item without inventing an application deadline", () => {
    const xml = `<?xml version="1.0"?>
      <rss><channel><title>Example Events</title>
        <item>
          <title>Student Data Challenge</title>
          <link>https://events.example.org/data-challenge</link>
          <description>Build a useful project with open data.</description>
          <pubDate>Fri, 16 Oct 2026 10:00:00 GMT</pubDate>
        </item>
      </channel></rss>`;
    const items = parseFeed(xml, {
      url: "https://events.example.org/feed.xml",
      kind: "hackathon",
      organizer: "Example Events",
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("Student Data Challenge");
    expect(items[0]?.deadline).toBe(null);
    expect(items[0]?.organizer).toBe("Example Events");
  });

  test("maps only internship roles from a Greenhouse feed by default", () => {
    const items = parseGreenhouse(
      {
        jobs: [
          {
            title: "Data Science Intern",
            absolute_url: "https://boards.greenhouse.io/acme/jobs/123",
            location: { name: "Hyderabad, India" },
            content: "Use Python and SQL to analyse product data.",
          },
          {
            title: "Senior Platform Engineer",
            absolute_url: "https://boards.greenhouse.io/acme/jobs/124",
            location: { name: "Remote" },
            content: "Operate services.",
          },
        ],
      },
      {
        url: "https://boards-api.greenhouse.io/v1/boards/acme/jobs",
        organizer: "Acme",
        format: "greenhouse",
      },
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.role).toBe("Data Science Intern");
    expect(items[0]?.applicationUrl).toBe("https://boards.greenhouse.io/acme/jobs/123");
  });

  test("returns structured MCP tool items and ignores tool errors", () => {
    expect(parseMcpResult({ result: { structuredContent: { items: [{ title: "Intern" }] } } }, "items")).toEqual([
      { title: "Intern" },
    ]);
    expect(parseMcpResult({ result: { isError: true, structuredContent: { items: [{ title: "Fake" }] } } }, "items")).toEqual([]);
  });
});
