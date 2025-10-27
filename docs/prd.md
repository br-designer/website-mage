# Website Mage Product Requirements Document (PRD)

<!-- Powered by BMAD™ Core -->

**Version:** 1.0  
**Date:** 2025-10-26  
**Author:** Kyle Baker  
**Project Type:** SaaS Web Application

---

## Goals and Background Context

### Goals

- Help agencies upsell post-launch maintenance by packaging monitoring and improvement metrics
- Provide real-world visibility into uptime, Core Web Vitals, and Lighthouse scores
- Enable recurring revenue through subscription tiers
- Stay lightweight and cost-efficient—built entirely on serverless and managed infrastructure
- Achieve 25% trial-to-paid conversion rate within 6 months of launch
- Onboard 1,000+ monitored sites within 6 months
- Demonstrate average TTFB improvement ≥ 10% across customer portfolio

### Background Context

Website Mage is a SaaS platform that allows agencies, freelancers, and single-site owners to continuously monitor, analyze, and improve their websites after launch. The platform addresses a critical gap in the web development lifecycle: what happens after a site goes live. Most agencies struggle to provide ongoing value post-launch, missing opportunities for recurring revenue and deeper client relationships.

The platform provides uptime monitoring, performance insights (PageSpeed / Lighthouse), and privacy-safe Real User Monitoring (RUM) with alerting and monthly reports—all under one dashboard. Built on a serverless-first architecture (Nuxt 4, Supabase, Cloudflare Workers), it maintains low operational costs while delivering enterprise-grade monitoring capabilities.

### Change Log

| Date       | Version | Description                                               | Author     |
| ---------- | ------- | --------------------------------------------------------- | ---------- |
| 2025-10-26 | 1.0     | Initial PRD creation from comprehensive planning document | Kyle Baker |

---

## Requirements

### Functional Requirements

**FR1:** The system shall monitor website uptime via HTTP GET requests with configurable frequency (10-min for Base, 5-min for Pro/Agency tiers)

**FR2:** The system shall perform multi-region checks (US/EU/APAC) with majority-voting logic to reduce false positives

**FR3:** The system shall support optional keyword validation to verify page content integrity

**FR4:** The system shall retry failed checks 3 times before opening an incident

**FR5:** The system shall send email alerts on incident open and recovery, throttled to maximum 3 emails per incident

**FR6:** The system shall perform PageSpeed Insights / Lighthouse scans on configurable schedules (monthly for Base, weekly for Pro/Agency)

**FR7:** The system shall allow manual PSI scans with tier-based rate limits and caching (Base: 1/10min, Pro: 1/5min, Agency: 1/3min)

**FR8:** The system shall store performance scores including LCP, CLS, INP/FID, FCP, and Lighthouse scores with historical trending

**FR9:** The system shall provide a privacy-safe RUM JavaScript snippet for collecting real user metrics

**FR10:** The system shall sample RUM data by tier (Base: 25%, Pro: 50%, Agency: 100%)

**FR11:** The system shall enforce monthly RUM event caps (Base: 1k/site, Pro: 10k/site, Agency: 50k pool)

**FR12:** The system shall honor Do Not Track (DNT) signals and collect no PII

**FR13:** The system shall detect and filter bot traffic from RUM metrics

**FR14:** The system shall send alerts via email (AWS SES) with tier-based monthly caps (Base: 100, Pro: 500, Agency: 5000)

**FR15:** The system shall support SMS alerts via Twilio as an opt-in add-on ($0.016/SMS)

**FR16:** The system shall support configurable quiet hours per recipient with timezone awareness

**FR17:** The system shall provide an agency dashboard showing sites list, uptime %, PSI trends, RUM charts, and usage meters

**FR18:** The system shall provide read-only client dashboards for Agency tier customers with per-site access control

**FR19:** The system shall generate monthly PDF reports for Agency tier including uptime, PSI deltas, CWV trends, and recommendations

**FR20:** The system shall export data to CSV format for uptime incidents and PSI history

**FR21:** The system shall integrate with Stripe for subscription management and metered billing

**FR22:** The system shall offer 1-month free trial requiring credit card with conversion to Base plan

**FR23:** The system shall support three subscription tiers: Base ($1/site/mo), Pro ($5/site/mo), Agency ($25/25-site bundle)

**FR24:** The system shall bill email overages at $0.01 per email and SMS at $0.016 per message

**FR25:** The system shall implement dunning with Stripe Smart Retries over 7 days with reminder emails

**FR26:** The system shall pause monitoring services when accounts enter "unpaid" status

**FR27:** The system shall support OAuth login via Google, Microsoft, and GitHub

**FR28:** The system shall implement role-based access control with Admin, Staff, and Client roles

**FR29:** The system shall allow Agency tier customers to customize branding (logo/colors) and use custom domains for client portals

**FR30:** The system shall maintain an audit log of all high-impact actions (site CRUD, billing changes, config updates) with 12-month retention

**FR31:** The system shall display SSL certificate expiry and DNS resolution status for Pro/Agency tiers

**FR32:** The system shall compute nightly aggregations of RUM data (p50/p75/p95) for trending

**FR33:** The system shall soft-delete sites with 30-day retention window before permanent purge

### Non-Functional Requirements

**NFR1:** Dashboard pages shall load in <2 seconds (P95) for views containing up to 50 sites

**NFR2:** API latency shall be <300ms (P95) for Worker-to-Supabase round trips

**NFR3:** PSI queue processing shall complete within 5 minutes from trigger to stored result

**NFR4:** RUM ingestion shall handle ≥1,000 requests/second with KV buffering

**NFR5:** Alert delivery shall average <30 seconds from incident detection to SES/Twilio dispatch

**NFR6:** The system shall target 99.9% uptime (best-effort, no formal SLA at launch)

**NFR7:** All data shall be encrypted in transit (HTTPS/TLS) and at rest

**NFR8:** The system shall enforce Row-Level Security (RLS) in Supabase for multi-tenant data isolation

**NFR9:** The system shall implement Content Security Policy (CSP) and HSTS headers on all domains

**NFR10:** The system shall store no PII in RUM data; IP addresses shall be discarded after country derivation

**NFR11:** The system shall support US-only data residency at MVP launch

**NFR12:** Database backups shall occur daily with 7-30 day retention and monthly restore testing

**NFR13:** Error logs shall be retained for 90 days (Sentry frontend) and 30 days (Workers/Supabase)

**NFR14:** The system shall maintain infrastructure costs ≤$200/month at <500 customers

**NFR15:** All secrets shall be stored in environment variables or secret management systems, never in code

**NFR16:** The system shall support horizontal scaling via serverless architecture (Cloudflare Workers, Supabase)

**NFR17:** The system shall implement rate limiting per tenant (PSI manual: Base 1/min, Pro 1/min, Agency 2/min)

**NFR18:** The system shall provide observability via Sentry error tracking and Cloudflare Analytics

**NFR19:** All deployments shall pass CI/CD checks including linting, unit tests (≥90% pass), and E2E tests on staging

**NFR20:** The system shall implement idempotent webhook handlers for Stripe events with retry logic

---

## User Interface Design Goals

### Overall UX Vision

Website Mage delivers a clean, modern, data-focused dashboard experience prioritizing clarity and actionable insights. The interface follows a progressive disclosure pattern—showing critical status information at a glance while allowing drill-downs into detailed metrics. The design emphasizes speed, minimal cognitive load, and mobile responsiveness for on-the-go monitoring.

### Key Interaction Paradigms

- **Status-first presentation:** Traffic light indicators (green/yellow/red) for instant health assessment
- **Inline actions:** Quick access to manual scans, alerts configuration, and exports without page navigation
- **Real-time updates:** Live status badges and automatic chart refreshes (using SSE or polling)
- **Guided workflows:** Onboarding flow for adding first site with snippet installation validation
- **Contextual help:** Inline tooltips explaining metrics (LCP, CLS, INP) for non-technical users

### Core Screens and Views

1. **Login / OAuth Screen** - Social login options with email fallback
2. **Onboarding Flow** - Site addition wizard with snippet copy/paste and verification
3. **Agency Dashboard** - Multi-site overview with sortable list, health indicators, and usage meters
4. **Site Detail Page** - Comprehensive view of single site with tabs for Uptime, PSI, RUM, Alerts, Settings
5. **Uptime Detail View** - 30-day timeline, incident history, regional check results
6. **PageSpeed Detail View** - Score trends chart, Core Web Vitals breakdown, opportunities list, screenshot comparison
7. **RUM Detail View** - Real user metrics with device/region filters, p75 charts, bot traffic panel
8. **Alerts Management** - Contact configuration, quiet hours, throttling status, usage tracking
9. **Reports Page** - Monthly report archive, CSV export options
10. **Settings Page** - Account info, team members, billing portal iframe, audit log viewer
11. **Client Dashboard** (Agency tier) - Read-only single-site or multi-site view with white-label branding
12. **Billing Portal** - Stripe-hosted billing management

### Accessibility

**Target:** WCAG AA compliance at minimum

- Keyboard navigation for all interactive elements
- Screen reader support with ARIA labels
- Color contrast ratios ≥4.5:1 for text
- Focus indicators on all interactive elements
- Alternative text for charts (data table fallback)

### Branding

The Website Mage brand emphasizes reliability, clarity, and magic/wizardry themes. The color palette uses deep purple/blue tones with green/yellow/red for status indicators. Agency tier customers can override branding with custom logos and colors for client-facing views.

**Design System:** TailwindCSS with custom color tokens, consistent spacing scale (4/8/16/24/32px), and standardized component library (buttons, cards, badges, charts).

### Target Platforms

**Primary:** Web Responsive (mobile-first design, works seamlessly on phones, tablets, desktops)

**Browser Support:** Last 2 versions of Chrome, Firefox, Safari, Edge

**Mobile Optimization:** Touch-friendly tap targets (≥44px), simplified charts for small screens, hamburger navigation on mobile

---

## Technical Assumptions

### Repository Structure

**Monorepo** using PNPM workspaces with Turborepo for build orchestration

**Rationale:** Simplifies code sharing between Nuxt frontend and Cloudflare Workers, enables atomic commits across frontend/backend changes, and reduces dependency duplication.

### Service Architecture

**Serverless-first hybrid architecture** consisting of:

- **Frontend:** Nuxt 4 SSR application (hosted on Netlify)
- **API Layer:** Cloudflare Workers for routing, rate-limiting, and cron jobs
- **Backend:** Supabase (Postgres with RLS, Auth, Storage)
- **CDN:** Cloudflare R2 for RUM JavaScript and static assets

**Rationale:** Serverless minimizes operational overhead and scales automatically. The architecture supports global edge deployment for low latency while maintaining cost efficiency through pay-per-use pricing.

### Testing Requirements

**Full Testing Pyramid:**

- **Unit Tests:** Vitest for SDK functions, RUM parser logic, PSI fetch utilities (≥90% coverage required)
- **Integration Tests:** Playwright for critical flows (auth, site creation, billing)
- **E2E Tests:** Playwright on staging environment before production deploys
- **Load Tests:** k6 for RUM ingest endpoint and uptime Worker batch processing
- **Manual Testing:** QA checklist for billing flows and alert delivery

**Rationale:** Comprehensive testing prevents regressions in critical payment and monitoring flows. Automated E2E on staging catches integration issues before customer impact.

### Additional Technical Assumptions

- **Primary Languages:** TypeScript 5.3+ for all code (frontend, Workers, shared utilities)
- **Package Manager:** PNPM for disk efficiency and strict dependency resolution
- **Build Tool:** Turborepo for monorepo task orchestration with caching
- **Infrastructure as Code:** Cloudflare Wrangler for Workers, Supabase CLI for database migrations
- **CI/CD Platform:** GitHub Actions for linting/testing, Netlify CI for frontend, Cloudflare deploy hooks for Workers
- **Linting/Formatting:** ESLint + Prettier with Conventional Commits enforcement via commitlint
- **Error Tracking:** Sentry for frontend (Nuxt), Workers, and API errors with PII scrubbing
- **Monitoring:** Cloudflare Analytics for edge metrics, Supabase built-in metrics for DB performance
- **Secrets Management:** Netlify environment variables (frontend), Cloudflare Secrets via Wrangler (Workers)
- **Database Migrations:** Supabase Migration files with version tagging matching release tags
- **Deployment Strategy:** Staging-first (24h soak), then production with rollback via Netlify/Cloudflare CLI
- **Backup Strategy:** Supabase automated daily snapshots (7-30 day retention), S3 export for PSI screenshots
- **Security Scanning:** Monthly `npm audit --production` in CI, quarterly dependency updates

---

## Epic List

**Epic 1: Foundation & Authentication**  
_Goal:_ Establish project infrastructure, repository setup, CI/CD pipeline, authentication system, and database foundation to enable all subsequent development.

**Epic 2: Uptime Monitoring**  
_Goal:_ Implement multi-region HTTP uptime checks with incident detection, alert throttling, and dashboard visualization to deliver core monitoring value.

**Epic 3: PageSpeed / Lighthouse Analysis**  
_Goal:_ Integrate Google PageSpeed Insights API with scheduled and manual scans, historical trending, and opportunities display to provide performance insights.

**Epic 4: Real User Monitoring (RUM)**  
_Goal:_ Deploy privacy-safe RUM collection via CDN-hosted JavaScript, beacon ingestion with sampling/caps, nightly aggregation, and dashboard charts.

**Epic 5: Alerts & Notifications**  
_Goal:_ Build email (SES) and SMS (Twilio) alert delivery with quiet hours, usage tracking, overage billing integration, and throttling enforcement.

**Epic 6: Billing & Subscription Management**  
_Goal:_ Integrate Stripe for subscription tiers, metered usage billing, trial management, dunning flow, and service pause/resume logic.

**Epic 7: Agency Features & Reporting**  
_Goal:_ Enable white-label branding, client dashboards with per-site access control, monthly PDF report generation, and CSV exports for Agency tier customers.

---

## Epic 1: Foundation & Authentication

**Goal:** Establish the technical foundation including monorepo structure, core services setup (Supabase, Netlify, Cloudflare Workers), CI/CD pipeline, OAuth authentication, and database schema. Deliver a working login flow and simple health check dashboard to validate the architecture end-to-end.

### Story 1.1: Monorepo Setup & Project Scaffolding

**As a** developer,  
**I want** a properly configured monorepo with all core dependencies and build tools,  
**so that** I can develop frontend and backend code with shared utilities efficiently.

**Acceptance Criteria:**

1. Repository initialized with PNPM workspaces and Turborepo configuration
2. Workspace structure created with `packages/web` (Nuxt 4), `packages/workers` (Cloudflare Workers), `packages/shared` (shared types/utils)
3. TypeScript 5.3+ configured with strict mode and path aliases
4. ESLint, Prettier, and commitlint configured with pre-commit hooks
5. Root `package.json` includes workspace scripts: `dev`, `build`, `test`, `lint`
6. README documents setup instructions and workspace structure
7. `.gitignore` properly excludes `node_modules`, `.nuxt`, `dist`, `.wrangler`, and environment files

### Story 1.2: Supabase Project Setup & Core Schema

**As a** developer,  
**I want** a Supabase project with core database schema and RLS policies,  
**so that** I can store multi-tenant data securely with authentication ready.

**Acceptance Criteria:**

1. Supabase project created for dev/staging/production environments
2. Database migration created for core tables: `agencies`, `agency_members`, `sites`, `users` (Supabase Auth native)
3. Enums created: `agency_tier` (base/pro/agency), `member_role` (admin/staff/client)
4. RLS policies enabled on all tables with `is_member_of()` helper function
5. Foreign key constraints and indexes created per schema design
6. Seed data script populates dev/staging with 1 test agency, 1 admin user, 3 demo sites
7. Supabase URL and anon key configured in workspace environment variables

### Story 1.3: Nuxt 4 Application Foundation

**As a** developer,  
**I want** a Nuxt 4 SSR application with routing, plugins, and Supabase integration,  
**so that** I can build authenticated dashboard pages.

**Acceptance Criteria:**

1. Nuxt 4 initialized in `packages/web` with TypeScript and SSR enabled
2. TailwindCSS configured with custom color tokens (purple/blue primary, green/yellow/red status)
3. Pinia store configured for state management
4. `@supabase/nuxt` plugin integrated with auth helpers
5. `@sentry/nuxt` plugin configured with DSN from environment
6. Layout created with header, nav placeholder, and main content area
7. Basic pages created: `/login`, `/dashboard`, `/sites`, `/settings`
8. Middleware configured to redirect unauthenticated users to `/login`
9. Application runs locally on `localhost:3000` and displays placeholder "Website Mage Dashboard"

### Story 1.4: OAuth Authentication Flow

**As a** user,  
**I want** to log in using Google, Microsoft, or GitHub,  
**so that** I can access my dashboard securely without managing passwords.

**Acceptance Criteria:**

1. Login page displays OAuth buttons for Google, Microsoft, GitHub
2. Supabase Auth configured with OAuth providers and redirect URLs
3. Successful OAuth flow creates/retrieves user in Supabase Auth
4. New user automatically creates default agency with "base" tier and "admin" role in `agency_members`
5. Session token stored in secure HTTP-only cookie
6. Successful login redirects to `/dashboard`
7. Logout button clears session and redirects to `/login`
8. Middleware enforces authentication on protected routes
9. User's name/email/avatar displayed in header after login

### Story 1.5: Cloudflare Workers API Gateway

**As a** developer,  
**I want** a Cloudflare Worker serving as the API gateway with rate limiting and Supabase connection,  
**so that** I can proxy requests securely and enforce per-tenant limits.

**Acceptance Criteria:**

1. Worker created in `packages/workers/api` with TypeScript
2. Worker handles GET `/health` endpoint returning `{status: "ok", timestamp: ISO}`
3. Worker configured with Supabase service key in Cloudflare Secrets
4. Worker bindings configured: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `RATE_LIMIT_KV` namespace
5. Rate limiting middleware implemented using KV with per-agency counter (60 req/min default)
6. CORS headers configured to allow `app.websitemage.com` origin
7. Worker deployed to `api.websitemage.com` route
8. Nuxt app successfully calls `/health` endpoint and displays result on dashboard
9. Rate limiting returns 429 with `Retry-After` header when exceeded

### Story 1.6: CI/CD Pipeline Setup

**As a** developer,  
**I want** automated CI/CD pipelines for testing and deployment,  
**so that** code changes are validated and deployed consistently.

**Acceptance Criteria:**

1. GitHub Actions workflow created: `.github/workflows/ci.yml`
2. CI runs on all PRs: `pnpm lint`, `pnpm test`, `pnpm build`
3. CI requires ≥90% test pass rate to succeed
4. Netlify connected to repository with auto-deploy on `main` branch to staging
5. Netlify preview deploys created for all PRs
6. Cloudflare Workers deploy configured via GitHub Action on `main` merge
7. Database migrations automatically applied to staging environment
8. Deployment status posted to Slack `#dev-ops` channel
9. Rollback procedure documented in `docs/ops/rollback.md`

### Story 1.7: Initial Dashboard with Health Status

**As a** logged-in user,  
**I want** to see a simple dashboard displaying my agency name and system health,  
**so that** I can confirm the application is working end-to-end.

**Acceptance Criteria:**

1. Dashboard page displays "Welcome, [Agency Name]"
2. Dashboard fetches and displays API health check status with timestamp
3. Dashboard shows placeholder cards for "Sites (0)", "Uptime (--)", "Alerts (0)"
4. Dashboard shows user's tier badge (Base/Pro/Agency)
5. Navigation sidebar includes links to: Dashboard, Sites, Reports, Settings
6. Settings page displays user info (name, email, role) from Supabase Auth
7. Settings page includes "Logout" button
8. All pages use consistent layout and TailwindCSS styling
9. Mobile responsive design confirmed on viewport widths 375px, 768px, 1440px

---

## Epic 2: Uptime Monitoring

**Goal:** Build the core uptime monitoring system with multi-region HTTP checks, incident tracking, alert delivery, and dashboard visualization. Enable users to add sites, configure check frequency and keyword validation, and receive notifications when sites go down or recover.

### Story 2.1: Site Management CRUD

**As a** agency admin,  
**I want** to add, edit, and delete monitored sites,  
**so that** I can configure which domains to monitor.

**Acceptance Criteria:**

1. Sites list page displays all sites for user's agency with columns: Domain, Status, Last Check, Actions
2. "Add Site" button opens modal/form with fields: Domain (required, URL validation), Expected Keyword (optional, text), Check Frequency (disabled, shows tier default)
3. Form validates domain format (starts with http:// or https://)
4. Successful site creation inserts row into `sites` table with `agency_id` from current user
5. Site appears in list immediately after creation with "Pending First Check" status
6. Edit action opens same form pre-filled with site data
7. Delete action shows confirmation dialog with warning about data retention
8. Delete sets `deleted_at` timestamp (soft delete), site disappears from list
9. Empty state message displayed when no sites exist: "Add your first site to start monitoring"

### Story 2.2: Uptime Worker - HTTP Check Logic

**As a** system worker,  
**I want** to execute HTTP GET requests to monitored sites with timeout and retry logic,  
**so that** I can detect downtime accurately.

**Acceptance Criteria:**

1. Uptime Worker created in `packages/workers/uptime` with scheduled trigger (every 5 minutes)
2. Worker queries Supabase for all active sites (where `deleted_at IS NULL`)
3. For each site, Worker performs HTTP GET with 10-second timeout
4. Worker follows up to 3 redirects (3XX responses)
5. Worker records result in `uptime_checks` table: `site_id`, `checked_at`, `region`, `http_status`, `ttfb_ms`, `ok`, `err`
6. Success criteria: `http_status` 200-299 AND (if `expected_keyword` set) keyword found in response body
7. On failure, Worker retries immediately up to 3 times before marking check as failed
8. Worker logs execution summary to Sentry: sites checked, successes, failures, duration
9. Worker completes batch in <60 seconds for 100 sites

### Story 2.3: Multi-Region Check & Majority Voting

**As a** system worker,  
**I want** to perform checks from multiple regions and use majority voting,  
**so that** I reduce false positives from regional network issues.

**Acceptance Criteria:**

1. Worker configured to execute checks from 3 regions: `us-east`, `eu-west`, `ap-sg` (using Cloudflare Workers regional routing or separate Worker instances)
2. Each region creates separate `uptime_checks` record with `region` field populated
3. After all regions complete, Worker calculates majority result: ≥2 regions must fail to mark site as down
4. Majority voting logic prevents opening incident if only 1 region fails
5. Edge case: if only 2 regions respond (1 timeout), Worker treats as "inconclusive" and does not open incident
6. Regional results displayed in site detail view showing per-region status
7. Configuration allows future override: "require all regions" or "any region" (default: majority)

### Story 2.4: Incident Detection & State Management

**As a** system worker,  
**I want** to track incident open/close state based on consecutive check failures,  
**so that** I can determine when to send alerts.

**Acceptance Criteria:**

1. `uptime_incidents` table used to track open incidents per site
2. After 3 consecutive failed checks (majority voting across regions), Worker opens new incident: inserts row with `site_id`, `opened_at`, `reason` (e.g., "HTTP 500", "Timeout", "Keyword mismatch")
3. Worker ensures only 1 open incident exists per site at a time (checks `closed_at IS NULL` before opening)
4. On first successful check after incident, Worker closes incident: sets `closed_at` timestamp
5. Incident reason field captures last error message or HTTP status code
6. Worker increments `alert_sent_count` on incident row when alert dispatched (see Epic 5)
7. Dashboard displays incident history with open/closed status and duration
8. Incident timeline shows all associated `uptime_checks` during incident window

### Story 2.5: Uptime Dashboard Visualization

**As a** user,  
**I want** to see uptime percentage and incident history for my sites,  
**so that** I can quickly assess site health.

**Acceptance Criteria:**

1. Dashboard "Sites" page displays uptime % for last 30 days per site (calculated from `uptime_checks` table)
2. Uptime % formula: `(successful checks / total checks) * 100`, displayed as "99.8%"
3. Status badge shown per site: Green "Up" (no open incident), Red "Down" (open incident), Gray "Unknown" (no checks yet)
4. Site detail page shows uptime chart: line graph with hourly resolution for last 7 days, daily resolution for 8-30 days
5. Incident list table displays: Opened At, Closed At (or "Ongoing"), Duration, Reason
6. Click incident row expands to show all check attempts during incident window with per-region results
7. Empty state message: "No incidents recorded" when site has 100% uptime
8. Loading state shown while fetching data (skeleton UI or spinner)
9. Auto-refresh every 60 seconds for dashboard and site detail pages

### Story 2.6: SSL & DNS Status (Pro/Agency Tiers)

**As a** Pro or Agency tier user,  
**I want** to see SSL certificate expiry dates and DNS resolution status,  
**so that** I can proactively address certificate or DNS issues.

**Acceptance Criteria:**

1. Uptime Worker extracts SSL certificate expiry date during HTTPS checks
2. Worker stores SSL expiry timestamp in `sites.settings_json` field (e.g., `{"ssl_expiry": "2025-12-31T23:59:59Z"}`)
3. Worker performs DNS resolution check before HTTP check, records result in `uptime_checks.metadata` JSON
4. Site detail page displays SSL expiry badge: Green ">30 days", Yellow "7-30 days", Red "<7 days"
5. Site detail page displays DNS status badge: Green "Resolved", Red "Failed"
6. Feature only visible/active for Pro and Agency tier users (tier check in frontend and Worker)
7. Base tier users see disabled SSL/DNS section with upgrade prompt
8. Worker skips SSL/DNS checks for Base tier sites to optimize performance
9. Alert triggered (Epic 5) when SSL expiry <7 days (configurable)

### Story 2.7: Check Frequency Configuration by Tier

**As a** system,  
**I want** to enforce check frequency based on subscription tier,  
**so that** Pro/Agency users get more frequent monitoring.

**Acceptance Criteria:**

1. Worker reads agency tier from `agencies.tier` field when processing sites
2. Check intervals enforced: Base 10 minutes, Pro 5 minutes, Agency 5 minutes
3. Worker calculates "next check due" timestamp per site and skips sites not yet due
4. Agency tier uses "pooled" logic: all sites under agency checked collectively without per-site rate limits
5. Site detail page displays "Check Frequency" badge showing current interval (e.g., "Every 5 minutes")
6. Upgrade prompt shown on Base tier sites: "Upgrade to Pro for 5-minute checks"
7. Tier changes reflected immediately (within next Worker execution cycle, ~5 min max)
8. Worker logs tier distribution in execution summary: "Checked 50 Base, 20 Pro, 10 Agency sites"

---

## Epic 3: PageSpeed / Lighthouse Analysis

**Goal:** Integrate Google PageSpeed Insights API to perform mobile and desktop Lighthouse audits, store historical scores and Core Web Vitals, enable manual scans with rate limiting, and visualize trends with opportunities list on the dashboard.

### Story 3.1: PSI API Integration & Scheduled Scans

**As a** system worker,  
**I want** to call Google PageSpeed Insights API on a schedule to scan monitored sites,  
**so that** users receive regular performance reports.

**Acceptance Criteria:**

1. PSI Worker created in `packages/workers/psi` with scheduled trigger (hourly)
2. Worker queries Supabase for sites eligible for scan based on tier: Base (monthly), Pro (weekly), Agency (weekly)
3. Worker calculates "next scan due" per site using `psi_results.scanned_at` timestamp and tier schedule
4. For each eligible site, Worker calls PSI API twice: once for mobile, once for desktop
5. PSI API request includes: `url`, `strategy=mobile|desktop`, `category=performance`, `key=[API_KEY]`
6. Worker parses response and extracts: `performance_score`, `lcp_ms`, `cls`, `inp_ms`, `fcp_ms`, `lighthouse_version`, `opportunities` JSON
7. Worker inserts results into `psi_results` table with `site_id`, `scanned_at`, `device`, and extracted metrics
8. Worker triggers materialized view refresh: `REFRESH MATERIALIZED VIEW CONCURRENTLY psi_latest`
9. Worker handles API errors gracefully: logs to Sentry, marks site for retry on next cycle, does not crash batch
10. Worker batch processes up to 50 sites per execution to stay within PSI API rate limits (25,000/day)

### Story 3.2: Manual PSI Scan with Rate Limiting

**As a** user,  
**I want** to trigger a manual PageSpeed scan for my site,  
**so that** I can immediately validate performance changes after deployment.

**Acceptance Criteria:**

1. Site detail page displays "Run Scan" button next to PSI scores section
2. Button shows countdown timer if scan recently run: "Next scan available in 8:32"
3. Clicking button sends POST request to `/api/psi/scan` with `site_id` and `device` (mobile/desktop, default: both)
4. API Worker checks rate limit using KV: Base 1 per 10 min, Pro 1 per 5 min, Agency 1 per 3 min
5. API Worker checks daily cap using `usage_counters` table: Base 10/day, Pro 25/day, Agency 50/day
6. If limits exceeded, Worker returns 429 with JSON: `{error: "Rate limit exceeded", retryAfter: 600}`
7. If allowed, Worker enqueues scan job (writes to `psi_queue` table or triggers immediate execution)
8. Worker returns 202 with JSON: `{status: "queued", estimatedCompletionSeconds: 30}`
9. Frontend polls `/api/psi/status/:job_id` every 5 seconds until completion
10. Completed scan results appear in dashboard with "New" badge for 5 minutes
11. Cache-hit logic: if identical scan exists within cache TTL (same as debounce interval), return cached result instead of calling PSI API

### Story 3.3: Historical PSI Trends & Retention

**As a** user,  
**I want** to view historical PageSpeed scores and Core Web Vitals trends,  
**so that** I can track performance improvements or regressions over time.

**Acceptance Criteria:**

1. Site detail page displays PSI trend chart: line graph with dual Y-axes (Performance Score 0-100, Metric ms)
2. Chart includes toggleable series: Performance Score, LCP, CLS (×1000 for visibility), INP, FCP
3. Chart X-axis shows time range: Last 7 days (hourly resolution), Last 30 days (daily), Last 90 days (weekly)
4. Time range selector above chart: "7D | 30D | 90D | All" (All shows tier retention: Base 30d, Pro 90d, Agency 180d)
5. Chart data fetched from `psi_results` table filtered by `site_id` and `scanned_at` range
6. Device filter toggle: "Mobile | Desktop | Both" (default: both overlaid)
7. Tooltip on hover shows exact values and scan timestamp
8. Empty state: "No scans yet. Run your first scan to see trends."
9. Data retention enforced by cleanup Worker (Epic 2): Base 30 days, Pro 90 days, Agency 180 days
10. Chart renders in <2 seconds for 90 days of data (daily rollup optimization if needed)

### Story 3.4: Lighthouse Opportunities Display

**As a** user,  
**I want** to see Lighthouse improvement opportunities with estimated savings,  
**so that** I know what optimizations to prioritize.

**Acceptance Criteria:**

1. Site detail page displays "Opportunities" section below PSI chart
2. Section shows top 5 opportunities from latest scan, sorted by estimated savings (ms or bytes)
3. Each opportunity displays: Title (e.g., "Eliminate render-blocking resources"), Description (1-2 sentences), Estimated Savings (e.g., "420 ms"), Audit Score (0-100)
4. Opportunities stored as JSON array in `psi_results.opportunities` field
5. Clicking opportunity expands accordion with detailed explanation and affected resource list
6. Link to Lighthouse documentation included per opportunity: "Learn more →"
7. Device-specific opportunities displayed when device filter active (mobile vs desktop)
8. Empty state: "No major opportunities detected. Great job!"
9. Opportunities data comes from PSI API response: `lighthouseResult.audits[opportunity_id]`

### Story 3.5: Screenshot Comparison (Optional Enhancement)

**As a** user,  
**I want** to see before/after screenshots from Lighthouse scans,  
**so that** I can visually confirm rendering issues or improvements.

**Acceptance Criteria:**

1. Worker extracts screenshot URL from PSI API response: `lighthouseResult.audits['final-screenshot'].details.data` (base64 or URL)
2. Worker uploads screenshot to Cloudflare R2 bucket: `psi-screenshots/{site_id}/{timestamp}_{device}.jpg`
3. Screenshot URL stored in `psi_results.screenshot_url` field
4. Site detail page displays screenshot thumbnail (200px width) next to PSI score
5. Clicking thumbnail opens modal with full-size image (1366px width) and metadata (scan date, device, score)
6. Screenshot comparison view shows current vs previous scan side-by-side with visual diff overlay (optional: use PixelMatch library)
7. Screenshots retained per tier retention policy (same as PSI data)
8. Feature gracefully degrades if screenshot extraction fails (displays "Screenshot unavailable" placeholder)

---

## Epic 4: Real User Monitoring (RUM)

**Goal:** Deploy privacy-safe, cookie-less RUM collection system via CDN-hosted JavaScript snippet. Implement beacon ingestion with tier-based sampling and monthly event caps, nightly aggregation for p75 metrics, bot detection/filtering, and dashboard visualization with device/region breakdowns.

### Story 4.1: RUM JavaScript Snippet & CDN Deployment

**As a** user,  
**I want** a lightweight JavaScript snippet to embed on my site,  
**so that** I can collect real user performance metrics.

**Acceptance Criteria:**

1. RUM script created in `packages/rum-js/src/rum.js` using vanilla JavaScript (no dependencies)
2. Script size <5KB minified and gzipped
3. Script uses Web Vitals API to capture: LCP, CLS, INP (with FID fallback), TTFB, FCP
4. Script captures: `nav_type` (navigation/reload/back_forward), `viewport_w`, `viewport_h`, simplified User-Agent Client Hints (UA-CH) for device type
5. Script honors Do Not Track: checks `navigator.doNotTrack === "1"` and aborts if true
6. Script sends beacon via POST to `https://cdn.websitemage.com/rum/ingest` with JSON payload: `{site_id, metrics, ua, viewport, timestamp}`
7. Script includes `data-site="SITE_ID"` attribute on script tag for site identification
8. Script built and bundled using esbuild with output: `dist/rum.js` and `dist/rum.min.js`
9. Script uploaded to Cloudflare R2 bucket `cdn-websitemage` with 1-year Cache-Control header
10. CDN domain `cdn.websitemage.com` configured to serve from R2 with Cloudflare CDN caching
11. Installation instructions page in dashboard shows copy-paste snippet: `<script src="https://cdn.websitemage.com/rum.js" data-site="abc123"></script>`

### Story 4.2: RUM Beacon Ingestion Worker

**As a** system worker,  
**I want** to receive and validate RUM beacons from user browsers,  
**so that** I can store real user performance data.

**Acceptance Criteria:**

1. RUM Worker created in `packages/workers/rum` with on-demand HTTP trigger (POST `/rum/ingest`)
2. Worker validates incoming JSON payload: required fields present, `site_id` exists in Supabase, numeric metrics within reasonable bounds
3. Worker derives `country` from `CF-IPCountry` header, discards IP address immediately (privacy)
4. Worker derives `device` ("mobile" or "desktop") from viewport width: <768px = mobile, else desktop
5. Worker checks sampling rate based on site's agency tier: Base 25%, Pro 50%, Agency 100% (random dice roll)
6. If sampled-in, Worker checks monthly event cap from `usage_counters` table (Base 1k/site, Pro 10k/site, Agency 50k pool)
7. If cap exceeded, Worker returns 429 with `Retry-After: 3600` header
8. If allowed, Worker inserts row into `rum_events` table: `site_id`, `agency_id`, `ts`, `device`, `nav_type`, `viewport_w`, `viewport_h`, `country`, `lcp_ms`, `cls`, `inp_ms`, `ttfb_ms`, `fcp_ms`, `ua`
9. Worker increments `usage_counters.used` for rum metric via trigger or direct update
10. Worker returns 204 No Content on success, 400 on validation error, 429 on cap exceeded
11. Worker handles burst traffic: uses KV for temporary buffering if DB write latency spikes

### Story 4.3: Bot Detection & Filtering

**As a** system worker,  
**I want** to detect and filter bot traffic from RUM metrics,  
**so that** real user data remains accurate.

**Acceptance Criteria:**

1. Worker maintains known bot User-Agent list (Googlebot, Bingbot, AhrefsBot, SemrushBot, etc.) in `packages/shared/bot-ua-patterns.ts`
2. Worker checks incoming `ua` field against bot patterns using regex or substring match
3. Worker detects headless browser signals: `HeadlessChrome`, `PhantomJS`, `Puppeteer`
4. Worker detects automation flags from UA-CH: `Sec-CH-UA-Mobile: ?1` with suspicious combinations
5. Detected bot traffic inserted into `rum_bot_events` table instead of `rum_events`
6. Bot events do NOT count toward monthly RUM caps
7. Dashboard displays bot traffic in separate "Bot Traffic" panel: total count, top bot UAs, traffic over time
8. Bot filtering toggle in site settings: "Include bots in charts" (default: off)
9. Worker logs bot detection rate to Sentry for monitoring (expected: 5-10% of total traffic)

### Story 4.4: Nightly RUM Aggregation & Rollups

**As a** system worker,  
**I want** to compute daily aggregates of RUM metrics for efficient querying,  
**so that** dashboard charts load quickly and historical data is preserved.

**Acceptance Criteria:**

1. Cleanup Worker (from Epic 2) extended with aggregation job running nightly at 03:00 UTC
2. Worker queries `rum_events` for previous day's data grouped by `site_id`, `device`, `country`
3. Worker calculates percentiles using PostgreSQL `percentile_cont()`: p50, p75, p95 for LCP; p75 for CLS, INP, TTFB, FCP
4. Worker inserts results into `rum_daily_agg` table: `site_id`, `day`, `device`, `country`, `samples`, `p50_lcp_ms`, `p75_lcp_ms`, `p95_lcp_ms`, `p75_cls`, `p75_inp_ms`, `p50_ttfb_ms`, `p50_fcp_ms`
5. Worker deletes raw `rum_events` older than retention policy (6-12 months) after aggregation complete
6. Worker preserves `rum_daily_agg` data longer than raw events (12-24 months) for historical trending
7. Worker logs aggregation summary: rows processed, aggregates created, old rows deleted, duration
8. Rollup job completes in <10 minutes for 1 million raw events

### Story 4.5: RUM Dashboard Visualization

**As a** user,  
**I want** to view real user Core Web Vitals metrics with device and region filters,  
**so that** I can understand actual user experience across different audiences.

**Acceptance Criteria:**

1. Site detail page displays "Real User Monitoring" section with 3 primary charts: LCP, CLS, INP
2. Each chart shows p75 metric over time (line graph) with time range selector: 7D | 30D | 90D
3. Chart data fetched from `rum_daily_agg` table for performance, falls back to `rum_events` for <24h data
4. Device filter toggle: "All | Mobile | Desktop" (default: All, shows both lines overlaid)
5. Region filter dropdown: "All | North America | Europe | Asia | Other" (maps to `country` field groupings)
6. Summary cards above charts display: Current p75 LCP (ms), Current p75 CLS (×1000), Current p75 INP (ms), Total Samples (last 30d)
7. Core Web Vitals thresholds color-coded: LCP <2.5s Green, 2.5-4s Yellow, >4s Red; CLS <0.1 Green, 0.1-0.25 Yellow, >0.25 Red; INP <200ms Green, 200-500ms Yellow, >500ms Red
8. Empty state: "No RUM data yet. Install the RUM snippet to start collecting metrics."
9. Usage meter displayed: "2,341 / 10,000 events this month (23%)" with progress bar
10. Charts render in <1 second for 90 days of aggregated data

### Story 4.6: RUM Event Cap Enforcement & Notifications

**As a** system,  
**I want** to enforce monthly RUM event caps per tier and notify users when approaching limits,  
**so that** costs stay predictable and users can upgrade if needed.

**Acceptance Criteria:**

1. Worker checks `usage_counters` table for `metric='rum'` and current month before accepting beacon
2. When usage reaches 80% of cap, system creates notification in dashboard: "RUM usage at 80% (8,000 / 10,000 events)"
3. When usage reaches 90%, notification updates to "RUM usage at 90%. Upgrade to Pro for higher limits."
4. When usage reaches 100%, Worker returns 429 to all beacons with `Retry-After: 86400` (next day)
5. Dashboard banner displayed when at 100%: "RUM event cap reached. Data collection paused until next month or upgrade."
6. For Agency tier, cap is pooled across all sites: total agency events counted, not per-site
7. Usage resets automatically on 1st of each month via scheduled Worker (Epic 6 integration)
8. Admin users can manually reset usage via "Reset Usage" button in settings (dev/testing only, logs audit event)
9. Email notification sent to agency admin when 100% cap reached (Epic 5 integration)

---

## Epic 5: Alerts & Notifications

**Goal:** Build comprehensive alert delivery system using AWS SES for email and Twilio for SMS. Implement quiet hours with timezone support, per-incident throttling, usage tracking for billing, and overage notifications. Ensure alerts respect monthly caps and integrate with billing for overage charges.

### Story 5.1: Email Alert Integration (AWS SES)

**As a** system,  
**I want** to send email alerts via AWS SES when incidents occur,  
**so that** users are notified promptly of site issues.

**Acceptance Criteria:**

1. SES configuration created in AWS account with verified domain: `alerts@websitemage.com`
2. SES SMTP credentials stored in Cloudflare Secrets for Workers access
3. Email template created for "Site Down" alert: includes site domain, timestamp, reason (HTTP status / timeout / keyword), link to incident details
4. Email template created for "Site Recovered" alert: includes site domain, downtime duration, timestamp, link to site dashboard
5. Alert Worker (or extended Uptime Worker) triggers email send when incident opened (`uptime_incidents.opened_at` set)
6. Alert Worker triggers recovery email when incident closed (`uptime_incidents.closed_at` set)
7. Email recipient list read from `sites.settings_json.alert_recipients` array (default: agency admin email)
8. Worker inserts row into `alerts_sent` table: `site_id`, `incident_id`, `channel='email'`, `recipient`, `sent_at`, `meta={ses_message_id}`
9. Worker handles SES errors gracefully: logs to Sentry, retries up to 3 times with exponential backoff, marks alert as failed
10. Email includes unsubscribe link (future: per-user alert preferences)

### Story 5.2: SMS Alert Integration (Twilio)

**As a** user,  
**I want** to receive SMS alerts for critical site outages,  
**so that** I'm notified even when away from email.

**Acceptance Criteria:**

1. Twilio account configured with phone number for sending SMS
2. Twilio API credentials stored in Cloudflare Secrets
3. SMS alert opt-in toggle added to site settings: "Enable SMS Alerts" (default: off)
4. SMS phone number field added to site settings with validation (E.164 format)
5. SMS template created for "Site Down": "[Website Mage] ALERT: {domain} is down. Check dashboard: {link}"
6. SMS template created for "Site Recovered": "[Website Mage] {domain} recovered after {duration}."
7. Alert Worker sends SMS via Twilio API when incident opened AND SMS enabled for site
8. Worker inserts row into `alerts_sent` table with `channel='sms'`, `meta={twilio_sid, status}`
9. SMS delivery confirmation polled via Twilio status callback webhook
10. SMS alerts count toward metered usage billing (Epic 6 integration): $0.016 per SMS
11. User sees SMS usage counter in dashboard: "2 SMS sent this month ($0.03)"
12. SMS limited to US/Canada phone numbers at MVP launch (international in Phase 2)

### Story 5.3: Alert Recipient Management

**As a** user,  
**I want** to configure multiple alert recipients with different contact methods,  
**so that** my team receives notifications on their preferred channels.

**Acceptance Criteria:**

1. Site settings page displays "Alert Recipients" section
2. Section shows list of recipients with columns: Name, Email, Phone, Quiet Hours, Actions
3. "Add Recipient" button opens form: Name (required), Email (optional, validated), Phone (optional, E.164 format), Quiet Hours Start/End (optional, 24h format), Timezone (dropdown, default: account timezone)
4. Recipients stored as JSON array in `sites.settings_json.alert_recipients`: `[{name, email, phone, quiet_hours: {start, end, timezone}}]`
5. At least one recipient required (validation on save)
6. Edit recipient opens same form pre-filled
7. Delete recipient shows confirmation dialog
8. Default recipient auto-created on site creation: agency admin with account email
9. Recipient limit enforced: Base 1, Pro 3, Agency 10 per site

### Story 5.4: Quiet Hours & Timezone Handling

**As a** user,  
**I want** to configure quiet hours when alerts are suppressed,  
**so that** I'm not disturbed during off-hours for non-critical issues.

**Acceptance Criteria:**

1. Recipient form includes "Quiet Hours" toggle (default: off)
2. When enabled, user sets: Start Time (HH:MM), End Time (HH:MM), Timezone (dropdown: all IANA timezones)
3. Alert Worker checks current time in recipient's timezone before sending alert
4. If current time falls within quiet hours window, Worker skips alert delivery for that recipient
5. Quiet hours logic: if `start=22:00, end=08:00`, suppress alerts from 10pm to 8am in recipient's timezone
6. Critical incidents bypass quiet hours (future: severity levels, MVP suppresses all)
7. Recovery alerts always delivered regardless of quiet hours
8. Dashboard shows recipient list with "Quiet Hours Active" badge if currently in quiet window
9. Quiet hours configuration optional per recipient (some recipients may have quiet hours, others 24/7)

### Story 5.5: Per-Incident Alert Throttling

**As a** system,  
**I want** to limit the number of alerts sent per incident to prevent spam,  
**so that** users aren't overwhelmed by repeated notifications.

**Acceptance Criteria:**

1. Alert Worker checks `uptime_incidents.alert_sent_count` before sending alert
2. Maximum 3 alerts sent per incident lifecycle: 1 initial "down", up to 2 reminders, 1 recovery
3. Reminder alerts sent if incident still open after: 1 hour (2nd alert), 6 hours (3rd alert)
4. Worker increments `alert_sent_count` after each alert sent
5. If count reaches 3 and incident still open, Worker suppresses further alerts until recovery
6. Recovery alert sent when incident closes, regardless of previous count (final alert)
7. Throttling state displayed in incident detail view: "3 alerts sent (throttled)"
8. Configuration option in site settings: "Alert Frequency" dropdown: "Immediate Only (1)" | "Immediate + 1 Reminder (2)" | "Immediate + 2 Reminders (3, default)"
9. Worker logs throttled alerts to Sentry for monitoring: "Incident [id] throttled after 3 alerts"

### Story 5.6: Alert Usage Tracking & Overage Billing

**As a** system,  
**I want** to track email and SMS usage per agency and bill overages,  
**so that** costs are covered and users stay within plan limits.

**Acceptance Criteria:**

1. `usage_counters` table tracks `metric='email'` and `metric='sms'` per agency per month
2. Worker increments `used` count on every alert sent (trigger or direct update)
3. Email caps enforced: Base 100/mo, Pro 500/mo, Agency 5000/mo
4. When email cap reached, Worker logs warning but continues sending (overages billed)
5. Dashboard displays usage meters: "Email: 523 / 500 (4.6% over)" with orange badge
6. Overage calculation: `max(0, used - cap) * $0.01` per email
7. SMS always metered (no included cap): every SMS counts toward billing at $0.016 each
8. Usage summary available in Settings → Billing: table with columns: Month, Metric, Used, Cap, Overage, Cost
9. Usage resets on 1st of each month via scheduled Worker
10. Stripe metered usage records created for overages (Epic 6 integration)

### Story 5.7: Alert Delivery Reliability & Retries

**As a** system,  
**I want** to retry failed alert deliveries and log failures,  
**so that** users reliably receive notifications even during service disruptions.

**Acceptance Criteria:**

1. Worker implements retry logic with exponential backoff: attempt 1 (immediate), attempt 2 (+30s), attempt 3 (+120s)
2. SES/Twilio errors categorized: Transient (429, 503) → retry, Permanent (400, 404) → log and abort
3. Failed alerts logged to `alerts_sent.meta.error` JSON field
4. After 3 failed attempts, Worker logs error to Sentry with full context (incident_id, recipient, error message)
5. Dashboard displays alert delivery status in incident timeline: "✓ Email sent to admin@example.com" or "✗ SMS failed (invalid number)"
6. Retry queue implemented using Cloudflare Durable Objects or separate `alert_queue` table
7. Alert delivery SLA: 95% delivered within 30 seconds, 99% within 5 minutes
8. Monitoring dashboard (internal) shows alert success rate, average delivery time, failure reasons
9. User notification shown if all delivery attempts fail: "Alert delivery failed. Check settings."

---

## Epic 6: Billing & Subscription Management

**Goal:** Integrate Stripe for subscription management with three tiers (Base, Pro, Agency), implement metered usage billing for email/SMS overages, handle trial-to-paid conversion, enforce dunning flow with service pause/resume, and synchronize subscription state with Worker behavior.

### Story 6.1: Stripe Product Catalog Setup

**As a** developer,  
**I want** Stripe products and prices configured for all subscription tiers,  
**so that** users can subscribe and billing is automated.

**Acceptance Criteria:**

1. Stripe account created with test and live mode environments
2. Three recurring products created in Stripe: "Base", "Pro", "Agency"
3. Prices configured: Base $1/site/month (per-unit pricing), Pro $5/site/month (per-unit), Agency $25/month (fixed, represents 25-site bundle)
4. Metered products created: "Email Overage" ($0.01 per email), "SMS Alert" ($0.016 per SMS)
5. Products tagged with metadata: `tier=base|pro|agency`, `sites_included=1|1|25`
6. Stripe Tax enabled for automatic tax calculation
7. Test mode configuration matches live mode structure
8. Stripe publishable key and webhook secret stored in environment variables (Netlify for frontend, Cloudflare Secrets for Workers)
9. Product/price IDs documented in `docs/billing/stripe-catalog.md`

### Story 6.2: Checkout Flow & Subscription Creation

**As a** new user,  
**I want** to select a subscription plan and complete checkout,  
**so that** I can start monitoring sites immediately.

**Acceptance Criteria:**

1. Billing page in dashboard displays three plan cards: Base, Pro, Agency with features listed
2. Each card shows: Price, Check Frequency, RUM Sampling, Email Cap, Key Features
3. "Upgrade" or "Select Plan" button on each card
4. Clicking button redirects to Stripe Checkout hosted page with pre-filled customer email
5. Stripe Checkout configured: mode=subscription, line_items with selected price_id and quantity (defaults to 1 site for Base/Pro, 1 bundle for Agency)
6. Success URL: `https://app.websitemage.com/billing/success?session_id={CHECKOUT_SESSION_ID}`
7. Cancel URL: `https://app.websitemage.com/billing`
8. On successful checkout, Stripe creates subscription and customer, sends webhook `checkout.session.completed`
9. Webhook Worker (Story 6.3) creates/updates `subscriptions` table row
10. User redirected to success page showing: "Subscription active! You can now add [X] sites."
11. Settings → Billing shows: Current Plan, Billing Cycle, Next Invoice Date, "Manage Billing" button (opens Stripe Customer Portal)

### Story 6.3: Stripe Webhook Handler

**As a** system,  
**I want** to process Stripe webhooks to keep subscription state synchronized,  
**so that** billing changes reflect immediately in the application.

**Acceptance Criteria:**

1. Webhook Worker created in `packages/workers/stripe-webhook` with POST `/webhooks/stripe` endpoint
2. Worker verifies webhook signature using Stripe webhook secret
3. Worker handles event types: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
4. On `checkout.session.completed`: Worker creates row in `subscriptions` table with agency_id (derived from session metadata), plan_id, status='active', current_period_end
5. On `customer.subscription.updated`: Worker updates `subscriptions` row with new status, plan_id, quantity, current_period_end
6. On `customer.subscription.deleted`: Worker updates status='canceled', logs audit event
7. On `invoice.payment_succeeded`: Worker updates subscription status='active' (resume services if paused)
8. On `invoice.payment_failed`: Worker updates status='past_due', triggers dunning email (Story 6.5)
9. Worker uses idempotency key (Stripe event ID) to prevent duplicate processing
10. Worker returns 200 for successfully processed events, 400 for invalid signature, 500 for processing errors (Stripe retries)
11. Worker logs all webhook events to `audit_log` table

### Story 6.4: Trial Management & Conversion

**As a** new user,  
**I want** a 1-month free trial to test the platform,  
**so that** I can evaluate value before committing to payment.

**Acceptance Criteria:**

1. Trial enabled on Stripe Checkout: `subscription_data.trial_period_days=30`
2. User sees "Start Free Trial" instead of "Subscribe" button during signup
3. Credit card required for trial (Stripe collects payment method, doesn't charge until trial ends)
4. Trial status displayed in dashboard: "Trial expires in 23 days"
5. Reminder emails sent: 5 days before trial end, 1 day before (sent via Alert Worker integrated with SES)
6. Email content: "Your trial ends on [date]. You'll be charged $[amount] for [plan] unless you cancel."
7. Trial expiration webhook: `customer.subscription.trial_will_end` triggers final reminder
8. On trial end, Stripe automatically converts to paid subscription (charges customer) and sends `invoice.payment_succeeded` webhook
9. If payment fails at trial end, Stripe sends `invoice.payment_failed`, subscription enters `past_due` status (dunning flow begins)
10. Trial limited to 1 site for testing (Agency trial includes 3 sites)
11. User can cancel anytime during trial via Stripe Customer Portal without charge

### Story 6.5: Dunning Flow & Service Pause

**As a** system,  
**I want** to handle failed payments with retry attempts and service degradation,  
**so that** we recover revenue while protecting costs.

**Acceptance Criteria:**

1. On first payment failure, Stripe status changes to `past_due`, webhook triggers dunning email 1: "Payment failed. We'll retry in 3 days."
2. Stripe Smart Retries configured: attempts on Day 1, Day 3, Day 5, Day 7
3. Dunning emails sent on Day 1, Day 3, Day 5 with escalating urgency: "Final attempt tomorrow. Update payment method."
4. Dashboard banner shown for `past_due` status: "Payment failed. Update payment method to avoid service interruption."
5. Services remain active during `past_due` (7-day grace period)
6. If all retries fail, subscription status changes to `unpaid`, webhook triggers service pause
7. On `unpaid` status, Worker updates agency flag: `service_paused=true`
8. Paused agencies: Uptime/PSI Workers skip checks, RUM Worker returns 503, dashboard shows read-only mode with upgrade prompt
9. User can still access dashboard (read-only), view historical data, and update billing via Stripe Portal
10. On successful payment, `invoice.payment_succeeded` webhook resumes services: `service_paused=false`, dashboard banner cleared
11. Audit log records: `billing.dunning.started`, `billing.service.paused`, `billing.service.resumed`

### Story 6.6: Plan Upgrades & Downgrades

**As a** user,  
**I want** to change my subscription plan and site quantity,  
**so that** my plan matches my current needs.

**Acceptance Criteria:**

1. Billing page shows "Change Plan" button when subscription active
2. Clicking button opens plan selector modal with current plan highlighted
3. User can select new plan (Base → Pro, Pro → Agency, etc.) or adjust quantity (add/remove sites)
4. For upgrades (Base→Pro, Pro→Agency), changes apply immediately with prorated charge
5. Stripe creates `subscription_schedule` or updates subscription with `proration_behavior=always_invoice`
6. For downgrades (Pro→Base, Agency→Pro), changes apply at next renewal (end of current period)
7. Dashboard shows pending change: "Your plan will change to [new plan] on [date]"
8. User can cancel pending downgrade before effective date
9. Quantity changes: Base/Pro allow adding sites one-by-one ($1 or $5/site), Agency adds in 25-site bundle increments ($25 per bundle)
10. Site quantity cannot decrease below current active site count (validation: "Remove [X] sites before downgrading")
11. Webhook `customer.subscription.updated` syncs changes to `subscriptions` table
12. Usage counters (`usage_counters.cap`) updated based on new plan tier

### Story 6.7: Metered Usage Reporting to Stripe

**As a** system,  
**I want** to report metered usage (email overages, SMS) to Stripe for billing,  
**so that** users are charged accurately for usage beyond plan limits.

**Acceptance Criteria:**

1. Monthly scheduled Worker runs on 1st of each month at 00:00 UTC
2. Worker queries `usage_counters` for previous month where `metric IN ('email','sms')`
3. For email overages: calculate `overage = max(0, used - cap)`, report to Stripe if overage > 0
4. For SMS: report total `used` count (all SMS are metered, no included cap)
5. Worker calls Stripe API: `POST /v1/subscription_items/{item_id}/usage_records` with `quantity` and `timestamp`
6. Stripe subscription configured with metered line items for "Email Overage" and "SMS Alert" products
7. Worker includes idempotency key: `{agency_id}_{month}_{metric}` to prevent duplicate charges
8. Stripe invoice generated automatically includes metered charges on next billing cycle
9. Dashboard displays upcoming charges: "Next invoice: $25 (plan) + $0.47 (23 email overages) + $0.03 (2 SMS) = $25.50"
10. Worker logs metered usage submission to `audit_log`: `billing.usage.reported`
11. Retry logic: if Stripe API call fails, Worker retries up to 3 times, logs error to Sentry

### Story 6.8: Cancellation & Refund Policy

**As a** user,  
**I want** to cancel my subscription and understand refund terms,  
**so that** I can discontinue service if needed.

**Acceptance Criteria:**

1. User clicks "Cancel Subscription" in Stripe Customer Portal (no custom UI needed at MVP)
2. Stripe cancellation configured: `cancel_at_period_end=true` (service continues until current period ends)
3. Dashboard displays: "Subscription canceled. Access until [end date]. Re-subscribe anytime."
4. No automatic prorated refunds on cancellation (per PRD refund policy)
5. Services remain active until period end, then subscription status changes to `canceled`
6. After cancellation, sites enter read-only mode: no new checks, historical data accessible
7. User can reactivate subscription via "Resubscribe" button (creates new subscription)
8. Refund requests handled manually: user contacts support, admin issues refund via Stripe Dashboard if approved
9. Refund cases documented: service outages, billing errors, extraordinary circumstances
10. Audit log records: `billing.subscription.canceled`, `billing.subscription.reactivated`, `billing.refund.issued`

---

## Epic 7: Agency Features & Reporting

**Goal:** Enable white-label branding, client dashboards with granular access control, monthly PDF report generation with performance summaries, CSV data exports, team member invitations with role management, and audit logging for compliance.

### Story 7.1: Team Member Invitations & Role Management

**As a** agency admin,  
**I want** to invite team members and assign roles,  
**so that** staff and clients can access appropriate data.

**Acceptance Criteria:**

1. Settings page includes "Team Members" section with list showing: Name, Email, Role, Invited Date, Actions
2. "Invite Member" button opens form: Email (required, validated), Role dropdown (Admin | Staff | Client), Message (optional)
3. Form submission creates pending invitation: inserts `invitations` table row with token, expires_at (7 days)
4. Invitation email sent via SES with link: `https://app.websitemage.com/accept-invite?token={TOKEN}`
5. Clicking link redirects to signup/login flow, then applies invitation (creates `agency_members` row with role)
6. Admins can: manage sites, billing, team, view all data
7. Staff can: manage sites, view all data (no billing/team access)
8. Clients can: view assigned sites only (read-only)
9. Multiple admins allowed per agency
10. Role change button allows admin to update member role (shows confirmation dialog)
11. Remove member button deletes `agency_members` row (shows warning: "User will lose access immediately")
12. Audit log records: `team.member.invited`, `team.member.role_changed`, `team.member.removed`

### Story 7.2: Client Site Access Control

**As a** agency admin,  
**I want** to grant clients access to specific sites only,  
**so that** they see their own sites without accessing other client data.

**Acceptance Criteria:**

1. Team member detail page (for Client role) displays "Site Access" section
2. Section shows all agency sites with checkboxes: checked = access granted
3. Selecting/deselecting checkbox updates `client_site_access` table (insert/delete row)
4. Client users see only granted sites in dashboard site list
5. Attempting to access non-granted site URL returns 403 Forbidden
6. RLS policies enforce: clients can query only `sites` where `EXISTS (SELECT 1 FROM client_site_access WHERE site_id = sites.id AND user_id = auth.uid())`
7. Client dashboard simplified: no billing, no team management, no agency-level stats
8. Site detail pages for clients show read-only views: no edit buttons, no delete actions
9. Client can export data for their own sites (CSV), cannot generate reports for others
10. Audit log records: `team.client.site_granted`, `team.client.site_revoked`

### Story 7.3: White-Label Branding (Agency Tier)

**As a** agency tier user,  
**I want** to customize the logo and colors for client-facing dashboards,  
**so that** my clients see my brand instead of Website Mage branding.

**Acceptance Criteria:**

1. Settings → Branding page available only for Agency tier (upgrade prompt shown for Base/Pro)
2. Page includes upload field for logo image (PNG/SVG, max 500KB, recommended 200×60px)
3. Logo uploaded to Supabase Storage bucket: `agency-logos/{agency_id}/logo.{ext}`
4. Logo URL stored in `agencies.branding_json.logo_url`
5. Page includes color picker for primary color (hex value), stored in `branding_json.primary_color`
6. Preview panel shows logo and primary color applied to sample dashboard UI
7. Client dashboard reads `branding_json` and applies: logo in header (replaces "Website Mage" logo), primary color for buttons/links/badges
8. Custom domain field: "Client Portal Domain" (e.g., `monitoring.myagency.com`)
9. Custom domain requires CNAME setup: user configures CNAME pointing to `client.websitemage.com`, validated via DNS lookup
10. Custom domain SSL provisioned via Cloudflare (automatic with Cloudflare DNS)
11. Client dashboard accessible at custom domain with branding applied
12. Main dashboard (app.websitemage.com) always shows Website Mage branding for agency staff

### Story 7.4: Monthly PDF Report Generation

**As a** agency tier user,  
**I want** automated monthly PDF reports generated for each site,  
**so that** I can send professional reports to clients without manual work.

**Acceptance Criteria:**

1. Scheduled Worker runs on 1st of each month at 06:00 UTC
2. Worker queries all Agency tier sites and generates report for previous month
3. Report includes sections: Executive Summary, Uptime (%, incidents, MTTR), PageSpeed Trends (score deltas, CWV changes), RUM Insights (p75 metrics, device breakdown), Recommendations (top 3 opportunities)
4. Report generated using Supabase Edge Function with Puppeteer/Chrome (or external service like DocRaptor)
5. Report styled with agency branding: logo, colors, custom domain (if set)
6. PDF stored in Supabase Storage: `reports/{agency_id}/{site_id}/{YYYY-MM}.pdf`
7. Report URL stored in new table `reports`: `site_id`, `month`, `pdf_url`, `generated_at`
8. Email sent to agency admin (and optionally site contacts): "Monthly report for [site] is ready" with download link
9. Dashboard → Reports page lists all generated reports with: Site, Month, Generated Date, Download button
10. Report generation completes within 2 hours of month start (for all sites)
11. Reports retained for 12 months (Agency tier), deleted after
12. Manual report generation button available on site detail page: "Generate Report Now" (respects rate limit: 1 per site per day)

### Story 7.5: CSV Data Export

**As a** user,  
**I want** to export uptime incidents and PSI history to CSV,  
**so that** I can analyze data in external tools or share with stakeholders.

**Acceptance Criteria:**

1. Site detail page includes "Export Data" dropdown button with options: "Uptime Incidents (CSV)", "PageSpeed History (CSV)", "RUM Events (CSV, Pro/Agency only)"
2. Clicking option sends request to `/api/export?site_id=X&type=uptime&range=30d`
3. Worker queries respective table (uptime_checks, psi_results, rum_events) filtered by site_id and date range
4. Worker formats data as CSV with headers
5. CSV column mapping:
   - **Uptime**: Timestamp, Region, HTTP Status, TTFB (ms), Result (Up/Down), Error
   - **PSI**: Scanned At, Device, Performance Score, LCP (ms), CLS, INP (ms), FCP (ms), Lighthouse Version
   - **RUM**: Timestamp, Device, Country, Nav Type, LCP (ms), CLS, INP (ms), TTFB (ms), FCP (ms)
6. Worker returns CSV file with `Content-Disposition: attachment; filename="uptime-export-2025-10.csv"`
7. Export respects RLS: user can only export data for sites they have access to
8. Export limited to last 90 days of data (or tier retention limit)
9. Export completes in <5 seconds for typical 30-day range
10. Rate limit enforced: 10 exports per user per hour
11. Audit log records: `export.csv.uptime`, `export.csv.psi`, `export.csv.rum`

### Story 7.6: Audit Log Viewer

**As a** admin user,  
**I want** to view audit logs of high-impact actions,  
**so that** I can track changes for compliance and troubleshooting.

**Acceptance Criteria:**

1. Settings → Audit Log page displays table with columns: Timestamp, User, Action, Target (site/user/billing), Details, IP Address
2. Table data fetched from `audit_log` table filtered by `agency_id`
3. Table includes pagination: 50 rows per page
4. Filters available: Date Range (last 7d/30d/90d/custom), Action Type (dropdown: all | site._ | team._ | billing._ | export._), User (dropdown: all | specific user)
5. Action types logged: site.create, site.update, site.delete, team.member.invited, team.member.removed, billing.plan.changed, export.csv.\*, branding.updated, alert.config.changed
6. Details column shows JSON with relevant info (e.g., old/new values for updates)
7. Clicking row expands to show full details in formatted JSON viewer
8. Export audit log button: downloads CSV of filtered results (rate limited: 5 per day)
9. Audit logs retained for 12 months (automatic cleanup by scheduled Worker)
10. Admin-only access: Staff/Client roles see 403 Forbidden
11. System actions (automated Workers) recorded with `user_id=NULL`, source="system"

### Story 7.7: Client Dashboard UI (Agency Tier)

**As a** client user,  
**I want** a simplified, read-only dashboard showing my site metrics,  
**so that** I can monitor performance without clutter or access to other clients' data.

**Acceptance Criteria:**

1. Client users redirected to `/client-dashboard` on login (instead of `/dashboard`)
2. Client dashboard displays only granted sites (via `client_site_access`)
3. Dashboard layout simplified: no billing section, no team management, no settings (except "Change Password")
4. Site cards show: Domain, Uptime % (30d), Latest PSI Score, Last Incident (if any), "View Details" button
5. Site detail page shows: Uptime chart (30d), PSI trends (90d), RUM charts (30d), Incident history (read-only)
6. All edit buttons removed: no "Add Site", no "Run Scan", no "Edit Settings", no "Delete Site"
7. "Request Improvement" button displayed on site detail: triggers notification to agency admin via email
8. Notification email: "Client [name] requested performance improvement for [site]. View site: [link]"
9. Branding applied: agency logo, primary color, custom domain (if configured)
10. Footer includes: "Monitored by [Agency Name] using Website Mage" (or custom text from `branding_json.footer_text`)
11. Client dashboard renders in <2 seconds for up to 10 granted sites

---

## Checklist Results Report

_(To be populated after PM Checklist execution)_

---

## Next Steps

### Architect Prompt

**Prompt for Architect:**

> You are the Technical Architect for Website Mage. Please create a comprehensive Architecture Document using the Frontend Architecture template if needed, based on this PRD.
>
> Key areas to detail:
>
> - Nuxt 4 frontend architecture with SSR/SPA hybrid approach
> - Component structure for dashboard, charts, forms
> - State management with Pinia
> - Integration patterns with Cloudflare Workers API
> - Supabase client-side RLS patterns
> - TailwindCSS design system and component library
> - Testing strategy for Vitest unit tests and Playwright E2E
>
> Reference:
>
> - PRD: `docs/prd.md` (this document)
> - Tech Stack decisions in Technical Assumptions section
> - All epic/story acceptance criteria for implementation requirements
