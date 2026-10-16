# Hyderabad Hub Quest

Build a polished, production-ready student opportunities web app called "Hyderabad Opportunity Hub".

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
   - Header: logo "Opportunity Hub", search, saved count, profile menu
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

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ece9a51e-aadb-4650-b9b8-843403edd0d6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
