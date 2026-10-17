# iHub Agent Skills

This document is the user-facing iHub agent's skill catalogue and implementation reference. The current routing and handlers live in `src/lib/agent/skills.server.ts`; the UI is `src/routes/assistant.tsx`.

All skills read only currently active, verified database opportunities, exclude overdue records, and return at most eight results. They do not use local demo/sample cards as evidence.

## 1. Opportunity Discovery

**Purpose:** Find relevant hackathons or internships from iHub's currently configured database.

**Example prompts**
- “Find AI and data science internships in Hyderabad.”
- “Show me upcoming hackathons.”
- “Find Python internships.”

**Behavior**
- Detects whether the query asks for hackathons, internships, or either kind.
- Searches relevant text across title, organization, description/summary, location, mode, source name, tags, and eligibility.
- Returns matching records with the source URL and, when available, application URL.

**Boundaries**
- This is database retrieval, not a fresh web search.
- Results can be empty if no permitted feeds have populated verified records.
- Missing fields are not guessed.

## 2. Stored-record Verification

**Purpose:** Compare a title or URL mentioned by the student with a record already stored in iHub's verified active listing set.

**Example prompts**
- “Check the official source and eligibility for this internship.”
- “Is this opportunity in iHub's verified records?”
- “Verify this listing: https://example.org/opportunity”

**Behavior**
- Matches a supplied URL against a record's stored source URL or application URL, or matches a title/query against stored listing text.
- Returns the known eligibility, stated deadline, links, and other available fields.

**Boundaries**
- Does **not** fetch or crawl the pasted URL, so it cannot independently verify a new or unknown listing during that request.
- A missing match means “not found in iHub's verified active records,” not a proof that a listing is fraudulent.
- Missing eligibility/deadline/application information is reported as not stated.

## 3. Personalized Matching

**Purpose:** Rank verified active records against the student's current interests and preferred locations.

**Example prompts**
- “Recommend opportunities for my profile.”
- “Which internships best fit my interests?”
- “Find data science opportunities suitable for me.”

**Current scoring**
- +5 for each opportunity tag exactly matching a selected interest tag.
- +3 when a preferred location matches the listing's location/city/mode; “Remote” matches a location/mode containing “remote” or “online”.
- +1 for a stated deadline that has not passed.
- Results sort by score, then earlier deadline, and are limited to eight.

**Boundaries**
- This is explainable rule-based ranking, not model-based personal assessment.
- It does not guarantee eligibility, hiring outcomes, fit, or quality. Students should read the official eligibility requirements.
- It cannot personalize accurately when a live verified dataset is empty.

## 4. Recent Tracked Changes

**Purpose:** Summarize changes that the ingestion pipeline has recorded recently.

**Example prompts**
- “What changed recently?”
- “Show new deadline or stipend updates.”
- “Any recent updates?”

**Behavior**
- Reads verified active records with a recorded `last_change_at` within the previous seven days and a non-empty `last_change_summary`.
- Orders them newest first and returns at most eight.

**Boundaries**
- Reports only changes already tracked by iHub. No tracked summary means it is not reported as a confirmed change.
- It does not reconstruct history or claim a change that is absent from the database.

## 5. Upcoming Deadlines

**Purpose:** List verified active records with a stated deadline within the next seven days (including today).

**Example prompts**
- “What deadlines are closing this week?”
- “Show opportunities due this week.”
- “Any upcoming deadlines?”

**Behavior**
- Filters the verified active records to deadlines from today through seven days ahead.
- Orders by the earliest stated deadline.

**Boundaries**
- Records with no stated deadline cannot be included based on a guessed date.
- This skill is an on-demand lookup only; it does not send reminders, email, push, or WhatsApp messages.

## Skill routing precedence

The router in `routeSkill()` checks skills in this order:

1. Upcoming deadlines: alert / closing / due-this-week phrasing.
2. Recent changes: changed / updated / what’s new phrasing.
3. Stored-record verification: verify / official source / eligibility / application-link phrasing.
4. Personalized matching: recommend / match / for me / based on my profile phrasing.
5. Otherwise, use opportunity discovery.

Because routing is phrase-based, ambiguous questions may map to discovery. When changing trigger phrases, add tests in `src/lib/agent/skills.test.ts`.

## Shared result fields

Each returned opportunity can include: ID, kind, title, organization, summary, source name and URL, application URL, location/city/mode, deadline/start date, eligibility, tags, stipend, prize pool, fee, last-change timestamp, and last-change summary. Values absent from the source record remain null or empty. The UI uses these records to render evidence cards and links.

## Adding a skill

1. Add a distinct `AgentSkill` union value in `skills.server.ts`.
2. Add a routing rule in `routeSkill()`; check precedence so the new phrase does not steal another skill's prompt.
3. Implement the server-side filter/score using the typed database results. Do not give the model unrestricted database access.
4. Update `buildAgentInstructions()` with any skill-specific evidence rules.
5. Update the Ask iHub UI's `Skill` union and labels, if the skill needs a visible label.
6. Add routing and behavior tests, update this document, and run all four CI checks.

## Deferred skills / future work

These are **not implemented yet** and must not be advertised as available functionality:
- Live lookup/crawling of arbitrary external links with independent source checking.
- Scheduled personalized reminders and email/push/WhatsApp delivery with opt-in and delivery status.
- Full conversation persistence and follow-up context.
- Semantic/vector search and more advanced ranking.
- Admin-configurable skill routing and tools.
