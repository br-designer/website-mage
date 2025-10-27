# Epic 4: Real User Monitoring (RUM)

**Status:** Draft  
**Version:** 1.0  
**Date:** 2025-10-26  
**Author:** Kyle Baker

---

## Epic Goal

Build a lightweight Real User Monitoring (RUM) system with client-side JavaScript snippet, beacon ingestion worker, bot detection, sampling logic, and dashboard visualization showing actual user performance metrics (Core Web Vitals, errors, page views).

## Epic Scope

This epic delivers real-world user analytics:

- Embeddable JavaScript snippet (<3KB minified + gzipped)
- Beacon ingestion worker with validation and rate limiting
- Bot detection and filtering
- Sampling logic based on tier (Base 1%, Pro 5%, Agency 10%)
- Daily aggregation for efficient querying
- Dashboard showing CWV distributions, error rates, and page views
- Privacy-focused design (no PII collection)

**Success Criteria:** Users can embed RUM snippet, collect real user metrics, view aggregated performance data, and filter by device/country/page with tier-appropriate sampling.

---

## Stories

### Story 4.1: RUM JavaScript Snippet

**As a** user,  
**I want** to embed a lightweight JavaScript snippet on my site,  
**so that** I can collect real user performance metrics.

#### Acceptance Criteria

1. RUM package created in `packages/rum-js` with TypeScript source and Rollup build
2. Snippet automatically collects Core Web Vitals: LCP, CLS, INP, FID (if available), FCP, TTFB
3. Snippet collects metadata: User Agent, Screen Resolution, Connection Type, Device Memory
4. Snippet does NOT collect PII: no cookies, no IP storage, no tracking across sites
5. Snippet uses browser Performance API: `web-vitals` library (3KB)
6. Snippet sends beacon on page visibility change or 5-second debounce (whichever first)
7. Beacon endpoint: `POST https://beacon.websitemage.com/v1/rum` with JSON payload
8. Snippet includes error handling: catches JavaScript errors and sends to separate error beacon
9. Build output: `rum.min.js` (<3KB gzipped), available via CDN: `https://cdn.websitemage.com/rum/v1/rum.min.js`
10. Snippet config passed via inline `<script>` tag: `window.WebsiteMageRUM = { siteId: 'uuid', sampleRate: 0.05 }`
11. Installation docs show copy-paste example with site-specific `siteId`

#### Technical Notes

**Snippet Source Structure:**

```
packages/rum-js/
├── src/
│   ├── index.ts              # Main entry, initialization
│   ├── collector.ts          # Core Web Vitals collection
│   ├── beacon.ts             # Beacon sending logic
│   ├── errors.ts             # Error tracking
│   └── utils.ts              # Device detection, sampling
├── rollup.config.js
├── package.json
└── README.md
```

**Core Implementation (index.ts):**

```typescript
import { onCLS, onINP, onLCP, onFCP, onTTFB } from 'web-vitals';

interface RUMConfig {
  siteId: string;
  sampleRate: number;
  beaconUrl?: string;
}

declare global {
  interface Window {
    WebsiteMageRUM?: RUMConfig;
  }
}

class WebsiteMageRUM {
  private config: RUMConfig;
  private metrics: Record<string, any> = {};
  private sessionId: string;

  constructor(config: RUMConfig) {
    this.config = {
      beaconUrl: 'https://beacon.websitemage.com/v1/rum',
      ...config,
    };
    this.sessionId = this.generateSessionId();

    // Apply sampling
    if (Math.random() > this.config.sampleRate) {
      return; // Don't initialize if not sampled
    }

    this.initCollectors();
    this.setupBeaconSending();
  }

  private initCollectors() {
    onLCP((metric) => (this.metrics.lcp = metric.value));
    onCLS((metric) => (this.metrics.cls = metric.value));
    onINP((metric) => (this.metrics.inp = metric.value));
    onFCP((metric) => (this.metrics.fcp = metric.value));
    onTTFB((metric) => (this.metrics.ttfb = metric.value));
  }

  private setupBeaconSending() {
    let debounceTimer: number;

    const sendBeacon = () => {
      this.send();
      clearTimeout(debounceTimer);
    };

    // Send on visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        sendBeacon();
      }
    });

    // Debounced send after 5 seconds
    debounceTimer = window.setTimeout(sendBeacon, 5000);
  }

  private send() {
    const payload = {
      site_id: this.config.siteId,
      session_id: this.sessionId,
      page_url: window.location.pathname,
      metrics: this.metrics,
      context: {
        user_agent: navigator.userAgent,
        screen: `${screen.width}x${screen.height}`,
        connection: (navigator as any).connection?.effectiveType,
        device_memory: (navigator as any).deviceMemory,
      },
      timestamp: Date.now(),
    };

    // Use sendBeacon for reliability
    if (navigator.sendBeacon) {
      navigator.sendBeacon(this.config.beaconUrl, JSON.stringify(payload));
    } else {
      // Fallback to fetch with keepalive
      fetch(this.config.beaconUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {}); // Silent fail
    }
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

// Auto-initialize
if (window.WebsiteMageRUM) {
  new WebsiteMageRUM(window.WebsiteMageRUM);
}
```

**Installation Example:**

```html
<!-- Add before closing </head> tag -->
<script>
  window.WebsiteMageRUM = {
    siteId: 'your-site-id-here',
    sampleRate: 0.05, // 5% sampling (Pro tier)
  };
</script>
<script src="https://cdn.websitemage.com/rum/v1/rum.min.js" async></script>
```

**Build Config (rollup.config.js):**

```javascript
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/rum.min.js',
    format: 'iife',
    name: 'WebsiteMageRUM',
  },
  plugins: [
    typescript(),
    terser({
      compress: {
        drop_console: true,
        passes: 2,
      },
    }),
  ],
};
```

---

### Story 4.2: Beacon Ingestion Worker

**As a** system worker,  
**I want** to receive and validate RUM beacons from client sites,  
**so that** I can store real user metrics.

#### Acceptance Criteria

1. RUM Ingestion Worker created in `packages/workers/rum` at subdomain: `beacon.websitemage.com`
2. Worker handles `POST /v1/rum` with JSON payload validation (Zod schema)
3. Worker validates `site_id` exists in `sites` table and is active (`deleted_at IS NULL`)
4. Worker validates required fields: `site_id`, `session_id`, `page_url`, `metrics`, `timestamp`
5. Worker enriches beacon with server-side data: `country` (from Cloudflare CF-IPCountry), `ingested_at`
6. Worker does NOT store IP address (privacy by design)
7. Worker detects suspicious patterns: duplicate session_id within 1 second, invalid timestamp (>5 min old)
8. Worker applies rate limiting per site: 10,000 beacons/hour (uses KV counter)
9. Worker inserts beacon into `rum_events` table with all fields
10. Worker returns 204 No Content on success, 400 on validation error, 429 on rate limit
11. Worker handles 1,000 req/sec burst without dropped beacons

#### Technical Notes

**Database Schema:**

```sql
CREATE TABLE public.rum_events (
  id BIGSERIAL PRIMARY KEY,
  agency_id UUID NOT NULL,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  page_url TEXT NOT NULL,
  lcp_ms INT,
  cls NUMERIC(6,3),
  inp_ms INT,
  fid_ms INT,
  fcp_ms INT,
  ttfb_ms INT,
  user_agent TEXT,
  screen TEXT,
  connection TEXT,
  device_memory INT,
  country TEXT,
  is_bot BOOLEAN NOT NULL DEFAULT false,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rum_site_time ON rum_events(site_id, ingested_at DESC);
CREATE INDEX idx_rum_agency_time ON rum_events(agency_id, ingested_at DESC);
CREATE INDEX idx_rum_bot ON rum_events(is_bot) WHERE is_bot = false;

-- Partition by month for scalability
-- (Optional, implement in Story 4.6 if needed)
```

**Worker Implementation:**

```typescript
// packages/workers/rum/src/index.ts
import { Hono } from 'hono';
import { z } from 'zod';

const BeaconSchema = z.object({
  site_id: z.string().uuid(),
  session_id: z.string().min(10).max(50),
  page_url: z.string().max(2048),
  metrics: z.object({
    lcp: z.number().optional(),
    cls: z.number().optional(),
    inp: z.number().optional(),
    fid: z.number().optional(),
    fcp: z.number().optional(),
    ttfb: z.number().optional(),
  }),
  context: z.object({
    user_agent: z.string().max(500),
    screen: z.string().optional(),
    connection: z.string().optional(),
    device_memory: z.number().optional(),
  }),
  timestamp: z.number(),
});

const app = new Hono();

app.post('/v1/rum', async (c) => {
  const startTime = Date.now();

  try {
    // Parse and validate
    const body = await c.req.json();
    const beacon = BeaconSchema.parse(body);

    // Validate timestamp (not older than 5 minutes)
    const age = Date.now() - beacon.timestamp;
    if (age > 5 * 60 * 1000) {
      return c.json({ error: 'Beacon too old' }, 400);
    }

    // Check rate limit
    const rateLimitKey = `rum:ratelimit:${beacon.site_id}:${Math.floor(Date.now() / 3600000)}`; // hourly
    const count = await c.env.RATE_LIMIT_KV.get(rateLimitKey);

    if (count && parseInt(count) >= 10000) {
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }

    // Validate site exists
    const { data: site } = await c.env.SUPABASE.from('sites')
      .select('id, agency_id')
      .eq('id', beacon.site_id)
      .is('deleted_at', null)
      .single();

    if (!site) {
      return c.json({ error: 'Invalid site_id' }, 400);
    }

    // Enrich with server data
    const country = c.req.header('CF-IPCountry') || 'Unknown';

    // Insert event
    await c.env.SUPABASE.from('rum_events').insert({
      agency_id: site.agency_id,
      site_id: beacon.site_id,
      session_id: beacon.session_id,
      page_url: beacon.page_url,
      lcp_ms: beacon.metrics.lcp,
      cls: beacon.metrics.cls,
      inp_ms: beacon.metrics.inp,
      fid_ms: beacon.metrics.fid,
      fcp_ms: beacon.metrics.fcp,
      ttfb_ms: beacon.metrics.ttfb,
      user_agent: beacon.context.user_agent,
      screen: beacon.context.screen,
      connection: beacon.context.connection,
      device_memory: beacon.context.device_memory,
      country,
      is_bot: false, // Will be updated by bot detection (Story 4.3)
    });

    // Increment rate limit counter
    await c.env.RATE_LIMIT_KV.put(rateLimitKey, String(parseInt(count || '0') + 1), {
      expirationTtl: 3600,
    });

    const duration = Date.now() - startTime;
    console.log(`Beacon ingested in ${duration}ms`);

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid payload', details: error.errors }, 400);
    }

    console.error('Beacon ingestion error:', error);
    return c.json({ error: 'Internal error' }, 500);
  }
});

export default app;
```

---

### Story 4.3: Bot Detection & Filtering

**As a** system,  
**I want** to detect and flag bot traffic in RUM data,  
**so that** users see accurate real-user metrics.

#### Acceptance Criteria

1. Bot detection Worker runs as part of ingestion or as separate scheduled job (every 5 minutes)
2. Detection logic checks User Agent against known bot patterns (regex list)
3. Detection flags beacons with suspicious patterns: LCP=0, CLS=0, TTFB<10ms, screen resolution 800x600
4. Bot list includes: Googlebot, Bingbot, crawler, spider, bot, monitoring services (UptimeRobot, Pingdom)
5. Detected bots have `is_bot` field set to `true` in `rum_events` table
6. Separate table `rum_bot_events` stores all bot traffic for analysis (optional, lightweight)
7. Dashboard filters exclude bot traffic by default (`WHERE is_bot = false`)
8. User can toggle "Show bot traffic" filter to include bots in analysis
9. Bot detection rate >95% accuracy (manual validation with 100-sample test set)

#### Technical Notes

**Bot Detection Patterns:**

```typescript
const BOT_PATTERNS = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /scraper/i,
  /curl/i,
  /wget/i,
  /python-requests/i,
  /lighthouse/i,
  /pagespeed/i,
  /uptimerobot/i,
  /pingdom/i,
  /headless/i,
  /phantom/i,
  /selenium/i,
];

export function isBotUserAgent(userAgent: string): boolean {
  return BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

export function isSuspiciousMetrics(metrics: any): boolean {
  // All metrics zero or near-zero
  if (metrics.lcp === 0 && metrics.cls === 0 && metrics.ttfb < 10) {
    return true;
  }

  // Unrealistic perfect metrics
  if (metrics.lcp < 100 && metrics.cls < 0.001 && metrics.inp < 10) {
    return true;
  }

  return false;
}

export function isSuspiciousScreen(screen: string): boolean {
  const commonBotResolutions = ['800x600', '1024x768', '1920x1080'];
  return commonBotResolutions.includes(screen);
}
```

**Inline Detection (add to ingestion worker):**

```typescript
// In beacon ingestion
const isBot =
  isBotUserAgent(beacon.context.user_agent) ||
  isSuspiciousMetrics(beacon.metrics) ||
  isSuspiciousScreen(beacon.context.screen);

await c.env.SUPABASE.from('rum_events').insert({
  // ... other fields
  is_bot: isBot,
});
```

**Bot Events Table (optional):**

```sql
CREATE TABLE public.rum_bot_events (
  id BIGSERIAL PRIMARY KEY,
  site_id UUID NOT NULL,
  user_agent TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### Story 4.4: Sampling Logic by Tier

**As a** system,  
**I want** to apply tier-based sampling rates to RUM data collection,  
**so that** infrastructure costs scale with subscription tiers.

#### Acceptance Criteria

1. Sampling rate configured in snippet based on agency tier: Base 1%, Pro 5%, Agency 10%
2. Dashboard displays snippet installation instructions with pre-configured `sampleRate` for user's tier
3. Snippet performs client-side sampling: `if (Math.random() > sampleRate) return`
4. Server-side validation: Worker checks agency tier and rejects beacons if over daily cap
5. Daily caps: Base 10,000 events/day, Pro 50,000/day, Agency 100,000/day
6. Cap enforcement uses `usage_counters` table with `metric='rum_events'`
7. Dashboard shows sampling rate and current usage: "1,234 / 10,000 events today (12%)"
8. Extrapolation logic: dashboard multiplies metrics by `1/sampleRate` for estimated totals
9. Upgrade prompt shown when 80% of daily cap reached
10. Grace period: 10% overage allowed before hard blocking (Base: 11k, Pro: 55k, Agency: 110k)

#### Technical Notes

**Sampling Constants:**

```typescript
export const RUM_SAMPLING = {
  base: { rate: 0.01, dailyCap: 10000 },
  pro: { rate: 0.05, dailyCap: 50000 },
  agency: { rate: 0.1, dailyCap: 100000 },
};

export function getGraceCap(tier: string): number {
  return Math.floor(RUM_SAMPLING[tier].dailyCap * 1.1);
}
```

**Server-Side Cap Enforcement:**

```typescript
// In beacon ingestion worker
const agency = await getAgency(c.env, site.agency_id);
const config = RUM_SAMPLING[agency.tier];

const today = new Date().toISOString().split('T')[0];
const { data: usage } = await c.env.SUPABASE.from('usage_counters')
  .select('used')
  .eq('agency_id', agency.id)
  .eq('metric', 'rum_events')
  .eq('month', today)
  .single();

const graceCap = getGraceCap(agency.tier);

if (usage && usage.used >= graceCap) {
  return c.json(
    {
      error: 'Daily RUM cap exceeded',
      cap: config.dailyCap,
      used: usage.used,
    },
    429
  );
}

// ... insert beacon ...

// Increment usage
await c.env.SUPABASE.from('usage_counters').upsert({
  agency_id: agency.id,
  metric: 'rum_events',
  month: today,
  used: (usage?.used || 0) + 1,
  cap: config.dailyCap,
});
```

**Dashboard Component:**

```vue
<template>
  <div class="rum-usage">
    <div class="usage-stats">
      <h4>RUM Usage Today</h4>
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: `${usagePercent}%` }"
          :class="{ warning: usagePercent > 80 }"
        ></div>
      </div>
      <p>
        {{ usage.used.toLocaleString() }} / {{ usage.cap.toLocaleString() }} events ({{
          usagePercent
        }}%)
      </p>
      <p class="sampling-note">Sampling at {{ samplingRate * 100 }}% ({{ tier }} tier)</p>
    </div>

    <div v-if="usagePercent > 80" class="upgrade-prompt">
      <p>⚠️ You're approaching your daily RUM limit</p>
      <button @click="showUpgrade">Upgrade Plan</button>
    </div>
  </div>
</template>
```

---

### Story 4.5: Daily Aggregation for Performance

**As a** system,  
**I want** to pre-aggregate RUM data daily by dimensions,  
**so that** dashboard queries are fast (<500ms) even with millions of events.

#### Acceptance Criteria

1. Aggregation Worker runs daily at 2 AM UTC
2. Worker aggregates previous day's `rum_events` into `rum_daily_agg` table
3. Aggregation dimensions: `site_id`, `page_url`, `device_type` (mobile/desktop/tablet), `country`
4. Aggregated metrics: count, p50/p75/p95 for each CWV metric, avg values
5. Device type inferred from User Agent using `ua-parser-js` library
6. Aggregation query uses `PERCENTILE_CONT()` for accurate percentiles
7. Worker processes 1 million events in <60 seconds
8. Dashboard queries `rum_daily_agg` for date ranges >7 days, raw `rum_events` for <7 days
9. Aggregation includes error rate calculation (if error tracking implemented in Story 4.6)
10. Old `rum_events` data can be archived/deleted after aggregation (retention policy)

#### Technical Notes

**Aggregation Table Schema:**

```sql
CREATE TABLE public.rum_daily_agg (
  id BIGSERIAL PRIMARY KEY,
  agency_id UUID NOT NULL,
  site_id UUID NOT NULL,
  date DATE NOT NULL,
  page_url TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK (device_type IN ('mobile', 'desktop', 'tablet', 'unknown')),
  country TEXT NOT NULL,
  event_count INT NOT NULL,
  lcp_p50 INT,
  lcp_p75 INT,
  lcp_p95 INT,
  cls_p50 NUMERIC(6,3),
  cls_p75 NUMERIC(6,3),
  cls_p95 NUMERIC(6,3),
  inp_p50 INT,
  inp_p75 INT,
  inp_p95 INT,
  fcp_avg INT,
  ttfb_avg INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_rum_agg_unique ON rum_daily_agg(site_id, date, page_url, device_type, country);
CREATE INDEX idx_rum_agg_site_date ON rum_daily_agg(site_id, date DESC);
```

**Aggregation Worker:**

```typescript
// packages/workers/aggregation/src/rum-aggregation.ts
export async function aggregateRUMData(env: Env) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  console.log(`Aggregating RUM data for ${dateStr}`);

  // Query raw events
  const { data: events } = await env.SUPABASE.from('rum_events')
    .select('*')
    .gte('ingested_at', `${dateStr}T00:00:00Z`)
    .lt('ingested_at', `${dateStr}T23:59:59Z`)
    .eq('is_bot', false);

  if (!events || events.length === 0) {
    console.log('No events to aggregate');
    return;
  }

  // Group by dimensions
  const groups = new Map<string, any[]>();

  for (const event of events) {
    const deviceType = detectDeviceType(event.user_agent);
    const key = `${event.site_id}|${event.page_url}|${deviceType}|${event.country}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(event);
  }

  // Calculate aggregates for each group
  const aggregates = [];

  for (const [key, groupEvents] of groups) {
    const [site_id, page_url, device_type, country] = key.split('|');

    aggregates.push({
      agency_id: groupEvents[0].agency_id,
      site_id,
      date: dateStr,
      page_url,
      device_type,
      country,
      event_count: groupEvents.length,
      lcp_p50: percentile(groupEvents.map((e) => e.lcp_ms).filter(Boolean), 0.5),
      lcp_p75: percentile(groupEvents.map((e) => e.lcp_ms).filter(Boolean), 0.75),
      lcp_p95: percentile(groupEvents.map((e) => e.lcp_ms).filter(Boolean), 0.95),
      cls_p50: percentile(groupEvents.map((e) => e.cls).filter(Boolean), 0.5),
      cls_p75: percentile(groupEvents.map((e) => e.cls).filter(Boolean), 0.75),
      cls_p95: percentile(groupEvents.map((e) => e.cls).filter(Boolean), 0.95),
      inp_p50: percentile(groupEvents.map((e) => e.inp_ms).filter(Boolean), 0.5),
      inp_p75: percentile(groupEvents.map((e) => e.inp_ms).filter(Boolean), 0.75),
      inp_p95: percentile(groupEvents.map((e) => e.inp_ms).filter(Boolean), 0.95),
      fcp_avg: avg(groupEvents.map((e) => e.fcp_ms).filter(Boolean)),
      ttfb_avg: avg(groupEvents.map((e) => e.ttfb_ms).filter(Boolean)),
    });
  }

  // Bulk insert
  const { error } = await env.SUPABASE.from('rum_daily_agg').upsert(aggregates, {
    onConflict: 'site_id,date,page_url,device_type,country',
  });

  if (error) {
    console.error('Aggregation insert error:', error);
  } else {
    console.log(`Aggregated ${events.length} events into ${aggregates.length} groups`);
  }
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = values.sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * p) - 1;
  return sorted[index];
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function detectDeviceType(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone|ipod/.test(ua)) return 'mobile';
  if (/tablet|ipad/.test(ua)) return 'tablet';
  return 'desktop';
}
```

---

### Story 4.6: RUM Dashboard Visualization

**As a** user,  
**I want** to view real user Core Web Vitals distributions and page view analytics,  
**so that** I understand actual user experience on my site.

#### Acceptance Criteria

1. Dashboard "Real User Monitoring" page displays CWV summary cards: LCP, CLS, INP with p75 values
2. CWV cards color-coded: Green (Good), Yellow (Needs Improvement), Red (Poor) per Web Vitals thresholds
3. Histogram charts show distribution for each metric (e.g., LCP: 0-2.5s Good, 2.5-4s Medium, 4s+ Poor)
4. Time range selector: Last 24h, 7d, 30d (24h uses raw data, 7d+ uses aggregated data)
5. Filters: Device Type (mobile/desktop/tablet), Country (top 10 + Other), Page URL (dropdown)
6. Page views table shows: URL, Sessions, Avg LCP, Avg CLS, Avg INP, sorted by sessions desc
7. Geographic map shows CWV p75 by country (heatmap visualization)
8. Session timeline view (drill-down): shows individual user sessions with metrics and navigation flow
9. Empty state: "Install RUM snippet to start collecting data" with installation instructions
10. All queries complete in <500ms for 30-day ranges

#### Technical Notes

**Dashboard Layout:**

```vue
<template>
  <div class="rum-dashboard">
    <div class="controls">
      <TimeRangeSelector v-model="timeRange" />
      <DeviceFilter v-model="deviceType" />
      <CountryFilter v-model="country" />
      <PageUrlFilter v-model="pageUrl" :siteId="siteId" />
    </div>

    <div class="cwv-summary">
      <CWVCard
        metric="LCP"
        :value="cwvData.lcp_p75"
        :threshold="{ good: 2500, poor: 4000 }"
        unit="ms"
      />
      <CWVCard
        metric="CLS"
        :value="cwvData.cls_p75"
        :threshold="{ good: 0.1, poor: 0.25 }"
        unit=""
      />
      <CWVCard
        metric="INP"
        :value="cwvData.inp_p75"
        :threshold="{ good: 200, poor: 500 }"
        unit="ms"
      />
    </div>

    <div class="charts">
      <CWVHistogram
        metric="LCP"
        :data="cwvDistributions.lcp"
        :threshold="{ good: 2500, poor: 4000 }"
      />
      <CWVHistogram
        metric="CLS"
        :data="cwvDistributions.cls"
        :threshold="{ good: 0.1, poor: 0.25 }"
      />
      <CWVHistogram
        metric="INP"
        :data="cwvDistributions.inp"
        :threshold="{ good: 200, poor: 500 }"
      />
    </div>

    <div class="page-views">
      <h3>Top Pages</h3>
      <table>
        <thead>
          <tr>
            <th>Page URL</th>
            <th>Sessions</th>
            <th>Avg LCP</th>
            <th>Avg CLS</th>
            <th>Avg INP</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="page in topPages" :key="page.url">
            <td>{{ page.url }}</td>
            <td>{{ page.sessions.toLocaleString() }}</td>
            <td><MetricBadge :value="page.avg_lcp" metric="lcp" /></td>
            <td><MetricBadge :value="page.avg_cls" metric="cls" /></td>
            <td><MetricBadge :value="page.avg_inp" metric="inp" /></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="geo-map">
      <h3>Performance by Country</h3>
      <ChoroplethMap :data="geoData" metric="lcp_p75" />
    </div>
  </div>
</template>

<script setup>
const props = defineProps<{ siteId: string }>()

const timeRange = ref('7d')
const deviceType = ref('all')
const country = ref('all')
const pageUrl = ref('all')

const { data: cwvData } = await useFetch(`/api/rum/${props.siteId}/cwv`, {
  query: computed(() => ({
    range: timeRange.value,
    device: deviceType.value,
    country: country.value,
    page: pageUrl.value
  }))
})

const { data: topPages } = await useFetch(`/api/rum/${props.siteId}/pages`, {
  query: computed(() => ({ range: timeRange.value }))
})

const { data: geoData } = await useFetch(`/api/rum/${props.siteId}/geo`, {
  query: computed(() => ({ range: timeRange.value }))
})
</script>
```

**API Endpoint for CWV Data:**

```typescript
// packages/workers/api/src/routes/rum.ts
app.get('/:siteId/cwv', async (c) => {
  const { siteId } = c.req.param();
  const { range, device, country, page } = c.req.query();

  const useAggregated = ['7d', '30d'].includes(range);

  let query;
  if (useAggregated) {
    query = c.env.SUPABASE.from('rum_daily_agg')
      .select('lcp_p75, cls_p75, inp_p75')
      .eq('site_id', siteId);
  } else {
    query = c.env.SUPABASE.from('rum_events')
      .select('lcp_ms, cls, inp_ms')
      .eq('site_id', siteId)
      .eq('is_bot', false);
  }

  // Apply filters
  if (device !== 'all') {
    query = query.eq('device_type', device);
  }
  if (country !== 'all') {
    query = query.eq('country', country);
  }
  if (page !== 'all') {
    query = query.eq('page_url', page);
  }

  // Apply time range
  const rangeStart = getRangeStart(range);
  query = query.gte(useAggregated ? 'date' : 'ingested_at', rangeStart);

  const { data } = await query;

  // Calculate p75 (if using raw events)
  const result = useAggregated ? calculateAggregateP75(data) : calculateRawP75(data);

  return c.json(result);
});
```

---

## Epic Completion Checklist

- [ ] All 6 stories completed and tested
- [ ] RUM snippet created, built, and hosted on CDN
- [ ] Beacon ingestion working with <100ms p95 latency
- [ ] Bot detection filtering >95% of bot traffic
- [ ] Sampling and caps enforced per tier
- [ ] Daily aggregation running successfully
- [ ] Dashboard displaying real user metrics
- [ ] End-to-end RUM workflow validated
- [ ] Privacy compliance verified (no PII stored)
- [ ] Ready for Epic 5: Alerts & Notifications

---

## Dependencies & Prerequisites

**Requires Epics 1, 2, 3 Completion:**

- Sites infrastructure
- Tier management
- Dashboard framework

**New Services Needed:**

- CDN for hosting RUM snippet (Cloudflare R2 + Workers)
- Subdomain: `beacon.websitemage.com`

**After Epic 4 Completion:**

- Real user monitoring operational
- Complete picture of site health (synthetic + real user data)
- Foundation for proactive performance insights
