# Epic 2: Uptime Monitoring

**Status:** Draft  
**Version:** 1.0  
**Date:** 2025-10-26  
**Author:** Kyle Baker

---

## Epic Goal

Build the core uptime monitoring system with multi-region HTTP checks, incident tracking, alert delivery, and dashboard visualization. Enable users to add sites, configure check frequency and keyword validation, and receive notifications when sites go down or recover.

## Epic Scope

This epic delivers the foundational monitoring capabilities:

- Site CRUD operations (Create, Read, Update, Delete)
- Multi-region HTTP uptime checks (US/EU/APAC)
- Incident detection with majority voting logic
- Incident state management (open/close)
- Dashboard visualization with uptime percentage
- SSL certificate and DNS status monitoring (Pro/Agency tiers)
- Tier-based check frequency enforcement

**Success Criteria:** Users can add sites, see real-time uptime status, view incident history, and monitor SSL/DNS health (Pro/Agency only).

---

## Stories

### Story 2.1: Site Management CRUD

**As a** agency admin,  
**I want** to add, edit, and delete monitored sites,  
**so that** I can configure which domains to monitor.

#### Acceptance Criteria

1. Sites list page displays all sites for user's agency with columns: Domain, Status, Last Check, Actions
2. "Add Site" button opens modal/form with fields: Domain (required, URL validation), Expected Keyword (optional, text), Check Frequency (disabled, shows tier default)
3. Form validates domain format (starts with http:// or https://)
4. Successful site creation inserts row into `sites` table with `agency_id` from current user
5. Site appears in list immediately after creation with "Pending First Check" status
6. Edit action opens same form pre-filled with site data
7. Delete action shows confirmation dialog with warning about data retention
8. Delete sets `deleted_at` timestamp (soft delete), site disappears from list
9. Empty state message displayed when no sites exist: "Add your first site to start monitoring"

#### Technical Notes

**Database Schema Addition:**

```sql
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS expected_keyword TEXT;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS settings_json JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX idx_sites_deleted ON sites(deleted_at) WHERE deleted_at IS NULL;
```

**Sites List Page Component:**

```vue
<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Monitored Sites</h1>
      <button @click="showAddModal = true" class="btn-primary">Add Site</button>
    </div>

    <div v-if="sites.length === 0" class="empty-state">
      <p>Add your first site to start monitoring</p>
    </div>

    <table v-else class="w-full">
      <thead>
        <tr>
          <th>Domain</th>
          <th>Status</th>
          <th>Last Check</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="site in sites" :key="site.id">
          <td>{{ site.domain }}</td>
          <td><StatusBadge :status="site.status" /></td>
          <td>{{ formatDate(site.last_check) }}</td>
          <td>
            <button @click="editSite(site)">Edit</button>
            <button @click="deleteSite(site)">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>

    <SiteModal v-if="showAddModal" @close="showAddModal = false" @save="handleSave" />
  </div>
</template>
```

**Form Validation (Zod):**

```typescript
import { z } from 'zod';

export const SiteSchema = z.object({
  domain: z.string().url('Must be a valid URL starting with http:// or https://'),
  expected_keyword: z.string().max(100).optional(),
});
```

---

### Story 2.2: Uptime Worker - HTTP Check Logic

**As a** system worker,  
**I want** to execute HTTP GET requests to monitored sites with timeout and retry logic,  
**so that** I can detect downtime accurately.

#### Acceptance Criteria

1. Uptime Worker created in `packages/workers/uptime` with scheduled trigger (every 5 minutes)
2. Worker queries Supabase for all active sites (where `deleted_at IS NULL`)
3. For each site, Worker performs HTTP GET with 10-second timeout
4. Worker follows up to 3 redirects (3XX responses)
5. Worker records result in `uptime_checks` table: `site_id`, `checked_at`, `region`, `http_status`, `ttfb_ms`, `ok`, `err`
6. Success criteria: `http_status` 200-299 AND (if `expected_keyword` set) keyword found in response body
7. On failure, Worker retries immediately up to 3 times before marking check as failed
8. Worker logs execution summary to Sentry: sites checked, successes, failures, duration
9. Worker completes batch in <60 seconds for 100 sites

#### Technical Notes

**Worker Structure:**

```
packages/workers/uptime/
├── src/
│   ├── index.ts           # Scheduled entry point
│   ├── checker.ts         # HTTP check logic
│   ├── incidents.ts       # Incident management
│   └── regions.ts         # Multi-region config
├── wrangler.toml
└── package.json
```

**wrangler.toml:**

```toml
name = "websitemage-uptime"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[triggers]
crons = ["*/5 * * * *"]  # Every 5 minutes

[vars]
SUPABASE_URL = "https://your-project.supabase.co"
```

**Checker Logic (checker.ts):**

```typescript
export async function checkSite(site: Site, region: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  const startTime = Date.now();

  try {
    const response = await fetch(site.domain, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'WebsiteMage-Monitor/1.0',
      },
    });

    clearTimeout(timeoutId);
    const ttfb = Date.now() - startTime;

    let ok = response.status >= 200 && response.status < 300;

    // Keyword validation if configured
    if (ok && site.expected_keyword) {
      const body = await response.text();
      ok = body.includes(site.expected_keyword);
    }

    return {
      http_status: response.status,
      ttfb_ms: ttfb,
      ok,
      err: ok ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    return {
      http_status: null,
      ttfb_ms: Date.now() - startTime,
      ok: false,
      err: error.message,
    };
  }
}

export async function checkWithRetries(site: Site, region: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await checkSite(site, region);

    if (result.ok || attempt === maxRetries) {
      return { ...result, attempts: attempt };
    }

    // Wait 2s between retries
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
```

**Database Schema:**

```sql
CREATE TABLE public.uptime_checks (
  id BIGSERIAL PRIMARY KEY,
  agency_id UUID NOT NULL,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  region TEXT NOT NULL,
  http_status INT,
  ttfb_ms INT,
  ok BOOLEAN NOT NULL,
  err TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_uptime_site_time ON uptime_checks(site_id, checked_at DESC);
CREATE INDEX idx_uptime_agency_time ON uptime_checks(agency_id, checked_at DESC);
```

---

### Story 2.3: Multi-Region Check & Majority Voting

**As a** system worker,  
**I want** to perform checks from multiple regions and use majority voting,  
**so that** I reduce false positives from regional network issues.

#### Acceptance Criteria

1. Worker configured to execute checks from 3 regions: `us-east`, `eu-west`, `ap-sg`
2. Each region creates separate `uptime_checks` record with `region` field populated
3. After all regions complete, Worker calculates majority result: ≥2 regions must fail to mark site as down
4. Majority voting logic prevents opening incident if only 1 region fails
5. Edge case: if only 2 regions respond (1 timeout), Worker treats as "inconclusive" and does not open incident
6. Regional results displayed in site detail view showing per-region status
7. Configuration allows future override: "require all regions" or "any region" (default: majority)

#### Technical Notes

**Multi-Region Execution:**

```typescript
// regions.ts
export const REGIONS = ['us-east', 'eu-west', 'ap-sg'];

// index.ts
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const sites = await fetchActiveSites(env);

    for (const site of sites) {
      // Execute checks in parallel across all regions
      const regionalChecks = await Promise.allSettled(
        REGIONS.map((region) => checkWithRetries(site, region))
      );

      const results = regionalChecks.filter((r) => r.status === 'fulfilled').map((r) => r.value);

      // Majority voting
      const failedCount = results.filter((r) => !r.ok).length;
      const totalResponded = results.length;

      let overallStatus: boolean;
      if (totalResponded < 2) {
        // Not enough regions responded, inconclusive
        overallStatus = true; // Assume OK to avoid false positive
      } else {
        // Majority voting: ≥50% must fail
        overallStatus = failedCount < Math.ceil(totalResponded / 2);
      }

      // Store all regional results
      for (const result of results) {
        await insertUptimeCheck(env, {
          site_id: site.id,
          agency_id: site.agency_id,
          region: result.region,
          ...result,
        });
      }

      // Handle incident logic based on overall status
      await handleIncidentLogic(env, site, overallStatus);
    }
  },
};
```

**Regional Display Component:**

```vue
<template>
  <div class="regional-checks">
    <h3>Regional Status</h3>
    <div class="grid grid-cols-3 gap-4">
      <div v-for="region in regions" :key="region.name">
        <div class="region-card">
          <span class="region-name">{{ region.name }}</span>
          <StatusBadge :status="region.status" />
          <span class="text-sm">{{ region.ttfb }}ms</span>
        </div>
      </div>
    </div>
  </div>
</template>
```

---

### Story 2.4: Incident Detection & State Management

**As a** system worker,  
**I want** to track incident open/close state based on consecutive check failures,  
**so that** I can determine when to send alerts.

#### Acceptance Criteria

1. `uptime_incidents` table used to track open incidents per site
2. After 3 consecutive failed checks (majority voting across regions), Worker opens new incident
3. Worker ensures only 1 open incident exists per site at a time (checks `closed_at IS NULL`)
4. On first successful check after incident, Worker closes incident: sets `closed_at` timestamp
5. Incident reason field captures last error message or HTTP status code
6. Worker increments `alert_sent_count` on incident row when alert dispatched (Epic 5)
7. Dashboard displays incident history with open/closed status and duration
8. Incident timeline shows all associated `uptime_checks` during incident window

#### Technical Notes

**Database Schema:**

```sql
CREATE TABLE public.uptime_incidents (
  id BIGSERIAL PRIMARY KEY,
  agency_id UUID NOT NULL,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  opened_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  reason TEXT,
  alert_sent_count INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_incidents_site_opened ON uptime_incidents(site_id, opened_at DESC);
```

**Incident Management Logic:**

```typescript
// incidents.ts
export async function handleIncidentLogic(env: Env, site: Site, currentCheckOk: boolean) {
  // Get last 3 checks
  const recentChecks = await getRecentChecks(env, site.id, 3);

  // Check for open incident
  const openIncident = await getOpenIncident(env, site.id);

  if (!currentCheckOk) {
    // Current check failed
    const consecutiveFailures = recentChecks.every((check) => !check.ok);

    if (consecutiveFailures && recentChecks.length >= 3 && !openIncident) {
      // Open new incident after 3 consecutive failures
      await openNewIncident(env, {
        site_id: site.id,
        agency_id: site.agency_id,
        reason: recentChecks[0].err || `HTTP ${recentChecks[0].http_status}`,
        opened_at: new Date().toISOString(),
      });

      // Trigger alert (Epic 5)
      // await triggerAlert(env, site, 'down')
    }
  } else {
    // Current check succeeded
    if (openIncident) {
      // Close the incident
      await closeIncident(env, openIncident.id);

      // Trigger recovery alert (Epic 5)
      // await triggerAlert(env, site, 'recovered')
    }
  }
}
```

---

### Story 2.5: Uptime Dashboard Visualization

**As a** user,  
**I want** to see uptime percentage and incident history for my sites,  
**so that** I can quickly assess site health.

#### Acceptance Criteria

1. Dashboard "Sites" page displays uptime % for last 30 days per site
2. Uptime % formula: `(successful checks / total checks) * 100`, displayed as "99.8%"
3. Status badge shown per site: Green "Up", Red "Down", Gray "Unknown"
4. Site detail page shows uptime chart: line graph with hourly resolution for last 7 days
5. Incident list table displays: Opened At, Closed At (or "Ongoing"), Duration, Reason
6. Click incident row expands to show all check attempts during incident window
7. Empty state message: "No incidents recorded" when site has 100% uptime
8. Loading state shown while fetching data
9. Auto-refresh every 60 seconds for dashboard and site detail pages

#### Technical Notes

**Uptime Calculation Composable:**

```typescript
// composables/useUptime.ts
export function useUptime(siteId: string) {
  const supabase = useSupabaseClient();

  const uptime = ref<number>(0);
  const loading = ref(true);

  async function fetchUptime() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: checks } = await supabase
      .from('uptime_checks')
      .select('ok')
      .eq('site_id', siteId)
      .gte('checked_at', thirtyDaysAgo.toISOString());

    if (checks && checks.length > 0) {
      const successfulChecks = checks.filter((c) => c.ok).length;
      uptime.value = (successfulChecks / checks.length) * 100;
    }

    loading.value = false;
  }

  // Auto-refresh every 60 seconds
  const interval = setInterval(fetchUptime, 60000);
  onUnmounted(() => clearInterval(interval));

  fetchUptime();

  return { uptime, loading };
}
```

**Uptime Chart Component:**

```vue
<template>
  <div class="uptime-chart">
    <canvas ref="chartCanvas"></canvas>
  </div>
</template>

<script setup>
import { Chart } from 'chart.js/auto'

const props = defineProps<{ siteId: string }>()
const chartCanvas = ref<HTMLCanvasElement>()

const { data: checksData } = await useFetch(`/api/sites/${props.siteId}/uptime-history`)

onMounted(() => {
  if (!chartCanvas.value) return

  new Chart(chartCanvas.value, {
    type: 'line',
    data: {
      labels: checksData.value.labels,
      datasets: [{
        label: 'Uptime %',
        data: checksData.value.values,
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
      }]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          max: 100
        }
      }
    }
  })
})
</script>
```

---

### Story 2.6: SSL & DNS Status (Pro/Agency Tiers)

**As a** Pro or Agency tier user,  
**I want** to see SSL certificate expiry dates and DNS resolution status,  
**so that** I can proactively address certificate or DNS issues.

#### Acceptance Criteria

1. Uptime Worker extracts SSL certificate expiry date during HTTPS checks
2. Worker stores SSL expiry timestamp in `sites.settings_json` field
3. Worker performs DNS resolution check before HTTP check
4. Site detail page displays SSL expiry badge: Green ">30 days", Yellow "7-30 days", Red "<7 days"
5. Site detail page displays DNS status badge: Green "Resolved", Red "Failed"
6. Feature only visible/active for Pro and Agency tier users
7. Base tier users see disabled SSL/DNS section with upgrade prompt
8. Worker skips SSL/DNS checks for Base tier sites
9. Alert triggered (Epic 5) when SSL expiry <7 days

#### Technical Notes

**SSL Extraction Logic:**

```typescript
// checker.ts (addition)
export async function extractSSLInfo(domain: string): Promise<SSLInfo | null> {
  try {
    const url = new URL(domain);
    if (url.protocol !== 'https:') return null;

    // Note: Cloudflare Workers don't have direct access to SSL cert info
    // Alternative: Use external API or check via separate service
    // For MVP, use a workaround with fetch and response headers

    const response = await fetch(domain, { method: 'HEAD' });
    // Extract from response headers if available
    // Or use external SSL checker API

    return {
      expiresAt: '2025-12-31T23:59:59Z', // Placeholder
      daysRemaining: 365,
    };
  } catch (error) {
    return null;
  }
}
```

**DNS Check Logic:**

```typescript
export async function checkDNS(domain: string): Promise<boolean> {
  try {
    const url = new URL(domain);
    const hostname = url.hostname;

    // Simple check: if HTTP request succeeds, DNS resolved
    // More robust: use DNS over HTTPS API
    const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${hostname}`, {
      headers: { accept: 'application/dns-json' },
    });

    const data = await response.json();
    return data.Status === 0 && data.Answer && data.Answer.length > 0;
  } catch (error) {
    return false;
  }
}
```

**Tier-Based Feature Display:**

```vue
<template>
  <div class="ssl-dns-status">
    <div v-if="['pro', 'agency'].includes(userTier)">
      <SSLBadge :expiresAt="site.ssl_expiry" />
      <DNSBadge :status="site.dns_status" />
    </div>
    <div v-else class="upgrade-prompt">
      <p>SSL & DNS monitoring available on Pro and Agency plans</p>
      <button @click="showUpgrade">Upgrade Now</button>
    </div>
  </div>
</template>
```

---

### Story 2.7: Check Frequency Configuration by Tier

**As a** system,  
**I want** to enforce check frequency based on subscription tier,  
**so that** Pro/Agency users get more frequent monitoring.

#### Acceptance Criteria

1. Worker reads agency tier from `agencies.tier` field when processing sites
2. Check intervals enforced: Base 10 minutes, Pro 5 minutes, Agency 5 minutes
3. Worker calculates "next check due" timestamp per site and skips sites not yet due
4. Agency tier uses "pooled" logic: all sites under agency checked collectively
5. Site detail page displays "Check Frequency" badge showing current interval
6. Upgrade prompt shown on Base tier sites: "Upgrade to Pro for 5-minute checks"
7. Tier changes reflected immediately (within next Worker execution cycle)
8. Worker logs tier distribution in execution summary

#### Technical Notes

**Tier Constants:**

```typescript
// packages/shared/src/constants/tiers.ts
export const CHECK_INTERVALS = {
  base: 10 * 60 * 1000, // 10 minutes in ms
  pro: 5 * 60 * 1000, // 5 minutes
  agency: 5 * 60 * 1000, // 5 minutes
};

export function shouldCheckSite(site: Site, agency: Agency): boolean {
  const lastCheck = site.last_checked_at;
  if (!lastCheck) return true; // First check

  const interval = CHECK_INTERVALS[agency.tier];
  const nextCheckDue = new Date(lastCheck).getTime() + interval;

  return Date.now() >= nextCheckDue;
}
```

**Worker Filtering:**

```typescript
export default {
  async scheduled(event, env, ctx) {
    // Fetch sites with agency info
    const sitesWithAgencies = await supabase
      .from('sites')
      .select('*, agencies(*)')
      .is('deleted_at', null);

    // Filter sites due for check
    const sitesToCheck = sitesWithAgencies.filter((site) => shouldCheckSite(site, site.agencies));

    console.log(`Checking ${sitesToCheck.length} sites across tiers`, {
      base: sitesToCheck.filter((s) => s.agencies.tier === 'base').length,
      pro: sitesToCheck.filter((s) => s.agencies.tier === 'pro').length,
      agency: sitesToCheck.filter((s) => s.agencies.tier === 'agency').length,
    });

    // Execute checks...
  },
};
```

---

## Epic Completion Checklist

- [ ] All 7 stories completed and tested
- [ ] Sites can be added, edited, and deleted
- [ ] Multi-region uptime checks running every 5 minutes
- [ ] Incidents opening and closing correctly
- [ ] Dashboard showing uptime percentages and incident history
- [ ] SSL/DNS monitoring working for Pro/Agency tiers
- [ ] Tier-based check frequencies enforced
- [ ] End-to-end monitoring flow validated
- [ ] Ready for Epic 3: PageSpeed / Lighthouse Analysis

---

## Dependencies & Prerequisites

**Requires Epic 1 Completion:**

- Monorepo setup
- Supabase with core schema
- Cloudflare Workers infrastructure
- Authentication working

**New Services Needed:**

- Cloudflare Cron Triggers (free tier)
- DNS over HTTPS API access (Cloudflare DNS)

**After Epic 2 Completion:**

- Core monitoring operational
- Sites being checked every 5-10 minutes
- Incident detection working
- Foundation for alerts (Epic 5)
