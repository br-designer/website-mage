# Epic 3: PageSpeed / Lighthouse Analysis

**Status:** Draft  
**Version:** 1.0  
**Date:** 2025-10-26  
**Author:** Kyle Baker

---

## Epic Goal

Integrate Google PageSpeed Insights API to perform mobile and desktop Lighthouse audits, store historical scores and Core Web Vitals, enable manual scans with rate limiting, and visualize trends with opportunities list on the dashboard.

## Epic Scope

This epic delivers performance monitoring capabilities:

- Google PageSpeed Insights (PSI) API integration
- Automated scheduled scans (monthly for Base, weekly for Pro/Agency)
- Manual on-demand scans with tier-based rate limiting
- Historical trending with retention policies
- Lighthouse opportunities display with recommendations
- Optional screenshot comparison feature

**Success Criteria:** Users can trigger PSI scans, view performance scores and Core Web Vitals trends, and receive actionable optimization recommendations.

---

## Stories

### Story 3.1: PSI API Integration & Scheduled Scans

**As a** system worker,  
**I want** to call Google PageSpeed Insights API on a schedule to scan monitored sites,  
**so that** users receive regular performance reports.

#### Acceptance Criteria

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

#### Technical Notes

**Database Schema:**

```sql
CREATE TABLE public.psi_results (
  id BIGSERIAL PRIMARY KEY,
  agency_id UUID NOT NULL,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  device TEXT NOT NULL CHECK (device IN ('mobile', 'desktop')),
  lighthouse_version TEXT,
  performance_score INT,
  lcp_ms INT,
  cls NUMERIC(6,3),
  inp_ms INT,
  fid_ms INT,
  fcp_ms INT,
  opportunities JSONB,
  screenshot_url TEXT
);

CREATE INDEX idx_psi_site_time ON psi_results(site_id, scanned_at DESC);
CREATE INDEX idx_psi_agency_time ON psi_results(agency_id, scanned_at DESC);

-- Materialized view for latest scores
CREATE MATERIALIZED VIEW public.psi_latest AS
  SELECT DISTINCT ON (site_id, device)
    site_id, device, scanned_at, performance_score,
    lcp_ms, cls, inp_ms, fid_ms, fcp_ms, lighthouse_version
  FROM psi_results
  ORDER BY site_id, device, scanned_at DESC;

-- Trigger to refresh on insert
CREATE OR REPLACE FUNCTION refresh_psi_latest()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.psi_latest;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_refresh_psi_latest
AFTER INSERT ON psi_results
FOR EACH STATEMENT EXECUTE FUNCTION refresh_psi_latest();
```

**Worker Structure:**

```typescript
// packages/workers/psi/src/index.ts
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const sites = await fetchEligibleSites(env);

    for (const site of sites) {
      try {
        // Scan mobile
        const mobileResult = await scanWithPSI(site.domain, 'mobile', env.PSI_API_KEY);
        await storePSIResult(env, site, mobileResult, 'mobile');

        // Scan desktop
        const desktopResult = await scanWithPSI(site.domain, 'desktop', env.PSI_API_KEY);
        await storePSIResult(env, site, desktopResult, 'desktop');

        // Rate limit: wait 2s between sites
        await sleep(2000);
      } catch (error) {
        console.error(`PSI scan failed for ${site.domain}:`, error);
        // Continue with next site
      }
    }
  },
};

async function scanWithPSI(url: string, strategy: 'mobile' | 'desktop', apiKey: string) {
  const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&category=performance&key=${apiKey}`;

  const response = await fetch(psiUrl);

  if (!response.ok) {
    throw new Error(`PSI API error: ${response.status}`);
  }

  const data = await response.json();

  return {
    lighthouse_version: data.lighthouseResult.lighthouseVersion,
    performance_score: Math.round(data.lighthouseResult.categories.performance.score * 100),
    lcp_ms: data.lighthouseResult.audits['largest-contentful-paint']?.numericValue,
    cls: data.lighthouseResult.audits['cumulative-layout-shift']?.numericValue,
    inp_ms: data.lighthouseResult.audits['interaction-to-next-paint']?.numericValue,
    fcp_ms: data.lighthouseResult.audits['first-contentful-paint']?.numericValue,
    opportunities: extractOpportunities(data.lighthouseResult.audits),
  };
}
```

**Scan Schedule Logic:**

```typescript
const SCAN_INTERVALS = {
  base: 30 * 24 * 60 * 60 * 1000, // 30 days
  pro: 7 * 24 * 60 * 60 * 1000, // 7 days
  agency: 7 * 24 * 60 * 60 * 1000, // 7 days
};

async function fetchEligibleSites(env: Env) {
  const sites = await supabase
    .from('sites')
    .select('*, agencies(tier), psi_results(scanned_at)')
    .is('deleted_at', null);

  return sites.filter((site) => {
    const lastScan = site.psi_results[0]?.scanned_at;
    if (!lastScan) return true; // Never scanned

    const interval = SCAN_INTERVALS[site.agencies.tier];
    const nextScanDue = new Date(lastScan).getTime() + interval;

    return Date.now() >= nextScanDue;
  });
}
```

---

### Story 3.2: Manual PSI Scan with Rate Limiting

**As a** user,  
**I want** to trigger a manual PageSpeed scan for my site,  
**so that** I can immediately validate performance changes after deployment.

#### Acceptance Criteria

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

#### Technical Notes

**Rate Limiting Constants:**

```typescript
export const PSI_RATE_LIMITS = {
  base: { intervalMs: 10 * 60 * 1000, dailyCap: 10 },
  pro: { intervalMs: 5 * 60 * 1000, dailyCap: 25 },
  agency: { intervalMs: 3 * 60 * 1000, dailyCap: 50 },
};
```

**API Endpoint:**

```typescript
// packages/workers/api/src/routes/psi.ts
import { Hono } from 'hono';

const psi = new Hono();

psi.post('/scan', async (c) => {
  const { site_id, device } = await c.req.json();
  const agency = await getAgencyForSite(c.env, site_id);

  // Check rate limit (KV)
  const rateLimitKey = `psi:ratelimit:${agency.id}:${Math.floor(Date.now() / 60000)}`;
  const count = await c.env.RATE_LIMIT_KV.get(rateLimitKey);

  const limit = PSI_RATE_LIMITS[agency.tier];

  if (count && parseInt(count) >= 1) {
    return c.json(
      {
        error: 'Rate limit exceeded',
        retryAfter: limit.intervalMs / 1000,
      },
      429
    );
  }

  // Check daily cap
  const today = new Date().toISOString().split('T')[0];
  const { data: usage } = await supabase
    .from('usage_counters')
    .select('used, cap')
    .eq('agency_id', agency.id)
    .eq('metric', 'psi')
    .eq('month', today)
    .single();

  if (usage && usage.used >= limit.dailyCap) {
    return c.json({ error: 'Daily cap reached' }, 429);
  }

  // Check cache
  const cached = await checkCache(c.env, site_id, device, limit.intervalMs);
  if (cached) {
    return c.json({ status: 'cached', result: cached });
  }

  // Enqueue scan
  const jobId = crypto.randomUUID();
  await enqueueScan(c.env, { jobId, site_id, device });

  // Increment counters
  await c.env.RATE_LIMIT_KV.put(rateLimitKey, '1', { expirationTtl: limit.intervalMs / 1000 });
  await incrementUsage(c.env, agency.id, 'psi');

  return c.json(
    {
      status: 'queued',
      jobId,
      estimatedCompletionSeconds: 30,
    },
    202
  );
});

psi.get('/status/:jobId', async (c) => {
  const jobId = c.req.param('jobId');
  const job = await getJobStatus(c.env, jobId);

  if (!job) {
    return c.json({ error: 'Job not found' }, 404);
  }

  return c.json(job);
});

export default psi;
```

**Frontend Component:**

```vue
<template>
  <div class="psi-scan">
    <button @click="triggerScan" :disabled="isScanning || countdown > 0" class="btn-primary">
      <span v-if="countdown > 0">Next scan in {{ formatCountdown(countdown) }}</span>
      <span v-else-if="isScanning">Scanning...</span>
      <span v-else>Run Scan</span>
    </button>

    <div v-if="isScanning" class="progress">Scanning... {{ progress }}%</div>
  </div>
</template>

<script setup>
const isScanning = ref(false)
const countdown = ref(0)
const jobId = ref<string>()

async function triggerScan() {
  isScanning.value = true

  try {
    const response = await $fetch('/api/psi/scan', {
      method: 'POST',
      body: { site_id: props.siteId, device: 'both' }
    })

    if (response.status === 'cached') {
      // Show cached result
      emit('scanComplete', response.result)
      isScanning.value = false
      return
    }

    jobId.value = response.jobId

    // Poll for completion
    const interval = setInterval(async () => {
      const status = await $fetch(`/api/psi/status/${jobId.value}`)

      if (status.status === 'completed') {
        clearInterval(interval)
        emit('scanComplete', status.result)
        isScanning.value = false
        startCountdown()
      }
    }, 5000)
  } catch (error) {
    if (error.statusCode === 429) {
      countdown.value = error.data.retryAfter
      startCountdown()
    }
    isScanning.value = false
  }
}

function startCountdown() {
  const timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(timer)
    }
  }, 1000)
}
</script>
```

---

### Story 3.3: Historical PSI Trends & Retention

**As a** user,  
**I want** to view historical PageSpeed scores and Core Web Vitals trends,  
**so that** I can track performance improvements or regressions over time.

#### Acceptance Criteria

1. Site detail page displays PSI trend chart: line graph with dual Y-axes (Performance Score 0-100, Metric ms)
2. Chart includes toggleable series: Performance Score, LCP, CLS (×1000 for visibility), INP, FCP
3. Chart X-axis shows time range: Last 7 days (hourly resolution), Last 30 days (daily), Last 90 days (weekly)
4. Time range selector above chart: "7D | 30D | 90D | All" (All shows tier retention: Base 30d, Pro 90d, Agency 180d)
5. Chart data fetched from `psi_results` table filtered by `site_id` and `scanned_at` range
6. Device filter toggle: "Mobile | Desktop | Both" (default: both overlaid)
7. Tooltip on hover shows exact values and scan timestamp
8. Empty state: "No scans yet. Run your first scan to see trends."
9. Data retention enforced by cleanup Worker: Base 30 days, Pro 90 days, Agency 180 days
10. Chart renders in <2 seconds for 90 days of data

#### Technical Notes

**Chart Component:**

```vue
<template>
  <div class="psi-trends">
    <div class="controls">
      <div class="time-range">
        <button
          v-for="range in timeRanges"
          :key="range.value"
          @click="selectedRange = range.value"
          :class="{ active: selectedRange === range.value }"
        >
          {{ range.label }}
        </button>
      </div>

      <div class="device-filter">
        <button
          v-for="device in devices"
          :key="device"
          @click="toggleDevice(device)"
          :class="{ active: selectedDevices.includes(device) }"
        >
          {{ device }}
        </button>
      </div>
    </div>

    <canvas ref="chartCanvas"></canvas>
  </div>
</template>

<script setup>
import { Chart } from 'chart.js/auto'

const props = defineProps<{ siteId: string }>()

const selectedRange = ref('30D')
const selectedDevices = ref(['mobile', 'desktop'])

const timeRanges = [
  { label: '7D', value: '7D' },
  { label: '30D', value: '30D' },
  { label: '90D', value: '90D' },
  { label: 'All', value: 'all' }
]

const { data: trendsData, refresh } = await useFetch(
  `/api/sites/${props.siteId}/psi-trends`,
  {
    query: computed(() => ({
      range: selectedRange.value,
      devices: selectedDevices.value.join(',')
    }))
  }
)

watch([selectedRange, selectedDevices], () => refresh())

const chartCanvas = ref<HTMLCanvasElement>()
let chart: Chart

onMounted(() => {
  if (!chartCanvas.value || !trendsData.value) return

  chart = new Chart(chartCanvas.value, {
    type: 'line',
    data: {
      labels: trendsData.value.labels,
      datasets: [
        {
          label: 'Performance Score',
          data: trendsData.value.performanceScore,
          borderColor: 'rgb(139, 92, 246)',
          yAxisID: 'y'
        },
        {
          label: 'LCP (ms)',
          data: trendsData.value.lcp,
          borderColor: 'rgb(59, 130, 246)',
          yAxisID: 'y1'
        },
        {
          label: 'CLS (×1000)',
          data: trendsData.value.cls.map(v => v * 1000),
          borderColor: 'rgb(234, 179, 8)',
          yAxisID: 'y1'
        },
        {
          label: 'INP (ms)',
          data: trendsData.value.inp,
          borderColor: 'rgb(239, 68, 68)',
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      interaction: {
        mode: 'index',
        intersect: false
      },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          min: 0,
          max: 100,
          title: { display: true, text: 'Performance Score' }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: { display: true, text: 'Metrics (ms)' }
        }
      }
    }
  })
})
</script>
```

**Data Cleanup Worker:**

```typescript
// packages/workers/cleanup/src/psi-cleanup.ts
export async function cleanupPSIData(env: Env) {
  const agencies = await supabase.from('agencies').select('id, tier');

  for (const agency of agencies) {
    const retentionDays = {
      base: 30,
      pro: 90,
      agency: 180,
    }[agency.tier];

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const { count } = await supabase
      .from('psi_results')
      .delete()
      .eq('agency_id', agency.id)
      .lt('scanned_at', cutoffDate.toISOString());

    console.log(`Deleted ${count} old PSI results for agency ${agency.id}`);
  }
}
```

---

### Story 3.4: Lighthouse Opportunities Display

**As a** user,  
**I want** to see Lighthouse improvement opportunities with estimated savings,  
**so that** I know what optimizations to prioritize.

#### Acceptance Criteria

1. Site detail page displays "Opportunities" section below PSI chart
2. Section shows top 5 opportunities from latest scan, sorted by estimated savings (ms or bytes)
3. Each opportunity displays: Title, Description (1-2 sentences), Estimated Savings, Audit Score (0-100)
4. Opportunities stored as JSON array in `psi_results.opportunities` field
5. Clicking opportunity expands accordion with detailed explanation and affected resource list
6. Link to Lighthouse documentation included per opportunity: "Learn more →"
7. Device-specific opportunities displayed when device filter active (mobile vs desktop)
8. Empty state: "No major opportunities detected. Great job!"
9. Opportunities data comes from PSI API response: `lighthouseResult.audits[opportunity_id]`

#### Technical Notes

**Opportunities Extraction:**

```typescript
function extractOpportunities(audits: any) {
  const opportunityIds = [
    'render-blocking-resources',
    'unused-css-rules',
    'unused-javascript',
    'modern-image-formats',
    'offscreen-images',
    'unminified-css',
    'unminified-javascript',
    'efficient-animated-content',
    'duplicated-javascript',
    'legacy-javascript',
  ];

  return opportunityIds
    .map((id) => {
      const audit = audits[id];
      if (!audit || audit.score === 1) return null;

      return {
        id,
        title: audit.title,
        description: audit.description,
        score: audit.score,
        numericValue: audit.numericValue,
        numericUnit: audit.numericUnit,
        displayValue: audit.displayValue,
        details: audit.details?.items || [],
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.numericValue - a.numericValue)
    .slice(0, 5);
}
```

**Opportunities Component:**

```vue
<template>
  <div class="opportunities">
    <h3>Optimization Opportunities</h3>

    <div v-if="opportunities.length === 0" class="empty-state">
      <p>No major opportunities detected. Great job! 🎉</p>
    </div>

    <div v-else class="opportunity-list">
      <div v-for="opp in opportunities" :key="opp.id" class="opportunity-card">
        <div class="opportunity-header" @click="toggleExpanded(opp.id)">
          <div class="opportunity-info">
            <h4>{{ opp.title }}</h4>
            <p class="description">{{ opp.description }}</p>
          </div>
          <div class="opportunity-metrics">
            <div class="savings">
              <span class="label">Potential Savings</span>
              <span class="value">{{ opp.displayValue }}</span>
            </div>
            <ScoreBadge :score="opp.score" />
          </div>
        </div>

        <div v-if="expanded === opp.id" class="opportunity-details">
          <div v-if="opp.details.length > 0" class="affected-resources">
            <h5>Affected Resources:</h5>
            <ul>
              <li v-for="item in opp.details" :key="item.url">
                {{ item.url }}
                <span v-if="item.wastedBytes"> ({{ formatBytes(item.wastedBytes) }}) </span>
              </li>
            </ul>
          </div>

          <a
            :href="`https://developer.chrome.com/docs/lighthouse/performance/${opp.id}/`"
            target="_blank"
            class="learn-more"
          >
            Learn more →
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps<{ opportunities: Array<any> }>()

const expanded = ref<string | null>(null)

function toggleExpanded(id: string) {
  expanded.value = expanded.value === id ? null : id
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>
```

---

### Story 3.5: Screenshot Comparison (Optional Enhancement)

**As a** user,  
**I want** to see before/after screenshots from Lighthouse scans,  
**so that** I can visually confirm rendering issues or improvements.

#### Acceptance Criteria

1. Worker extracts screenshot URL from PSI API response: `lighthouseResult.audits['final-screenshot'].details.data`
2. Worker uploads screenshot to Cloudflare R2 bucket: `psi-screenshots/{site_id}/{timestamp}_{device}.jpg`
3. Screenshot URL stored in `psi_results.screenshot_url` field
4. Site detail page displays screenshot thumbnail (200px width) next to PSI score
5. Clicking thumbnail opens modal with full-size image (1366px width) and metadata (scan date, device, score)
6. Screenshot comparison view shows current vs previous scan side-by-side with visual diff overlay
7. Screenshots retained per tier retention policy (same as PSI data)
8. Feature gracefully degrades if screenshot extraction fails (displays "Screenshot unavailable" placeholder)

#### Technical Notes

**Screenshot Extraction & Upload:**

```typescript
async function extractAndUploadScreenshot(
  psiResult: any,
  siteId: string,
  device: string,
  env: Env
): Promise<string | null> {
  try {
    const screenshotAudit = psiResult.lighthouseResult.audits['final-screenshot'];
    if (!screenshotAudit?.details?.data) return null;

    const base64Data = screenshotAudit.details.data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    const timestamp = Date.now();
    const key = `psi-screenshots/${siteId}/${timestamp}_${device}.jpg`;

    await env.R2_BUCKET.put(key, buffer, {
      httpMetadata: {
        contentType: 'image/jpeg',
      },
    });

    return `https://cdn.websitemage.com/${key}`;
  } catch (error) {
    console.error('Screenshot upload failed:', error);
    return null;
  }
}
```

**Screenshot Comparison Component:**

```vue
<template>
  <div class="screenshot-comparison">
    <div class="comparison-view">
      <div class="screenshot-panel">
        <h4>Previous Scan</h4>
        <img :src="previousScreenshot" alt="Previous scan" />
        <div class="metadata">
          {{ formatDate(previousScan.scanned_at) }} - Score: {{ previousScan.performance_score }}
        </div>
      </div>

      <div class="screenshot-panel">
        <h4>Current Scan</h4>
        <img :src="currentScreenshot" alt="Current scan" />
        <div class="metadata">
          {{ formatDate(currentScan.scanned_at) }} - Score: {{ currentScan.performance_score }}
          <span :class="scoreDiffClass"> {{ scoreDiff > 0 ? '+' : '' }}{{ scoreDiff }} </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps<{
  currentScan: any
  previousScan: any
}>()

const currentScreenshot = computed(() => props.currentScan.screenshot_url)
const previousScreenshot = computed(() => props.previousScan.screenshot_url)

const scoreDiff = computed(() =>
  props.currentScan.performance_score - props.previousScan.performance_score
)

const scoreDiffClass = computed(() => ({
  'score-improved': scoreDiff.value > 0,
  'score-declined': scoreDiff.value < 0,
  'score-same': scoreDiff.value === 0
}))
</script>
```

---

## Epic Completion Checklist

- [ ] All 5 stories completed and tested
- [ ] PSI API integration working with scheduled scans
- [ ] Manual scans with rate limiting functional
- [ ] Historical trends displaying correctly
- [ ] Opportunities list showing actionable recommendations
- [ ] Screenshots (optional) capturing and displaying
- [ ] Tier-based retention policies enforced
- [ ] End-to-end PSI workflow validated
- [ ] Ready for Epic 4: Real User Monitoring

---

## Dependencies & Prerequisites

**Requires Epics 1 & 2 Completion:**

- Sites table with monitored domains
- Tier-based feature gating
- Dashboard infrastructure

**New Services Needed:**

- Google PageSpeed Insights API key (free, 25k queries/day)
- Cloudflare R2 bucket for screenshots (optional)

**After Epic 3 Completion:**

- Performance monitoring operational
- Historical trends available
- Optimization guidance provided
- Foundation for comprehensive monitoring dashboard
