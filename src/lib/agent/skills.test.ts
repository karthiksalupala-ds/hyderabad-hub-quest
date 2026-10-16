import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAgentInstructions,
  routeSkill,
  scoreOpportunity,
  type AgentOpportunity,
} from "./skills.server";

const opportunity: AgentOpportunity = {
  id: "op-1",
  kind: "internship",
  title: "Data Science Intern",
  organizer: "Acme",
  summary: "Use Python to analyse product data.",
  sourceName: "Acme careers",
  sourceUrl: "https://jobs.acme.com/data-science-intern",
  applicationUrl: "https://jobs.acme.com/data-science-intern/apply",
  location: "Hyderabad",
  city: "Hyderabad",
  mode: "offline",
  deadline: "2027-01-15",
  startDate: null,
  eligibility: ["Undergraduate students"],
  tags: ["Data Science", "Python"],
  stipend: 15000,
  prizePool: null,
  fee: null,
  lastChangeAt: null,
  lastChangeSummary: null,
};

describe("iHub agent skill router", () => {
  it("routes new-opportunity questions to discovery", () => {
    assert.equal(routeSkill("Find AI internships in Hyderabad"), "discovery");
  });

  it("routes official-source and eligibility checks to verification", () => {
    assert.equal(routeSkill("Verify this opportunity's eligibility and application link"), "verification");
  });

  it("routes personal recommendation requests to matching", () => {
    assert.equal(routeSkill("Recommend opportunities based on my profile"), "matching");
  });

  it("routes tracked updates to the changes skill", () => {
    assert.equal(routeSkill("What changed in deadlines last month?"), "changes");
  });

  it("routes imminent deadline questions to the alerts skill", () => {
    assert.equal(routeSkill("What deadlines are closing this week?"), "alerts");
  });

  it("scores configured interests and preferred locations transparently", () => {
    assert.equal(scoreOpportunity(opportunity, {
      interests: ["Data Science", "Python"],
      locations: ["Hyderabad"],
    }), 14);
  });

  it("instructs the model not to invent missing facts or claim web-wide search", () => {
    const instructions = buildAgentInstructions("verification", "No matching verified listing found.");
    assert.match(instructions, /Never invent/);
    assert.match(instructions, /Do not claim that you searched the whole web/);
  });
});
