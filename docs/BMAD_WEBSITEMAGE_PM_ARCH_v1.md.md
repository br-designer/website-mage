🧙‍♂️ BMAD-METHOD – Website Mage PM + Architecture v1.0

Version: 1.0 Date: 2025-10-26
Author: Kyle Baker
Project Type: SaaS Web Application
Stack: Nuxt 4 · Supabase · Cloudflare Workers · Stripe · AWS SES · Twilio · Sentry
Primary Domain: websitemage.com

1 Project Overview
1.1 Purpose

Website Mage is a SaaS platform that allows agencies, freelancers, and single-site owners to continuously monitor, analyze, and improve their websites after launch.
It provides uptime monitoring, performance insights (PageSpeed / Lighthouse), and privacy-safe Real User Monitoring (RUM) with alerting and monthly reports—all under one dashboard.

1.2 Core Objectives

Help agencies upsell post-launch maintenance by packaging monitoring and improvement metrics.

Provide real-world visibility into uptime, Core Web Vitals, and Lighthouse scores.

Enable recurring revenue through subscription tiers.

Stay lightweight and cost-efficient—built entirely on serverless and managed infrastructure.

1.3 Target Users
Segment	Description	Example Use Case
Agency Owners	Manage multiple client sites under one account	Monitor 50+ client sites; generate monthly reports
Freelancers	Handle handful of client projects	Offer performance plans post-build
Single-Site Owners	DIY monitoring of own business site	Receive alerts & speed improvement tips
1.4 Business Model
Plan	Price	Scope	Highlights
Base	$1 / site / mo	Small businesses	10-min uptime checks, monthly PSI, 25% RUM sampling
Pro	$5 / site / mo	Active freelancers	5-min checks, weekly PSI, 50% RUM
Agency	$25 / 25 sites bundle / mo	Agencies	5-min pooled checks, weekly PSI, 100% RUM, custom branding + domains

Add-ons: SMS alerts ($0.016 ea), email overages ($0.01 ea), future RUM packs.

1.5 KPIs at Launch

Conversion rate from trial → paid subscription

Total # of monitored sites onboarded

Average TTFB improvement trend across portfolio

2 Architecture Summary
2.1 High-Level Overview
                          ┌────────────────────┐
                          │   Marketing Site   │
                          │ websitemage.com    │
                          └────────┬───────────┘
                                   │
                                   ▼
        ┌──────────────────────────────────────────────────┐
        │              Authenticated  Dashboard             │
        │               app.websitemage.com                │
        │  (Nuxt 4 SSR · Tailwind · Sentry)                │
        └───────────────┬───────────────────────────────────┘
                        │GraphQL / REST
                        ▼
          ┌────────────────────────────┐
          │        API Gateway          │
          │    api.websitemage.com     │
          │ Cloudflare Workers + KV    │
          └───────────┬────────────────┘
                      │
                      ▼
         ┌───────────────────────────────┐
         │        Supabase Backend        │
         │  Postgres · Auth · Storage     │
         │  RLS by agency_id · Edge Fns  │
         └──────────────┬────────────────┘
                        │
                        ▼
        ┌──────────────────────────────────────────────┐
        │                Third-Party Services           │
        │ Stripe · SES · Twilio · Sentry · Cloudflare R2 │
        └──────────────────────────────────────────────┘

        RUM CDN → cdn.websitemage.com/rum.js
        Uptime & Cron Jobs → Cloudflare Workers (global + US-East)

2.2 Domain Map
Domain	Role	Hosted On	Notes
websitemage.com	Marketing + Docs	Netlify / Cloudflare Pages	Public site
app.websitemage.com	Dashboard	Netlify (Pro)	Auth users only
api.websitemage.com	API gateway (Workers)	Cloudflare Workers	JSON/GraphQL proxy to Supabase
cdn.websitemage.com	Static CDN (RUM JS)	Cloudflare R2 + Cache	1-year TTL
status.websitemage.com	(Phase 2) Status page	TBD	Optional later
2.3 Deployment Environments
Env	Purpose	Supabase Project	Stripe Mode	Domain	Notes
Dev	Local dev / sandbox	websitemage-dev	Test	dev.websitemage.com	Seed data for testing
Staging	QA / pre-release	websitemage-staging	Test	staging.websitemage.com	Mirrors production
Prod	Live system	websitemage-prod	Live	app.websitemage.com	Customer data only

All three share identical schema migrations via CI/CD.

2.4 Stack Components Summary
Layer	Technology	Purpose
Frontend	Nuxt 4 + Tailwind + TypeScript	SSR dashboard and client views
Auth	Supabase Auth + OAuth (Google / Microsoft / GitHub)	User authentication & session mgmt
Database	Supabase Postgres with RLS	Multi-tenant data storage per agency
API Layer	Cloudflare Workers + KV + Durable Objects	Routing, rate-limits, cron, RUM ingestion
Storage/CDN	Cloudflare R2 + Supabase Storage	RUM JS, PSI screenshots, PDF reports
Billing	Stripe Subscriptions + Metered usage	Plan billing, email/SMS overages
Notifications	AWS SES (email) · Twilio (SMS)	Alerting & dunning emails
Monitoring	Sentry · Cloudflare Logs · Supabase Logs	Internal error tracking
Backups	Supabase automated daily + optional S3	7 → 30-day retention
Infrastructure	Netlify frontend + Cloudflare Workers backend	Global edge deployment
2.5 Core Worker Topology
              ┌───────────────────────────────────────────┐
              │           Cloudflare Workers Layer         │
              ├───────────────────────────────────────────┤
              │ api.websitemage.com → Main API Gateway     │
              │ rum.ingest → Handle RUM beacons (global)   │
              │ uptime.cron → 5-min cron checks (global)   │
              │ psi.queue  → hourly PSI batch jobs (US-E)  │
              │ cleanup.daily → purge old logs (US-E)      │
              └───────────────────────────────────────────┘
                        │
                        ▼
                 Supabase (Postgres + Auth)


Region affinity: US-East for DB-bound Workers.

Global: for uptime pings & RUM ingestion.

2.6 Security Headers & CSP
Content-Security-Policy:
  default-src 'self';
  script-src 'self' https://*.supabase.co https://js.stripe.com https://*.sentry.io https://*.cloudflare.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: https://*.supabase.co https://*.cloudflare.com;
  connect-src 'self' https://api.websitemage.com https://*.supabase.co https://sentry.io https://stripe.com;
  frame-src https://js.stripe.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;

Strict-Transport-Security:
  max-age=63072000; includeSubDomains; preload


Additional headers: X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin.

2.7 Backups & Recovery Matrix
Component	Method	Frequency	Retention	RPO	RTO
Supabase DB	Built-in snapshot	Daily	7 → 30 days	≤ 24 h	≤ 2 h
Storage (PSI screenshots)	Worker → S3 export	Daily	30 days	≤ 24 h	≤ 4 h
KV / Config	JSON dump → Supabase	Weekly	30 days	≤ 48 h	≤ 4 h
2.8 Observability Pipeline
   [Nuxt]──┐
            │errors→ Sentry (90 d)
   [Workers]│logs→ Sentry + Cloudflare Logs (30 d)
            │metrics→ Supabase app_logs table
   [Supabase]─SQL errors→ internal logs (30 d)


Alerts sent to Slack #dev-ops when severity ≥ “error”.

2.9 BMAD Linkages (Preview)

The Architecture section connects directly to BMAD templates:

PRD: Features + Metrics.

Epics: Uptime · PSI · RUM · Billing · Alerts.

Risks: Service cost growth, Supabase limits, Cloudflare cron frequency.

Release Plan: Alpha → Private Beta → Public Launch.

3 System Design
3.1 Frontend – Nuxt 4 SSR Application
Overview

The main dashboard (app.websitemage.com) is a Nuxt 4 SSR app built with TypeScript, TailwindCSS, and Pinia for state management.
The same codebase will serve both agency admin and client-viewer experiences.

┌──────────────────────────┐
│   Nuxt 4 Frontend App    │
│  (SSR + SPA hybrid)      │
│  ├─ Auth flows (Supabase)│
│  ├─ Dashboard pages      │
│  ├─ Settings + Billing   │
│  ├─ Client View widgets  │
│  └─ Pinia Store + API SDK│
└──────────┬───────────────┘
           │HTTPS fetch → Cloudflare Workers
           ▼
    api.websitemage.com

Key Responsibilities
Feature	Description
Auth UI	Login, OAuth (Google/Microsoft/GitHub), session persistence
Sites Manager	CRUD for monitored sites, keyword validation
Dashboards	Uptime %, PSI trends, RUM charts, Alerts table
Reports	Monthly PDF report generation (via Supabase Edge Fn)
Billing Portal	Stripe Billing Portal iframe + webhook sync
Theme / Branding	Custom logo + color for Agency tier
Client View	Read-only widgets (Uptime 30 days, PSI, CWV, Incidents)
Nuxt Structure
/app
 ├─ composables/     # API SDK, auth, subscriptions
 ├─ components/      # Charts, tables, modals
 ├─ pages/
 │   ├─ dashboard.vue
 │   ├─ sites/[id].vue
 │   └─ settings.vue
 ├─ plugins/         # Sentry, Stripe, Supabase
 └─ stores/          # Pinia modules

Integration Plugins

@sentry/nuxt – error tracking

@stripe/stripe-js – billing portal

@supabase/nuxt – auth + DB queries

vueuse/core – utility composables

nuxt-security – headers/CSP injection

3.2 Backend – Supabase (Postgres + Auth + Storage)
Logical Schema Overview
           ┌──────────────────────────────┐
           │          agencies            │
           │ id • name • tier • branding  │
           └────────────┬─────────────────┘
                        │1-n
           ┌────────────▼─────────────┐
           │          sites           │
           │ id • domain • agency_id  │
           └────────────┬─────────────┘
                        │1-n
   ┌──────────┬─────────┴──────────┬────────────┐
   ▼          ▼                    ▼            ▼
uptime_checks psi_results        rum_events   alerts

Core Tables
Table	Purpose	Retention
agencies	Org profile + tier + branding	permanent
users	Supabase auth users + role mapping	permanent
sites	Each monitored domain per agency	30-day soft delete
uptime_checks	Logs each ping result (HTTP status, TTFB, region)	24 months
psi_results	Stored Lighthouse scores + CWV	24 months
rum_events	Aggregated real-user metrics	6–12 months
alerts	Email/SMS sent logs	6 months
audit_log	Staff actions	12 months
billing_usage	Email/SMS usage tracking	7 years (Stripe)
Row-Level Security (RLS)
-- Example RLS for sites table
CREATE POLICY "Agency isolation"
ON sites
FOR SELECT USING (agency_id = auth.uid()::uuid)
FOR ALL USING (EXISTS(
  SELECT 1 FROM agency_members
  WHERE user_id = auth.uid()
  AND agency_id = sites.agency_id
));


All queries filter by agency_id. Supabase Service Role used only by Workers.

3.3 Cloudflare Workers – Serverless Layer
Worker Functions
Worker	Schedule	Region	Description
api	on-demand	fixed (US-East)	Main API gateway → Supabase
uptime	every 5 min	global	Executes HTTP GET checks + validates keyword
psi	hourly	US-East	Queues PageSpeed runs via PSI API
cleanup	daily 03:00 UTC	US-East	Purges old data, archives to S3
rum_ingest	on-demand	global	Collects beacons from rum.js
webhook_stripe	on-demand	fixed	Handles Stripe events
Data Flow
[cron trigger]──▶[Worker:uptime]──▶Supabase
[user click scan]──▶[Worker:psi]──▶Google PSI API──▶Supabase
[user browser rum.js]──▶[Worker:rum_ingest]──▶Supabase

Worker Storage Bindings
Binding	Purpose
UPTIME_KV	track rate limit counters
RUM_KV	temporary buffer for RUM beacons
CONFIG	cached site settings
SENTRY_DSN	error logging
SUPABASE_URL/KEY	DB connection (secrets)
3.4 Notifications – AWS SES + Twilio
[Worker → Alert trigger]
       │
       ├─Email→AWS SES (SMTP API)
       └─SMS →Twilio API


Email caps: Base 100 / Pro 500 / Agency 5000 per month

Overage billing ($0.01 / email, $0.016 / SMS)

Throttling = max 3 emails per incident until recovery

Quiet hours optional per recipient (timezone-aware)

3.5 Billing – Stripe Subscriptions + Usage Records
[Nuxt App]──▶Stripe Checkout
      │
      ▼
[Stripe Webhook Worker]──▶Supabase billing_usage
      │
      └▶Pause/Resume checks based on status

Product Catalog (Stripe)
Product	Price	Quantity Rule
Base	$1 /site/mo	1 site increments
Pro	$5 /site/mo	1 site increments
Agency	$25 / 25-site bundle	bundle increments
Email Overage	$0.01 / email	metered usage
SMS Alerts	$0.016 / SMS	metered usage

Stripe Tax enabled.
Dunning window = 7 days with “Smart Retries”.
Unpaid → lock dashboard (read-only) + pause Workers.

3.6 Security & Privacy Pipeline
┌────────────────────────────┐
│  User Browser              │
│  (RUM script, Dashboard)   │
└──────────┬─────────────────┘
           │HTTPS
           ▼
┌────────────────────────────┐
│  Cloudflare Workers WAF    │
│  • CSP enforcement         │
│  • Rate-limits             │
│  • Bot filtering           │
└──────────┬─────────────────┘
           ▼
┌────────────────────────────┐
│  Supabase (Postgres RLS)   │
│  • JWT Auth check          │
│  • RLS per agency          │
└──────────┬─────────────────┘
           ▼
┌────────────────────────────┐
│  Stripe / SES / Twilio     │
│  • Scoped API keys (Workers)│
└────────────────────────────┘


No PII in RUM data

Cookie-less tracking

Soft-delete + 30-day retention window

CSP + HSTS headers globally applied

3.7 Data Flow – Example Uptime Check
[5-min cron]──▶[uptime Worker]
    │ iterate active sites
    ▼
HTTP GET (domain)
    │ success/failure
    ▼
Supabase → insert uptime_checks
    │
    ├─if fail ×3 → send alert
    └─if recovered → send recovery alert

3.8 Data Flow – RUM Collection
Browser (page load)
   │
   ├─Collect: LCP CLS INP TTFB FCP UA-CH Viewport Region
   └─POST → cdn.websitemage.com/rum.js → Worker
            │validate + sample 25–100%
            ▼
            Supabase INSERT → rum_events


Sampling rates: Base 25%, Pro 50%, Agency 100%

Event caps: 1k / 10k / 50k shared

3.9 Error Tracking & Logging Detail
Source	Tool	Retention	Alert Flow
Nuxt frontend	Sentry	90 days	Slack #dev-ops
Workers	Sentry + Cloudflare logs	30 days	Slack #dev-ops
Supabase	Built-in logs	30 days	Console review
App logs (table)	Supabase	60 days	Aggregated metrics UI later
3.10 Testing Stack
Type	Tool	Scope
Unit	Vitest	SDK functions, RUM parser, PSI fetch
E2E	Playwright	Dashboard flows + auth + billing
Load	k6	RUM ingest endpoint, uptime Worker batch
Lint	ESLint + Prettier + commitlint	Conventional commits + CI enforcement

CI/CD runs on Netlify + Cloudflare deploy hooks.

3.11 Summary of Subsystems
Subsystem	Owner	Key Output
Nuxt Frontend	Web Team	Dashboard UI + Reports
Cloudflare Workers	DevOps	Cron jobs + API layer
Supabase Backend	Data Team	DB + Auth + Storage
Stripe Billing	Finance Ops	Revenue tracking
SES/Twilio Alerts	Support Ops	Client notifications
Sentry Monitoring	Engineering	Error visibility

4 Data Model & Schema Design

This section defines the multi-tenant schema, RLS isolation, indexes, retention, quotas, and soft-delete strategy. It is optimized for Supabase Postgres with Row-Level Security.

4.1 Entity Relationship Diagram (ERD)
                          ┌──────────────────────────┐
                          │         users*           │  (*Supabase Auth)
                          │ id (uuid)               │
                          └─────────────┬────────────┘
                                        │1..n (membership)
                           ┌────────────▼─────────────┐
                           │      agency_members      │
                           │ user_id (uuid)          │
                           │ agency_id (uuid)        │
                           │ role (enum)             │
                           └────────────┬─────────────┘
                                        │n..1
                     ┌──────────────────▼──────────────────┐
                     │               agencies               │
                     │ id (uuid)                           │
                     │ name, tier (enum)                   │
                     │ branding_json, custom_domain        │
                     └───────────────┬─────────────────────┘
                                     │1..n
               ┌─────────────────────▼─────────────────────┐
               │                  sites                    │
               │ id (uuid)                                 │
               │ agency_id (uuid)                          │
               │ domain, expected_keyword                  │
               │ settings_json, deleted_at                 │
               └─────────┬──────────┬─────────┬────────────┘
                         │1..n      │1..n     │1..n
           ┌─────────────▼───┐  ┌───▼────────┐ ┌────────────▼───────────┐
           │   uptime_checks │  │ psi_results│ │        rum_events       │
           │ (log entries)   │  │ (per scan) │ │ (raw RUM beacons)      │
           └──────────┬──────┘  └────┬───────┘ └──────────┬─────────────┘
                      │1..n          │1..n                │n..1
           ┌──────────▼─────────┐ ┌──▼─────────┐  ┌───────▼───────────┐
           │ uptime_incidents   │ │ psi_latest │  │ rum_daily_agg     │
           │ (open/closed)      │ │ (mat.view) │  │ (rollups)         │
           └──────────┬─────────┘ └────────────┘  └─────────┬─────────┘
                      │1..n                               1..n│
            ┌─────────▼──────────┐              ┌────────────▼─────────┐
            │       alerts_sent   │              │  usage_counters      │
            │ (email/sms logs)    │              │ (per month quotas)   │
            └──────────┬──────────┘              └────────────┬─────────┘
                       │1..n                                 1..n│
             ┌─────────▼───────────┐               ┌───────────▼──────────┐
             │ client_site_access  │               │  audit_log            │
             │ (viewer↔site map)   │               │ (staff/system acts)   │
             └─────────────────────┘               └───────────────────────┘

4.2 Table Specifications (DDL Sketches)

Conventions

*_id are UUIDs.

created_at/updated_at default now().

Soft-delete uses deleted_at.

All tables include agency_id for RLS scoping unless noted.

4.2.1 agencies
create type agency_tier as enum ('base','pro','agency','enterprise_future');

create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tier agency_tier not null default 'base',
  branding_json jsonb not null default '{}', -- logo/colors
  custom_domain text,                         -- Agency tier client portal
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on agencies (tier);

4.2.2 agency_members
create type member_role as enum ('admin','staff','client');

create table public.agency_members (
  agency_id uuid not null references agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role member_role not null,
  created_at timestamptz not null default now(),
  primary key (agency_id, user_id)
);
create index on agency_members (user_id);

4.2.3 sites
create table public.sites (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  domain text not null,
  expected_keyword text, -- optional uptime content check
  settings_json jsonb not null default '{}', -- frequency, regions, quiet hours
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, domain)  -- dedupe inside an agency
);
create index on sites (agency_id);
create index on sites (deleted_at);

4.2.4 client_site_access (client viewers → subset of sites within same agency)
create table public.client_site_access (
  agency_id uuid not null,
  site_id uuid not null references sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (site_id, user_id),
  constraint csa_same_agency
    check (agency_id = (select agency_id from sites s where s.id = site_id))
);
create index on client_site_access (user_id);

4.2.5 uptime_checks & uptime_incidents
create table public.uptime_checks (
  id bigserial primary key,
  agency_id uuid not null,
  site_id uuid not null references sites(id) on delete cascade,
  checked_at timestamptz not null default now(),
  region text not null,                  -- e.g., 'us-east','eu-west','ap-sg'
  http_status int,
  ttfb_ms int,                           -- from Worker timing
  ok boolean not null,                   -- 200..299 + (keyword if configured)
  err text,                              -- fetch error / reason
  created_at timestamptz not null default now()
);
create index on uptime_checks (site_id, checked_at desc);
create index on uptime_checks (agency_id, checked_at desc);

create table public.uptime_incidents (
  id bigserial primary key,
  agency_id uuid not null,
  site_id uuid not null references sites(id) on delete cascade,
  opened_at timestamptz not null,
  closed_at timestamptz,
  reason text,                       -- aggregated reason (timeout, 5xx, keyword)
  alert_sent_count int not null default 0
);
create index on uptime_incidents (site_id, opened_at desc);

4.2.6 psi_results (+ materialized view psi_latest)
create table public.psi_results (
  id bigserial primary key,
  agency_id uuid not null,
  site_id uuid not null references sites(id) on delete cascade,
  scanned_at timestamptz not null default now(),
  device text not null check (device in ('mobile','desktop')),
  lighthouse_version text,
  performance_score int,                -- 0..100
  lcp_ms int, cls numeric(6,3), inp_ms int, fid_ms int, fcp_ms int,
  opportunities jsonb,                  -- selected suggestions
  screenshot_url text
);
create index on psi_results (site_id, scanned_at desc);
create index on psi_results (agency_id, scanned_at desc);

-- Latest per site/device (fast dashboard reads)
create materialized view public.psi_latest as
  select distinct on (site_id, device)
    site_id, device, scanned_at, performance_score,
    lcp_ms, cls, inp_ms, fid_ms, fcp_ms, lighthouse_version
  from psi_results
  order by site_id, device, scanned_at desc;

4.2.7 rum_events (raw) & rollups

Note: High-volume table. Keep narrow columns; roll up daily.

create table public.rum_events (
  id bigserial primary key,
  agency_id uuid not null,
  site_id uuid not null references sites(id) on delete cascade,
  ts timestamptz not null default now(),
  nav_type text, -- navigate, reload, back-forward, prerender
  device text,   -- 'mobile'|'desktop' (derived from viewport/UA-CH)
  ua text,       -- simplified UA-CH string (no PII)
  viewport_w int, viewport_h int,
  country char(2),
  lcp_ms int, cls numeric(6,3), inp_ms int, fid_ms int, ttfb_ms int, fcp_ms int
);
create index on rum_events (site_id, ts desc);
create index on rum_events (agency_id, ts desc);
create index on rum_events (country);


Daily aggregation (per site/device/country):

create table public.rum_daily_agg (
  agency_id uuid not null,
  site_id uuid not null,
  day date not null,
  device text not null,
  country char(2),
  samples int not null,
  p50_lcp_ms int, p75_lcp_ms int, p95_lcp_ms int,
  p75_cls numeric(6,3),
  p75_inp_ms int,
  p50_ttfb_ms int,
  p50_fcp_ms int,
  primary key (site_id, day, device, country)
);
create index on rum_daily_agg (site_id, day desc);


A nightly Worker computes aggregates and purges old rum_events per retention policy.

4.2.8 alerts_sent
create type alert_channel as enum ('email','sms');

create table public.alerts_sent (
  id bigserial primary key,
  agency_id uuid not null,
  site_id uuid references sites(id) on delete set null,
  incident_id bigint references uptime_incidents(id) on delete set null,
  channel alert_channel not null,
  recipient text not null,
  sent_at timestamptz not null default now(),
  meta jsonb not null default '{}' -- SES/Twilio message ids, status
);
create index on alerts_sent (agency_id, sent_at desc);
create index on alerts_sent (site_id, sent_at desc);

4.2.9 usage_counters (monthly quotas & consumption)
-- One row per (agency|site|metric|month)
create type usage_metric as enum ('email','sms','rum');

create table public.usage_counters (
  id bigserial primary key,
  agency_id uuid not null,
  site_id uuid,                         -- null for pooled (Agency RUM pool)
  metric usage_metric not null,
  month date not null,                  -- yyyy-mm-01
  cap int not null,                     -- plan-derived limit
  used int not null default 0,
  updated_at timestamptz not null default now(),
  unique (agency_id, coalesce(site_id, '00000000-0000-0000-0000-000000000000'::uuid), metric, month)
);
create index on usage_counters (agency_id, metric, month);


Enforcement

Hard limits at Worker layer (check used >= cap → 429).

DB triggers increment used on alerts_sent insert and on accepted RUM beacon.

4.2.10 audit_log
create table public.audit_log (
  id bigserial primary key,
  agency_id uuid not null,
  user_id uuid references auth.users(id),
  site_id uuid references sites(id),
  action text not null,           -- e.g., 'site.create','check.delete','billing.update'
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on audit_log (agency_id, created_at desc);
create index on audit_log (site_id, created_at desc);

4.2.11 (Optional) rum_bot_events
create table public.rum_bot_events (
  id bigserial primary key,
  agency_id uuid not null,
  site_id uuid not null references sites(id) on delete cascade,
  ts timestamptz not null default now(),
  ua text,
  country char(2),
  reason text -- e.g., known bot UA, headless, automation flags
);
create index on rum_bot_events (site_id, ts desc);

4.3 RLS (Row-Level Security) Policies

Principle: Every table with agency_id enforces isolation by member relationship. Clients are read-only and scoped to their granted sites.

Helper view for membership (fast checks):

-- Optional: a function to check membership
create or replace function is_member_of(ag_id uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from agency_members
    where agency_id = ag_id and user_id = auth.uid()
  );
$$;


Example: sites

alter table sites enable row level security;

create policy sites_select on sites
for select using (is_member_of(agency_id));

create policy sites_modify on sites
for all using (
  is_member_of(agency_id) and
  exists (select 1 from agency_members m 
          where m.agency_id = agency_id and m.user_id = auth.uid() and m.role in ('admin','staff'))
);


Client site scoping (read-only):

create policy sites_client_select on sites
for select using (
  exists (select 1 from client_site_access csa 
          where csa.site_id = sites.id and csa.user_id = auth.uid())
);


Logs (read-only for all members; clients only for their sites):

alter table uptime_checks enable row level security;

create policy uptime_checks_member on uptime_checks
for select using (is_member_of(agency_id));

create policy uptime_checks_client on uptime_checks
for select using (
  exists (select 1 from client_site_access csa
          where csa.site_id = uptime_checks.site_id and csa.user_id = auth.uid())
);


Service Role (Workers): Use Supabase service key for inserts/updates; bypass RLS as needed. Limit exposure by only running on server/Workers.

4.4 Indexing & Performance

Time-series: (site_id, checked_at desc) on uptime_checks; (site_id, scanned_at desc) on psi_results; (site_id, ts desc) on rum_events.

Filter fields: (agency_id, created_at desc) for most tables.

Materialized View: psi_latest refreshed on insert (see trigger below).

Partitioning (future): Partition rum_events by month if volume grows.

Refresh trigger for psi_latest:

create or replace function refresh_psi_latest()
returns trigger language plpgsql as $$
begin
  refresh materialized view concurrently public.psi_latest;
  return null;
end;
$$;
create trigger trg_refresh_psi_latest
after insert on psi_results
for each statement execute function refresh_psi_latest();

4.5 Quotas, Rate Limits & Enforcement

Counters on insert (emails / sms / rum):

-- Example for alerts_sent (email/sms)
create or replace function inc_usage_counter()
returns trigger language plpgsql as $$
declare m usage_metric;
begin
  m := case when new.channel = 'email' then 'email'::usage_metric else 'sms'::usage_metric end;
  insert into usage_counters (agency_id, site_id, metric, month, cap, used)
  values (new.agency_id, new.site_id, m, date_trunc('month', now())::date, 0, 1)
  on conflict (agency_id, coalesce(site_id,'00000000-0000-0000-0000-000000000000'::uuid), metric, month)
  do update set used = usage_counters.used + 1, updated_at = now();
  return new;
end;
$$;
create trigger trg_inc_usage_alerts
after insert on alerts_sent
for each row execute function inc_usage_counter();


Hard caps are enforced at Worker level (fast reject with 429) using usage_counters.used >= cap. DB counters serve for billing/visibility.

RUM caps: Agency pool vs per-site caps are read by the Worker from usage_counters; if exceeding, respond 429 with Retry-After.

Rate limits: Implemented in Cloudflare Workers KV/Durable Objects (see Part 2). DB stores only summary incidents if desired.

4.6 Retention & Soft-Delete

Soft-delete: sites.deleted_at set on removal. Workers stop checks. A daily job purges related data after 30 days.

Retention windows (cron purge):

-- Uptime & PSI: 24 months
delete from uptime_checks where checked_at < now() - interval '24 months';
delete from psi_results where scanned_at < now() - interval '24 months';

-- RUM raw: 6 months (keep daily aggregates longer)
delete from rum_events where ts < now() - interval '6 months';

-- Alerts logs: 6 months
delete from alerts_sent where sent_at < now() - interval '6 months';

-- Audit logs: 12 months
delete from audit_log where created_at < now() - interval '12 months';


Aggregation job: nightly Worker calculates rum_daily_agg (p50/p75/p95) and keeps those beyond raw retention (e.g., 12+ months) to preserve long-term trends.

4.7 Enumerations & Reference Data

agency_tier: 'base'|'pro'|'agency'|'enterprise_future'

member_role: 'admin'|'staff'|'client'

alert_channel: 'email'|'sms'

usage_metric: 'email'|'sms'|'rum'

Regions reference (optional): small table regions(code,name) used by uptime Workers.

4.8 Derived Views for Dashboards

Uptime last 30 days (%):

create view v_site_uptime_30d as
select
  site_id,
  100.0 * avg(case when ok then 1 else 0 end)::numeric as uptime_pct_30d
from uptime_checks
where checked_at >= now() - interval '30 days'
group by site_id;


Email usage progress (month):

create view v_email_usage as
select agency_id, site_id, used, cap,
       (used::numeric / nullif(cap,0)) as used_ratio
from usage_counters
where metric='email' and month = date_trunc('month', now())::date;


PSI trend (simple):

create view v_psi_trend as
select site_id, device, date_trunc('day', scanned_at) as day,
       avg(performance_score)::int as avg_score
from psi_results
group by site_id, device, day;

4.9 Billing & Plans (Reference Tables, optional)

Stripe is source of truth; these tables provide cache and plan logic:

create table public.plans (
  id text primary key, -- 'base','pro','agency'
  price_cents int not null,
  rum_cap_per_site int, -- null if pooled
  email_cap_per_site int,
  psi_auto text not null -- 'monthly'|'weekly'
);

create table public.subscriptions (
  id text primary key,             -- Stripe sub id
  agency_id uuid not null references agencies(id) on delete cascade,
  plan_id text not null references plans(id),
  site_quantity int not null,      -- Base/Pro: per-site; Agency: bundles*25
  status text not null,            -- active, past_due, unpaid, canceled
  current_period_end timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


Workers read from subscriptions to set usage_counters.cap each month.

4.10 Auditing (What to Log)

site.create/delete/update

uptime.check.create/update (frequency, regions, expected_keyword)

contacts.update (alert recipients, quiet hours)

branding.update / custom_domain.update

billing.update (plan/quantity)

System actions: dunning.pause, dunning.resume, quota.hit, quota.reset

Example insert:

insert into audit_log (agency_id, user_id, site_id, action, details)
values ($1, $2, $3, 'site.create', jsonb_build_object('domain',$4));

4.11 Security Notes (Data Layer)

No PII stored in RUM; UA-CH only; country derived, IP discarded.

JWT from Supabase Auth; RLS checks membership for all SELECT/INSERT/UPDATE/DELETE.

Service-role key only in Workers (Cloudflare Secrets).

CSP/HSTS enforced at edge (see Part 2).

Backups daily (7→30 days) with monthly restore test.

4.12 Migration & Seeding

All DDL scripted in /supabase/migrations.

Seed scripts for dev/staging insert:

1 agency (tier: pro), 1 admin user

3 demo sites (one “down” incident seeded)

PSI historical rows (~20 days)

RUM daily aggregates for charts

Usage counters with near-cap values (to test banners)

4.13 Open Extensions (Phase-2 Ready)

Partitioned rum_events by month for very large volumes.

API keys per agency (for external pulls).

Webhooks table (outbound_webhooks) for Slack/Discord integrations.

ssl_checks and domain_expiry_checks tables (MVP enabled for Pro/Agency).


5 Feature Specifications

This section defines MVP behavior for Uptime, PSI, RUM, Alerts, Dashboards/Reports, Billing, and Admin. Each feature includes user stories, flows, limits, and acceptance criteria.

5.1 Uptime Monitoring
5.1.1 Scope & Behavior

Method: HTTP GET, follow redirects (≤3), optional expected keyword match.

Regions: Multi-region probes (US/EU/APAC) to reduce false positives.

Frequency:

Base: 10 min

Pro: 5 min

Agency: 5 min (pooled across sites)

Timeout: 10s; Retries: 3 before opening incident.

Incident policy: Send initial “down”, suppress further until “up” (recovery).
No heartbeat spam.

5.1.2 Flow
[cron 5/10m] → fetch site (US, EU, APAC)
     |
     ├─ majority success → OK
     └─ majority fail (after 3 retries) → open incident → alert
up again → close incident → send recovery alert

5.1.3 Tier Features

SSL expiry / DNS resolve / HTTP status trends: included for Pro & Agency.

Quiet hours: configurable (off by default); timezone per site/recipient.

5.1.4 Rate & Caps

Per-tenant manual rechecks via UI respect PSI rate limits (separate feature).

Alerts throttled to max 3 emails per incident until recovery.

5.1.5 Acceptance Criteria

Opens incident only after 3 consecutive failures per region majority.

Sends at most 1 “down” email and 1 recovery email per incident.

Honors keyword validation when configured.

Pro/Agency show SSL days-to-expiry, DNS resolve status, and 30d status trend.

5.2 PageSpeed / Lighthouse (PSI)
5.2.1 Scope & Behavior

Auto-schedule:

Base: Monthly

Pro/Agency: Weekly

Manual scans (debounce + daily caps + caching aligned):

Base: 1 per 10 min, 10/day, cache 10 min

Pro: 1 per 5 min, 25/day, cache 5 min

Agency: 1 per 3 min, 50/day, cache 3 min

Devices: Mobile & Desktop by default; agency may disable one.

5.2.2 Data Stored per Scan

performance_score, LCP, CLS, INP/FID, FCP, lighthouse_version, opportunities JSON, optional screenshot_url.

5.2.3 Historical Retention

Base: 30d, Pro: 90d, Agency: 180d.

Always append (no overwrites); materialized psi_latest for dashboards.

5.2.4 Flow
[user triggers scan]
   │ check caps/TTL
   ├─ hit cache? → return cached
   └─ call PSI → store result → update trend

5.2.5 Acceptance Criteria

Debounce and cache TTL match per tier (no stale UX confusion).

Daily cap enforced with visible remaining scans counter.

Results include both device types when configured.

Trends chart shows at least 30 days (Base) / 90/180 for higher tiers.

5.3 Real User Monitoring (RUM)
5.3.1 Script & Beacon

Snippet:

<script src="https://cdn.websitemage.com/rum.js" data-site="SITE_ID"></script>


Captures: LCP, CLS, INP (FID fallback), TTFB, FCP, nav type, UA-CH, viewport, country/region.

Cookie-less, no PII, no IP storage, DNT honored.

5.3.2 Sampling (per tier)

Base: 25%

Pro: 50%

Agency: 100%

5.3.3 Event Caps & Enforcement

Base: 1k / month / site (hard limit)

Pro: 10k / month / site (hard limit)

Agency: 50k / month shared pool

Hard 429 when cap exceeded; future: optional metered overages.

5.3.4 Bot Handling

Heuristics + known UA list: discard from standard metrics;
Log to rum_bot_events for a separate “Bot Traffic” view.

5.3.5 Aggregation & Retention

Raw retention: 6–12 months (purge after 6 if needed).

Nightly rollups to rum_daily_agg (p50/p75/p95) retained longer.

5.3.6 Acceptance Criteria

Beacons drop when DNT=1.

Sampling and monthly caps enforced per tier.

Aggregated charts display p75 LCP/CLS/INP with device + region filters.

Bot traffic excluded from primary charts; visible in a separate panel.

5.4 Alerts & Notifications
5.4.1 Channels

Email (SES) caps per month:

Base 100 / Pro 500 / Agency 5000 (shared)

Overage: $0.01 per email after cap

SMS (Twilio): US-only at launch; opt-in add-on

Price: $0.016/SMS (Twilio cost ×2)

Billed as metered usage, 1¢ minimum per SMS

Per-incident throttling: max 3 emails until recovery.

5.4.2 Quiet Hours & Timezones

Off by default; configurable per recipient or site;
Timezone set per recipient; “critical” can bypass (optional future).

5.4.3 Acceptance Criteria

Email/SMS stop when monthly cap reached; Email overages billed.

Incident notifications respect throttling; recovery always delivered.

Quiet hours behave per recipient timezone when enabled.

5.5 Dashboards & Reporting
5.5.1 Agency Dashboard (internal)

Widgets:

Sites list with status pills

Uptime % (7/30d), incident list

PSI trends (mobile/desktop), overall health from Lighthouse

RUM trends (p75 CWV) with device/region filters

Usage meters (emails, SMS, RUM)

SSL/DNS/HTTP trends (Pro/Agency)

5.5.2 Client Dashboard (Agency tier only)

Read-only: Uptime 30d, PSI trend, CWV summary, last incidents

“Request improvement” links trigger agency notifications

5.5.3 Reports

Monthly PDF (Agency tier at MVP):
Uptime %, incidents, PSI deltas, CWV p75 trends, recommendations.

Exports: CSV for uptime incidents & PSI history (MVP).

5.5.4 Acceptance Criteria

Client dashboard restricted to Agency tier and granted sites only.

Monthly report emails generated within 48h of month end.

CSV exports download under 5s for typical 30d ranges.

5.6 Billing, Trials & Dunning
5.6.1 Product Model

Base $1/site/mo; Pro $5/site/mo; Agency $25 per 25-site bundle.

SMS usage and Email overage metered via Stripe.

No caps by # of sites beyond plan quantity scaling; customers can add more (Base/Pro by 1; Agency by 25).

5.6.2 Trials

1-month free trial, CC required; converts to Base after 30d.

Trial covers one project (site) only.

Emails 5 days and 1 day before charge.

5.6.3 Dunning

Stripe Smart Retries over 7 days; 3 reminder emails (D1/D3/D5).

past_due → service active w/ banner; unpaid → pause checks, disable RUM, lock edits.

Auto-resume on payment.

5.6.4 Refund Policy

No automatic pro-rations on cancel; service continues to period end.

Upgrades prorate immediately; downgrades next cycle.

Discretionary refunds for errors/outages only.

5.6.5 Acceptance Criteria

Stripe products/prices match catalog; quantities reflect site counts or 25-site bundles.

Dunning transitions pause/resume all Workers reliably.

Invoices show metered lines for email/SMS with correct totals.

5.7 Admin, Branding & White-Label
5.7.1 Roles & Invites

Roles: Admin, Staff, Client.

Admin invites staff/clients by email; multiple Admins allowed.

Client is read-only with per-site mapping via client_site_access.

5.7.2 Branding (Agency tier)

Custom logo/colors for dashboards.

Custom domain for client views (CNAME) – Agency tier.

5.7.3 Email/SMS Branding

From-name, reply-to, signature customizable per agency.

Templates stored in branding_json.

5.7.4 Audit Log

Log create/delete site, check config changes, recipient changes, billing plan/quantity changes, and system pause/resume.

Retain 12 months.

5.7.5 Acceptance Criteria

Client-view users cannot access any site not whitelisted.

Branding applies to client dashboard and report header.

Audit log shows actor, action, target, timestamp for all high-impact changes.

5.8 API (Internal + Future External)
5.8.1 Internal Worker Endpoints

POST /rum/ingest – beacon intake (rate-limited, cap-enforced)

POST /uptime/run – cron-only, batches checks

POST /psi/queue – schedule scans

GET /sites/:id/metrics – aggregate dashboard data

POST /webhooks/stripe – billing events

5.8.2 Rate Limits (Per Tenant)

PSI manual: Base 1/min, Pro 1/min, Agency 2/min (daily: 10/25/50)

RUM ingest burst: Base 50/min, Pro 250/min, Agency 1000/min

API reads: Base 60/min, Pro 120/min, Agency 300/min

5.8.3 Acceptance Criteria

429s include Retry-After.

Rate limit counters are per agency_id.

All endpoints require auth (except rum ingest) and enforce RLS on reads.

6 Acceptance Criteria (Condensed Matrix)
Feature	Key AC
Uptime	3 consecutive region-majority failures open incident; one “down” + one “recovery” alert; SSL/DNS/status trends visible for Pro/Agency
PSI	Debounce = cache TTL per tier; daily caps enforced w/ counter; mobile+desktop scans stored; trend charts render within 2s for last 30–180d
RUM	DNT honored; sampling per tier; monthly caps enforced (429); daily aggregates computed nightly; bots excluded from primary charts
Alerts	Email caps per plan; email overage billed at $0.01; SMS at $0.016; incident throttling to 3 emails; quiet hours if enabled
Dashboards	Client view read-only; “request improvement” notifies agency; CSV export ≤5s
Billing	Trial → Base conversion with notices at D-5/D-1; Smart retries 7d; unpaid pauses checks; upgrades prorate; cancels not prorated
Admin	Branding + custom domain (Agency); audit log retained 12 months; invites by email; multiple admins supported
7 Risks & Mitigations (Feature-Level)
Risk	Impact	Mitigation
PSI API throttling	Scans fail/slow	Align debounce with caching; hourly queue; exponential backoff
RUM volume spikes	DB cost/perf	Sampling; hard caps; nightly rollups; future partitioning
Alert storms	SES/SMS bills spike	Per-incident throttling; monthly caps; clear incident lifecycle
Multi-region false positives	Noisy incidents	Majority voting per region; retries; expected keyword check
Stripe webhooks missed	Billing desync	Idempotency keys; retry logic; reconciliation job nightly
8 Non-Functional Requirements (MVP)

Performance: dashboard pages <2s P95 with 50 sites; exports ≤5s for 30d.

Availability: best-effort 99.9% target (no formal SLA at launch).

Security: CSP/HSTS, RLS isolation, least-privilege secrets, Sentry with PII scrubbing.

Privacy: no PII in RUM, cookie-less, DNT honored.

Compliance: US-only data residency at MVP; backup retention 7→30d; monthly restore test.

Observability: Sentry alerts to Slack; 90d error retention; 30d logs.

9 Infrastructure & Operations
9.1 Overview

Website Mage is intentionally serverless-first to keep cost, maintenance, and scalability balanced.
All components are hosted on managed or edge platforms:

Layer	Platform	Purpose
Frontend	Netlify (Free → Pro)	Nuxt SSR dashboard + marketing site
Edge/API	Cloudflare Workers + KV + R2	Uptime cron, RUM ingest, API proxy
Database/Auth	Supabase (Postgres + Auth + Storage)	Tenant data + Row-Level Security
Payments	Stripe	Subscriptions & metered billing
Email	AWS SES	Transactional and alert emails
SMS	Twilio	SMS alert add-on
Monitoring	Sentry + Cloudflare Logs	Error tracking + edge metrics
Backups	Supabase auto-snapshots + S3	Daily backups 7 → 30 days
9.2 Environments Matrix
┌──────────────┬───────────────────────────────────────────────────────┐
│ Environment  │ Domain / Project / Keys                               │
├──────────────┼───────────────────────────────────────────────────────┤
│ Dev          │ dev.websitemage.com / websitemage-dev / test Stripe   │
│              │ Seed data auto-load; local Wrangler for Workers       │
│ Staging      │ staging.websitemage.com / websitemage-staging         │
│              │ Mirrors prod; QA gate before release                  │
│ Production   │ app.websitemage.com / websitemage-prod / live Stripe  │
│              │ Customer data only – audited access required          │
└──────────────┴───────────────────────────────────────────────────────┘


Each env has its own Supabase project + Cloudflare namespace; Stripe uses test vs live keys.

9.3 CI/CD Pipeline
9.3.1 Flow Diagram
           ┌─────────────┐
           │   Developer │
           └──────┬──────┘
                  │ push / PR
                  ▼
     ┌───────────────────────────┐
     │   GitHub Actions + PNPM   │
     │  • lint / vitest / build  │
     │  • conventional commit chk │
     └──────┬──────────────┬─────┘
            │              │
     ┌──────▼──────┐ ┌─────▼────────┐
     │  Netlify CI │ │ Wrangler CI  │
     │  (Nuxt build│ │ (Deploy Wrk) │
     └──────┬──────┘ └─────┬────────┘
            │                │
            ▼                ▼
   app.websitemage.com   api.websitemage.com

9.3.2 Checks

Pre-Commit → ESLint + Prettier + Commitlint

Unit Tests → Vitest (≥ 90 % pass required)

E2E Tests → Playwright on Staging

Smoke Deploys → Netlify Preview per PR

Tag Release → Auto version + Changelog generate (pnpm version patch/minor)

9.4 Cloudflare Workers Scheduling
+───────────────+──────────+───────────+───────────────────────────────+
| Worker        | Cron     | Region    | Function                      |
+---------------+----------+-----------+--------------------------------+
| uptime.cron   | 5 min    | Global    | Ping active sites by tier      |
| psi.queue     | 60 min   | US-East   | Batch PSI requests             |
| cleanup.daily | 24 h     | US-East   | Purge old data & rollups      |
| usage.reset   | 1 month  | US-East   | Reset usage_counters caps     |
| rum.ingest    | on-demand| Global    | Collect RUM beacons           |
| stripe.webhook| on-event | US-East   | Billing sync & dunning        |
+---------------+----------+-----------+--------------------------------+


Granularity ≤ 5 min is Cloudflare’s limit; PSI jobs use hourly batching for API rate headroom.

9.5 Secrets & Configuration
Scope	Store	Notes
Frontend	Netlify env vars	Public keys (Stripe publishable, Supabase anon)
Workers	Cloudflare Secrets (wrangler secret put)	Service keys (Supabase svc, SES, Twilio, Sentry DSN)
Backend (Supabase Fns)	Env vars / Vault (optional later)	Used only if Edge Fns enabled

Policy: Never embed service keys in repo; rotate quarterly; audit logs of access.

9.6 Backups & Restore Playbook
9.6.1 Schedule
Component	Method	Freq	Retention
Supabase DB	Auto snapshot	Daily	7 → 30 days
Supabase Storage	S3 sync via Worker	Daily	30 days
Cloudflare KV	JSON dump to Supabase	Weekly	30 days
9.6.2 Recovery Procedure

Identify snapshot timestamp.

Restore into temporary DB (restore-YYYYMMDD).

Run integrity check (count(*), foreign key refs).

Promote to active if verified (< 2 h RTO).

Post-mortem recorded in audit_log (system action backup.restore).

9.7 Observability & Alerting
9.7.1 Error Telemetry
Frontend → Sentry (90 days)
Workers  → Sentry + CF Logs (30 days)
Supabase → Built-in logs (30 days)


Tagged by environment (dev/staging/prod)

Slack #dev-ops alerts for level≥“error”

Weekly digest of top errors emailed to engineering lead

9.7.2 Health Dashboards
Tool	Metric	Purpose
Sentry	Error rate / user impact	Detect front-end issues
Cloudflare Analytics	Requests + sub-ms timing	Edge performance
Supabase Metrics	Query latency + CPU load	DB health
Stripe Logs	Webhook success rate	Billing reliability
9.8 Security Operations
Domain	Control	Status
Auth	Supabase JWT + OAuth (Google/MS/GitHub)	Enforced
Transport	HTTPS + HSTS (preload)	All domains
CSP	Strict (allowlist Supabase, Stripe, Sentry)	Report-only → enforce
WAF	Cloudflare ruleset (block bots, SQLi/XSS)	Enabled
Data Access	RLS per agency_id	Verified
Key Rotation	Quarterly + on staff change	Policy doc
Vulnerability Scan	Monthly npm audit --production	CI job
9.9 Rate Limiting Implementation
9.9.1 Worker-Side Pattern
// pseudo-code
const key = `${agency}:${endpoint}:${minute}`
const hits = await KV.get(key) || 0
if (hits >= limit) return new Response("429 Too Many", {status:429})
await KV.put(key, hits+1, {expirationTtl:60})

9.9.2 Thresholds
Endpoint	Base	Pro	Agency
PSI manual	1/min	1/min	2/min
RUM ingest	50/min	250/min	1000/min
API reads	60/min	120/min	300/min
9.10 Disaster Recovery Matrix
Scenario	Impact	Response	RTO	Owner
Supabase Outage	API failures	Failover read-only cache (Workers KV)	2 h	Dev Ops
Cloudflare Worker failure	Cron missed	Auto retry next window	≤ 5 min	Dev Ops
Stripe webhook fail	Billing delay	Retry queue / manual reconcile	24 h	Finance
SES quota limit	Alerts delay	Switch to backup region (AWS us-west-2)	2 h	Support
Twilio region fail	SMS delay	Queue retry with backoff	1 h	Support
9.11 Performance Budgets
Metric	Target (P95)	Notes
Dashboard load	< 2 s	50 sites view
API latency	< 300 ms	Supabase → Worker RTT
PSI queue wait	< 5 min	from trigger to result
RUM ingest throughput	≥ 1 k req/s	with KV buffer
Alert delivery	< 30 s avg	SES/Twilio response
9.12 Cost Controls & Monitoring
Service	Budget Guard	Action
SES emails	Track usage_counters; cap per plan	Bill overages $0.01 ea
Twilio SMS	Usage logs + margin 2×	Auto-bill monthly
Supabase	Row count alerts	Archive old rows
Cloudflare	Free tier → Workers Paid	Upgrade if cron limit hit
Stripe fees	2.9 % + $0.30	Included in margin
Netlify	Free → Pro	Upgrade post launch

Monthly Ops report summarizes usage vs cost.

9.13 Maintenance Routines
Task	Freq	Owner
Dependency update (npm outdated)	Weekly	Dev Ops
Security audit (npm audit)	Monthly	Dev Ops
Backup restore test	Monthly	Dev Ops
Sentry review	Weekly	Engineering
Plan usage recalc	Monthly	Finance
Domain/SSL renew check	Quarterly	Infra
9.14 Pen-Test / Bug Bounty Roadmap
Phase	Activity	Timing
MVP + 3 mo	Internal OWASP checklist audit	Post-launch
MVP + 6 mo	External 3rd-party pen-test	Verify auth, RLS, Workers routes
MVP + 9 mo	Public bug bounty pilot	HackerOne Lite
9.15 Change Management Policy

All changes via Git PR + review (two-person rule).

CI checks must pass before merge.

Staging deployment mandatory 24 h before production.

Emergency hotfix allowed only by Admin with retro review required.

Change summary auto-posted to #dev-ops Slack channel.

9.16 ASCII Ops Topology Summary
                 ┌─────────────┐
                 │   Netlify   │
                 │  (Nuxt SSR) │
                 └──────┬──────┘
                        │
            https://app.websitemage.com
                        │
                        ▼
           ┌──────────────────────────┐
           │ Cloudflare Workers Edge │
           │  api / uptime / psi /   │
           │  rum / cleanup / cron   │
           └──────────┬──────────────┘
                      │
                      ▼
           ┌──────────────────────────┐
           │   Supabase (Postgres)    │
           │ Auth • RLS • Storage     │
           └──────────┬──────────────┘
                      │
        ┌─────────────┴─────────────┐
        │ Stripe │ SES │ Twilio │ S3│
        │Billing │Email│SMS    │Back│
        └───────────────────────────┘

10 BMAD Artifacts
10.1 Product Requirements Document (PRD) Summary
Section	Summary
Product Goal	Deliver a SaaS platform that lets agencies, freelancers, and site owners continuously monitor and improve live websites.
MVP Features	Uptime monitoring (GET checks + keyword), PageSpeed/Lighthouse analysis, Real User Monitoring, email/SMS alerts, dashboards + reports, Stripe billing.
User Segments	Agencies (multi-site, branded portal), Freelancers (few sites), Single-site owners (DIY monitoring).
Success KPIs	(1) Trial→Paid conversion ≥ 25 %, (2) > 1 000 sites onboarded in 6 months, (3) Average TTFB improvement ≥ 10 %.
Non-Goals (MVP)	Webhooks / Slack integration, SSO Enterprise tier, API keys for external use.
Constraints	Budget ≤ $200/mo infra at < 500 customers, serverless-only stack, US data residency.
10.2 Epics → Stories Map
EPIC 1 – Uptime Monitoring
Story ID	As a	I want to	So that	Acceptance
U1	Agency Admin	Add a site with domain and keyword	the system checks it every X minutes	Check added → appears active within 10 min cycle
U2	Worker Service	Retry 3× before marking down	avoid false positives	Incident opens only after 3 fails
U3	User	Receive email when site down/up	I can act quickly	1 “down” + 1 “recovery” email only
U4	Pro User	See SSL/DNS/status trend chart	monitor health	Charts show last 30 days
EPIC 2 – PageSpeed / Lighthouse (PSI)
Story	As a	I want to	So that	Acceptance
P1	User	Run manual scan (3–10 min debounce)	validate improvements	“Run Scan” disabled until TTL elapsed
P2	System	Schedule weekly/monthly auto scans	get consistent trend data	Next scan queued on time
P3	User	View historical scores & trends	see progress	Chart renders under 2 s
P4	Agency	Export CSV	share with client	Download ≤ 5 s
EPIC 3 – Real User Monitoring (RUM)
Story	As a	I want to	So that	Acceptance
R1	Dev	Add rum.js snippet	collect anon perf data	Beacon POST returns 204
R2	System	Sample per tier 25/50/100 %	control volume	Events ≈ target sample ratio
R3	Worker	Aggregate daily p75	report trends	rollup table populated nightly
R4	User	Filter by device & region	compare experience	Chart updates ≤ 1 s
EPIC 4 – Alerts & Notifications
Story	As a	I want to	So that	Acceptance
A1	Admin	Set alert contacts & quiet hours	control timing	Quiet hours respected
A2	System	Throttle per incident to 3 emails	avoid spam	Exactly 3 max
A3	Billing	Track email/SMS usage	bill overages	usage_counters updated
A4	User	Toggle SMS alerts	receive critical texts	Twilio delivery confirmed
EPIC 5 – Dashboard & Reporting
Story	As a	I want to	So that	Acceptance
D1	Agency	See all sites summary	spot issues fast	List loads ≤ 2 s
D2	Client Viewer	See read-only metrics	track performance	Cannot edit
D3	System	Generate monthly PDF	auto report	Email sent < 48 h after EOM
EPIC 6 – Billing & Trials
Story	As a	I want to	So that	Acceptance
B1	New User	Start free trial (1 site)	test value	Trial expires → Base auto enroll
B2	System	Prorate upgrades	fair billing	Stripe invoice accurate
B3	System	Pause services on unpaid	protect costs	Checks disabled
B4	Admin	View usage metrics	predict spend	Usage chart updates daily
EPIC 7 – Administration & Branding
Story	As a	I want to	So that	Acceptance
AD1	Agency Admin	Invite staff/clients	collaborate	Emails delivered via SES
AD2	Agency Admin	Set logo/colors/domain	white-label	Custom theme applied
AD3	System	Record audit entries	trace actions	All high-impact ops logged
10.3 Acceptance Test Matrix (Summary)
Area	Test ID	Criteria
Uptime	UT-01	Fail 3× → incident open; email sent once
PSI	PS-02	Cache hit within TTL returns same score
RUM	RU-03	DNT=1 → no network request
Alerts	AL-04	Cap reached → 429 from Worker
Billing	BL-05	Trial → Base conversion creates Stripe sub
Dashboard	DB-06	Client view cannot see other agency data
Security	SE-07	RLS query by non-member returns 0 rows
10.4 Risk Register (rolled-up)
ID	Risk	Probability	Impact	Mitigation
R-01	Supabase outage	M	H	Edge cache fallback + daily backups
R-02	SES cost spike	M	M	Email caps + overage billing
R-03	RUM data flood	L	H	Sampling + caps
R-04	Stripe webhook miss	M	M	Idempotent retry + reconcile job
R-05	Data privacy complaint	L	H	Cookie-less + DNT honor
R-06	False positives (Region)	M	L	Multi-region majority logic
R-07	Cron skip (Workers)	L	M	Retry on next interval
R-08	Developer turnover	M	M	Docs + BMAD process
10.5 Release Plan (Phased Roll-Out)
Phase 0 – Foundation (Weeks 1-4)

✅ Set up repos (monorepo + Turborepo + PNPM).

✅ Supabase schema migration v1.

✅ OAuth integration + RLS tests.

✅ Stripe catalog & checkout flow.
Deliverable: working auth + billing skeleton.

Phase 1 – Core Monitoring (Weeks 5-8)

Build Cloudflare Workers (uptime + psi).

Dashboard cards for Uptime & PSI.

Email alerts via SES.

RUM JS MVP collector.
Deliverable: live data streaming into dashboard.

Phase 2 – Reporting & Branding (Weeks 9-12)

PDF report generation.

Custom logo/colors (Agency tier).

Client read-only views.
Deliverable: end-to-end agency demo.

Phase 3 – Public Beta (Weeks 13-16)

Invite 10–15 agencies + freelancers.

Collect feedback on pricing & UX.

Tighten rate limits + caps based on load.
Deliverable: validated MVP with first subscriptions.

Phase 4 – GA Launch (Week 17 +)

Switch domains → app.websitemage.com.

Enable Stripe live keys.

Marketing site launch.

Announce publicly; begin support SLA tracking.

Phase 5 – Post-MVP (Next 6 Months)

Add Slack/Discord webhooks.

Add API keys per agency.

Implement pen-test + bug bounty.

Explore Enterprise tier (SSO + 1-min checks).

10.6 Milestone Tracking Template (Example)
Milestone	Target Date	Owner	Status	Notes
Auth + Billing complete	W4	Kyle	🟩 Done	Stripe sandbox ok
Uptime Worker running	W6	Dev 1	🟨 In progress	Cron interval debug
RUM collector	W8	Dev 2	⬜ Planned	Need CDN path
Report PDF	W10	Dev 1	⬜ Planned	use Puppeteer
Public Beta	W14	Team	⬜ Planned	Invite list ready
10.7 Definition of Done (DoD)

A feature is done when:

All acceptance tests pass locally and on staging.

Documentation in /docs updated.

Sentry shows no unhandled errors for 24 h post-deploy.

Supabase migration version tag matches release tag.

Audit log records the deploy event.

10.8 Release Governance Checklist

 PR review ≥ 2 approvals

 Lint / Tests green

 Version bumped in package.json

 Migration applied to staging

 Docs & Changelog updated

 Slack announce + tagged release in Git

 Post-deploy monitor for errors 24 h

10.9 Documentation Plan
Doc Type	Audience	Format	Owner
Setup Guide	Developers	Markdown / README	Engineering
Ops Runbook	Dev Ops	Notion / PDF	Ops Lead
API Docs	Public (future)	OpenAPI + Swagger UI	Engineering
User Guide	Agencies	Help Center Markdown	Support
Compliance Docs	Legal	PDF	Admin
10.10 Summary of BMAD Deliverables
Artifact	Status
Project Management Plan	✅ Complete
Architecture Diagram & Stack	✅ Complete
Data Model & Schema Design	✅ Complete
Feature Specs & Acceptance	✅ Complete
Infrastructure & Ops Guide	✅ Complete
BMAD Artifacts (you’re reading)	✅ Complete
Next Step: Cursor Integration	Pending