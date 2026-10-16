import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseFeed, parseGreenhouse, parseMcpResult } from "./adapters.server";
import { isDue } from "./pipeline.server";
import { canonicalizeUrl, toIsoDate } from "./normalize";
import { detectChanges, hostAllowed, nextPollMinutes, verifyCandidate } from "./verify";

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

  it("verifies complete source-backed internship facts on an allowed domain", () => {
    assert.equal(verifyCandidate(candidate, ["acme.com"]).status, "verified");
  });

  it("keeps records needing review when source evidence is absent", () => {
    assert.equal(verifyCandidate({ ...candidate, evidence: null }, ["acme.com"]).status, "needs_verification");
  });

  it("rejects placeholder listing URLs", () => {
    const result = verifyCandidate(
      { ...candidate, url: "https://example.com/demo/data-science-intern" },
      ["example.com"],
    );
    assert.equal(result.status, "rejected");
    assert.ok(result.reasons.includes("placeholder/test URL"));
  });

  it("does not accept lookalike domains as allowlisted subdomains", () => {
    assert.equal(hostAllowed("https://jobs.acme.com/role", ["acme.com"]), true);
    assert.equal(hostAllowed("https://acme.com.attacker.test/role", ["acme.com"]), false);
  });
});

describe("adaptive source scheduling", () => {
  it("never polls more frequently than hourly and backs off after empty runs", () => {
    assert.equal(nextPollMinutes(15, 0), 60);
    assert.equal(nextPollMinutes(360, 1), 720);
    assert.equal(nextPollMinutes(360, 6), 10080);
    assert.equal(nextPollMinutes(360, 10), 10080);
  });

  it("honours next_run_at and the one-hour safety floor", () => {
    const source = {
      last_run_at: "2026-10-16T10:00:00.000Z",
      next_run_at: "2026-10-16T10:30:00.000Z",
      poll_interval_minutes: 360,
    };
    assert.equal(isDue(source, Date.parse("2026-10-16T10:45:00.000Z")), false);
    assert.equal(isDue(source, Date.parse("2026-10-16T11:00:00.000Z")), true);
  });
});

describe("ingestion normalization and change detection", () => {
  it("canonicalizes tracking links for stable deduplication", () => {
    assert.equal(canonicalizeUrl("https://WWW.Acme.com/job/1?utm_source=newsletter&b=2&a=1#apply"), "https://acme.com/job/1?a=1&b=2");
  });

  it("parses unambiguous dates and leaves ambiguous numeric dates unset", () => {
    assert.equal(toIsoDate("16 Oct 2026"), "2026-10-16");
    assert.equal(toIsoDate("03/04/2026"), null);
  });

  it("does not mark a field as changed when the new source omitted it", () => {
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
    const changes = detectChanges(prev, { ...prev, deadline: null, stipend: null, content_hash: "old-hash" });
    assert.deepEqual(changes, []);
  });

  it("detects explicit deadline changes", () => {
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
    assert.deepEqual(changes.map((change) => change.change_type), ["deadline_changed"]);
  });
});

describe("provider adapter parsing", () => {
  it("parses an RSS item without inventing an application deadline", () => {
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
    assert.equal(items.length, 1);
    assert.equal(items[0]?.title, "Student Data Challenge");
    assert.equal(items[0]?.deadline, null);
    assert.equal(items[0]?.organizer, "Example Events");
  });

  it("maps only internship roles from a Greenhouse feed by default", () => {
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
    assert.equal(items.length, 1);
    assert.equal(items[0]?.role, "Data Science Intern");
    assert.equal(items[0]?.applicationUrl, "https://boards.greenhouse.io/acme/jobs/123");
  });

  it("returns structured MCP tool items and ignores tool errors", () => {
    assert.deepEqual(parseMcpResult({ result: { structuredContent: { items: [{ title: "Intern" }] } } }, "items"), [{ title: "Intern" }]);
    assert.deepEqual(parseMcpResult({ result: { isError: true, structuredContent: { items: [{ title: "Fake" }] } } }, "items"), []);
  });
});
