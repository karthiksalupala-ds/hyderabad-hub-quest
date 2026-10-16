# iHub — Information Hub

Build a polished, production-ready student opportunities web app called "iHub — Information Hub".

CORE IDEA:
A student-focused dashboard that helps B.Tech students discover and track:
1) Hyderabad offline/in-person hackathons
2) Internship opportunities in India, with priority for Hyderabad and remote roles

TARGET USER:
A B.Tech Data Science student interested in AI/ML, Data Science, Python, analytics, software/web development, AI agents, MCP, and hackathons.

IMPORTANT PRODUCT BEHAVIOR:
- This is a frontend-first MVP. Do NOT invent live events or claim live API data.
- Seed the app with clearly labeled demo/sample opportunity data, using realistic but clearly marked sample records.
- Build the data model and UI so real APIs/connectors can be integrated later.
- Every opportunity card should show source, event/company, role/event type, location/remote status, date, registration/application deadline, fee, prize/stipend, eligibility, tags, and a clear CTA link.
- Add "Verified" and "Demo Data" labels appropriately.
- Show exact dates and a "days left" countdown only for sample dates.
- Allow saving/bookmarking opportunities.

PAGES:
1. Dashboard/Home
   - Header: logo "iHub", search, saved count, profile menu
   - Hero: "Find your next hackathon or internship"
   - Two large category cards: Hackathons and Internships
   - KPI cards: Open Opportunities, Deadlines This Week, Hyderabad Offline, Remote Internships
   - "Urgent deadlines" section
   - "For You" recommendations based on interest tags
   - Recent opportunities
2. Hackathons page
   - List/grid toggle
   - Filters: Hyderabad only, Offline/In-person, student-friendly, AI/ML, Data Science, Web Development, Agentic AI, date range, fee/free, prize
   - Search
   - Sort: deadline, date, newest
3. Internships page
   - Filters: Hyderabad, Remote, India, AI/ML, Data Science, Python, Analytics, Software/Web, AI Agents, paid/unpaid
   - Search and sort
4. Opportunity detail page
   - Full details, eligibility, deadlines, fee/prize/stipend
   - Tags
   - Source/provider
   - CTA button to register/apply
   - Save button
5. Saved page
   - Bookmarked opportunities
6. Settings/Profile
   - Interest tags
   - Preferred locations
   - Notification preference UI (visual only for MVP)

DESIGN:
- Modern dark/light responsive SaaS dashboard aesthetic, clean and professional.
- Use Tailwind + shadcn/ui.
- Accent color: electric blue/purple gradient used sparingly.
- Strong typography, rounded cards, subtle shadows, excellent mobile layout.
- Add small icons with Lucide.
- Avoid excessive gradients and visual clutter.
- Make it feel like a real student career product, not a generic template.

DATA:
Create TypeScript types for Hackathon and Internship.
Include around 8 hackathon samples and 8 internship samples, clearly labeled as "Demo Data".
Use Hyderabad locations such as IIIT Hyderabad, Madhapur, Hitech City, Gachibowli, etc. for sample UI only and include a "Demo Data" badge so they are not represented as verified live events.
Include examples relevant to AI, Data Science, web development, and agentic AI.

EXTRA:
- Responsive navigation/sidebar.
- Empty states.
- Toasts for save/unsave.
- Search/filter interactions should work client-side.
- Bookmark state can use localStorage for this MVP.
- Add a small banner saying "Live integrations coming soon — current opportunities are demo data."
- Build clean reusable components and good accessibility.
- Add polished loading/empty states.

Please build the complete app now, with working navigation, filters, search, sorting, save/bookmark state, and responsive UI.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Real-data ingestion setup

The repository includes adapters and an ingestion API, but it does not discover live opportunities until permitted sources and deployment credentials are configured.

1. Configure the app's server-side environment on the deployment host: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and a long random `INGEST_SECRET`. Keep service-role keys and ingestion secrets server-side; never put them in `VITE_*` variables.
2. In GitHub repository **Settings → Secrets and variables → Actions**, add the repository variable `IHUB_BASE_URL` (the deployed app's base URL, without a trailing slash) and secret `INGEST_SECRET`. The secret value must match the deployed app's `INGEST_SECRET`.
3. Configure permitted source feeds/connectors in the deployment environment (`INGEST_FEEDS`, `COLLEGE_FEEDS`, `CAREER_FEEDS`, `REST_SOURCES`, `WEBMCP_TOOLS`, or `APIFY_API_KEY` and the relevant source registry fields). Enable only sources you intend to run. Some platforms require partner/approved API access; the adapter router intentionally does not scrape sources that do not permit it.
4. The **Scheduled Opportunity Ingestion** GitHub Actions workflow runs hourly and the pipeline processes only enabled, due sources. Use **Actions → Scheduled Opportunity Ingestion → Run workflow** for an on-demand run; optionally set `source_id` and `force`. Even forced runs skip disabled sources.
5. The Settings status button refreshes the current database view; it does not start a source crawl. After a manual or scheduled ingestion finishes, refresh the status view.

If `IHUB_BASE_URL` or the GitHub `INGEST_SECRET` is missing, the scheduled workflow reports that configuration is missing and skips the HTTP request. Configured sources still need to be enabled in `source_registry`; adding credentials does not silently re-enable a source someone disabled.

## Ask iHub AI assistant

The `/assistant` page provides five server-side skills: opportunity discovery, stored-record verification, profile matching, recent tracked changes, and upcoming-deadline lookup. The assistant reads only active listings whose `verification_status` is `verified`; it does not treat built-in demo cards as real data.

To enable AI-generated answers, configure `OPENAI_API_KEY` on the app's **server environment** (not as a `VITE_*` variable). `OPENAI_BASE_URL` and `OPENAI_MODEL` are optional. The same-origin API uses `store: false`, limits prompt/output size, and applies a best-effort per-process throttle; also configure rate limits at your hosting edge for a public deployment. The service returns a clear configuration error when the key is absent.

The assistant sends only the user's current question, selected interest/location preferences, and the matching verified listing fields to the model. Conversation history is kept in the browser while the page is open and is not saved to the user's profile. Source and apply links remain visible beside returned records. Missing source fields are shown as “Not stated”; the verification skill checks stored iHub records only and does not crawl arbitrary pasted URLs.

The upcoming-deadline skill lists verified records with stated deadlines in the next seven days. It does **not** send push/email notifications or schedule reminders.
