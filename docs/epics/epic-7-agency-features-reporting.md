# Epic 7: Agency Features & Reporting

**Status:** Draft  
**Version:** 1.0  
**Date:** 2025-10-26  
**Author:** Kyle Baker

---

## Epic Goal

Enable white-label branding, client dashboards with granular access control, monthly PDF report generation with performance summaries, CSV data exports, team member invitations with role management, and audit logging for compliance.

## Epic Scope

This epic delivers agency-tier capabilities:

- Team member invitations with role management (Admin, Staff, Client)
- Client site access control with RLS
- White-label branding (logo, colors, custom domain)
- Automated monthly PDF report generation
- CSV data exports with rate limiting
- Audit log viewer for compliance
- Client dashboard UI (simplified, read-only)

**Success Criteria:** Agencies can invite team members and clients, apply white-label branding, generate automated reports, export data for analysis, and maintain compliance through audit logs.

---

## Stories

### Story 7.1: Team Member Invitations & Role Management

**As a** agency admin,  
**I want** to invite team members and assign roles,  
**so that** staff and clients can access appropriate data.

#### Acceptance Criteria

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

#### Technical Notes

**Database Schema:**
```sql
CREATE TABLE public.invitations (
  id BIGSERIAL PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'client')),
  token TEXT UNIQUE NOT NULL,
  invited_by UUID REFERENCES users(id),
  message TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_agency ON invitations(agency_id);

CREATE TABLE public.agency_members (
  id BIGSERIAL PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'client')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agency_id, user_id)
);

CREATE INDEX idx_members_agency ON agency_members(agency_id);
CREATE INDEX idx_members_user ON agency_members(user_id);
```

**Invitation Component:**
```vue
<template>
  <div class="team-members">
    <div class="member-list">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Joined Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="member in members" :key="member.id">
            <td>{{ member.user.name }}</td>
            <td>{{ member.user.email }}</td>
            <td><RoleBadge :role="member.role" /></td>
            <td>{{ formatDate(member.joined_at) }}</td>
            <td>
              <button @click="changeRole(member)" v-if="canEdit">Change Role</button>
              <button @click="removeMember(member)" v-if="canEdit" class="text-red-600">Remove</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <button @click="showInviteModal = true" v-if="canInvite">
      Invite Member
    </button>
    
    <InviteModal 
      v-if="showInviteModal"
      @close="showInviteModal = false"
      @invite="handleInvite"
    />
  </div>
</template>

<script setup>
async function handleInvite(data: { email: string, role: string, message?: string }) {
  const response = await $fetch('/api/team/invite', {
    method: 'POST',
    body: data
  })
  
  if (response.success) {
    // Show success message
    await refreshMembers()
    showInviteModal.value = false
  }
}

async function removeMember(member) {
  if (!confirm(`Remove ${member.user.name} from the team? They will lose access immediately.`)) {
    return
  }
  
  await $fetch(`/api/team/members/${member.id}`, {
    method: 'DELETE'
  })
  
  await refreshMembers()
}
</script>
```

**API Endpoint:**
```typescript
// packages/workers/api/src/routes/team.ts
import { Hono } from 'hono'
import crypto from 'crypto'

const team = new Hono()

team.post('/invite', async (c) => {
  const { email, role, message } = await c.req.json()
  const user = c.get('user')
  
  // Check if user is admin
  const { data: member } = await c.env.SUPABASE
    .from('agency_members')
    .select('role')
    .eq('agency_id', user.agency_id)
    .eq('user_id', user.id)
    .single()
  
  if (member?.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403)
  }
  
  // Generate token
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)
  
  // Create invitation
  await c.env.SUPABASE
    .from('invitations')
    .insert({
      agency_id: user.agency_id,
      email,
      role,
      token,
      invited_by: user.id,
      message,
      expires_at: expiresAt.toISOString()
    })
  
  // Send invitation email
  await sendInvitationEmail(c.env, {
    to: email,
    inviter: user.name,
    role,
    message,
    link: `https://app.websitemage.com/accept-invite?token=${token}`
  })
  
  return c.json({ success: true })
})

export default team
```

---

### Story 7.2: Client Site Access Control

**As a** agency admin,  
**I want** to grant clients access to specific sites only,  
**so that** they see their own sites without accessing other client data.

#### Acceptance Criteria

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

#### Technical Notes

**Database Schema:**
```sql
CREATE TABLE public.client_site_access (
  id BIGSERIAL PRIMARY KEY,
  client_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID REFERENCES users(id),
  UNIQUE(client_user_id, site_id)
);

CREATE INDEX idx_client_access_user ON client_site_access(client_user_id);
CREATE INDEX idx_client_access_site ON client_site_access(site_id);
```

**RLS Policy:**
```sql
-- Sites table RLS for client access
CREATE POLICY "Clients can view assigned sites"
ON sites FOR SELECT
TO authenticated
USING (
  -- Admin/Staff see all agency sites
  (EXISTS (
    SELECT 1 FROM agency_members
    WHERE agency_members.user_id = auth.uid()
    AND agency_members.agency_id = sites.agency_id
    AND agency_members.role IN ('admin', 'staff')
  ))
  OR
  -- Clients see only granted sites
  (EXISTS (
    SELECT 1 FROM client_site_access
    WHERE client_site_access.client_user_id = auth.uid()
    AND client_site_access.site_id = sites.id
  ))
);
```

**Site Access Component:**
```vue
<template>
  <div class="client-site-access">
    <h3>Site Access for {{ member.user.name }}</h3>
    
    <div class="site-list">
      <div v-for="site in allSites" :key="site.id" class="site-item">
        <input 
          type="checkbox"
          :checked="hasSiteAccess(site.id)"
          @change="toggleSiteAccess(site.id, $event.target.checked)"
        />
        <span>{{ site.domain }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
async function toggleSiteAccess(siteId: string, granted: boolean) {
  if (granted) {
    await $fetch('/api/team/client-access', {
      method: 'POST',
      body: {
        client_user_id: props.member.user_id,
        site_id: siteId
      }
    })
  } else {
    await $fetch(`/api/team/client-access/${props.member.user_id}/${siteId}`, {
      method: 'DELETE'
    })
  }
  
  await refreshAccess()
}
</script>
```

---

### Story 7.3: White-Label Branding (Agency Tier)

**As a** agency tier user,  
**I want** to customize the logo and colors for client-facing dashboards,  
**so that** my clients see my brand instead of Website Mage branding.

#### Acceptance Criteria

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

#### Technical Notes

**Branding Settings Component:**
```vue
<template>
  <div class="branding-settings">
    <h2>White-Label Branding</h2>
    
    <div class="branding-form">
      <div class="logo-upload">
        <label>Agency Logo</label>
        <input 
          type="file"
          accept="image/png,image/svg+xml"
          @change="handleLogoUpload"
        />
        <img v-if="currentLogo" :src="currentLogo" alt="Current logo" class="logo-preview" />
      </div>
      
      <div class="color-picker">
        <label>Primary Color</label>
        <input 
          type="color"
          v-model="primaryColor"
          @change="updateColor"
        />
      </div>
      
      <div class="custom-domain">
        <label>Client Portal Domain</label>
        <input 
          type="text"
          v-model="customDomain"
          placeholder="monitoring.myagency.com"
        />
        <p class="help-text">
          Configure CNAME: {{ customDomain }} → client.websitemage.com
        </p>
        <button @click="verifyDomain">Verify DNS Setup</button>
      </div>
      
      <div class="preview-panel">
        <h3>Preview</h3>
        <div class="preview-dashboard" :style="{ '--primary-color': primaryColor }">
          <div class="preview-header">
            <img v-if="currentLogo" :src="currentLogo" alt="Logo" />
            <span v-else>Your Logo Here</span>
          </div>
          <button class="preview-btn">Sample Button</button>
        </div>
      </div>
      
      <button @click="saveBranding" class="btn-primary">Save Branding</button>
    </div>
  </div>
</template>

<script setup>
const currentLogo = ref(null)
const primaryColor = ref('#2563eb')
const customDomain = ref('')

async function handleLogoUpload(event: Event) {
  const file = event.target.files[0]
  
  if (file.size > 500 * 1024) {
    alert('Logo must be under 500KB')
    return
  }
  
  const { data, error } = await supabase.storage
    .from('agency-logos')
    .upload(`${agency.value.id}/logo.${file.name.split('.').pop()}`, file, {
      upsert: true
    })
  
  if (!error) {
    currentLogo.value = supabase.storage
      .from('agency-logos')
      .getPublicUrl(data.path).data.publicUrl
  }
}

async function saveBranding() {
  await $fetch('/api/agencies/branding', {
    method: 'PATCH',
    body: {
      logo_url: currentLogo.value,
      primary_color: primaryColor.value,
      custom_domain: customDomain.value
    }
  })
}

async function verifyDomain() {
  const response = await $fetch('/api/agencies/verify-domain', {
    method: 'POST',
    body: { domain: customDomain.value }
  })
  
  if (response.verified) {
    alert('Domain verified successfully!')
  } else {
    alert(`DNS verification failed: ${response.error}`)
  }
}
</script>
```

**DNS Verification:**
```typescript
// packages/workers/api/src/routes/agencies.ts
app.post('/verify-domain', async (c) => {
  const { domain } = await c.req.json()
  
  try {
    // Use DNS over HTTPS to check CNAME
    const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=CNAME`, {
      headers: { 'accept': 'application/dns-json' }
    })
    
    const data = await response.json()
    
    if (data.Answer && data.Answer.some(a => a.data === 'client.websitemage.com.')) {
      return c.json({ verified: true })
    }
    
    return c.json({ verified: false, error: 'CNAME not configured correctly' })
  } catch (error) {
    return c.json({ verified: false, error: error.message })
  }
})
```

---

### Story 7.4: Monthly PDF Report Generation

**As a** agency tier user,  
**I want** automated monthly PDF reports generated for each site,  
**so that** I can send professional reports to clients without manual work.

#### Acceptance Criteria

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

#### Technical Notes

**Database Schema:**
```sql
CREATE TABLE public.reports (
  id BIGSERIAL PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- YYYY-MM-01 format
  pdf_url TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(site_id, month)
);

CREATE INDEX idx_reports_site ON reports(site_id, month DESC);
CREATE INDEX idx_reports_agency ON reports(agency_id, month DESC);
```

**Report Generation Worker:**
```typescript
// packages/workers/cron/src/monthly-reports.ts
export async function generateMonthlyReports(env: Env) {
  const lastMonth = new Date()
  lastMonth.setMonth(lastMonth.getMonth() - 1)
  const monthStr = lastMonth.toISOString().substring(0, 7)
  
  // Get all Agency tier sites
  const { data: sites } = await env.SUPABASE
    .from('sites')
    .select('*, agencies(tier, branding_json)')
    .eq('agencies.tier', 'agency')
    .is('deleted_at', null)
  
  for (const site of sites || []) {
    try {
      const reportData = await aggregateReportData(env, site.id, monthStr)
      const pdfUrl = await generatePDF(env, reportData, site.agencies.branding_json)
      
      await env.SUPABASE
        .from('reports')
        .insert({
          agency_id: site.agency_id,
          site_id: site.id,
          month: `${monthStr}-01`,
          pdf_url: pdfUrl
        })
      
      // Send notification email
      await sendReportEmail(env, site, pdfUrl)
      
      console.log(`Generated report for ${site.domain}`)
    } catch (error) {
      console.error(`Failed to generate report for ${site.domain}:`, error)
    }
  }
}

async function aggregateReportData(env: Env, siteId: string, month: string) {
  const startDate = `${month}-01`
  const endDate = new Date(startDate)
  endDate.setMonth(endDate.getMonth() + 1)
  
  // Uptime stats
  const { data: uptimeChecks } = await env.SUPABASE
    .from('uptime_checks')
    .select('ok')
    .eq('site_id', siteId)
    .gte('checked_at', startDate)
    .lt('checked_at', endDate.toISOString())
  
  const uptimePercent = (uptimeChecks?.filter(c => c.ok).length / uptimeChecks?.length) * 100
  
  // Incidents
  const { data: incidents } = await env.SUPABASE
    .from('uptime_incidents')
    .select('opened_at, closed_at, reason')
    .eq('site_id', siteId)
    .gte('opened_at', startDate)
    .lt('opened_at', endDate.toISOString())
  
  // PSI trends
  const { data: psiResults } = await env.SUPABASE
    .from('psi_results')
    .select('performance_score, lcp_ms, cls, inp_ms, scanned_at')
    .eq('site_id', siteId)
    .gte('scanned_at', startDate)
    .lt('scanned_at', endDate.toISOString())
  
  // RUM insights
  const { data: rumAgg } = await env.SUPABASE
    .from('rum_daily_agg')
    .select('lcp_p75, cls_p75, inp_p75, device_type, event_count')
    .eq('site_id', siteId)
    .gte('date', startDate)
    .lt('date', endDate.toISOString())
  
  return {
    uptimePercent,
    incidentCount: incidents?.length || 0,
    mttr: calculateMTTR(incidents),
    psiTrends: psiResults,
    rumInsights: rumAgg
  }
}

async function generatePDF(env: Env, data: any, branding: any): Promise<string> {
  // Use Puppeteer or external service like DocRaptor
  // For MVP, could use simple HTML to PDF conversion
  
  const html = renderReportHTML(data, branding)
  
  // Example using DocRaptor
  const response = await fetch('https://docraptor.com/docs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      user_credentials: env.DOCRAPTOR_API_KEY,
      doc: {
        document_type: 'pdf',
        document_content: html,
        name: `report-${Date.now()}.pdf`
      }
    })
  })
  
  const pdfBuffer = await response.arrayBuffer()
  
  // Upload to Supabase Storage
  const { data: uploadData } = await env.SUPABASE.storage
    .from('reports')
    .upload(`${data.agency_id}/${data.site_id}/${data.month}.pdf`, pdfBuffer, {
      contentType: 'application/pdf'
    })
  
  return uploadData.publicUrl
}
```

---

### Story 7.5: CSV Data Export

**As a** user,  
**I want** to export uptime incidents and PSI history to CSV,  
**so that** I can analyze data in external tools or share with stakeholders.

#### Acceptance Criteria

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

#### Technical Notes

**Export API:**
```typescript
// packages/workers/api/src/routes/export.ts
import { Hono } from 'hono'

const exportRouter = new Hono()

exportRouter.get('/', async (c) => {
  const { site_id, type, range } = c.req.query()
  const user = c.get('user')
  
  // Check rate limit
  const rateLimitKey = `export:${user.id}:${Math.floor(Date.now() / 3600000)}`
  const count = await c.env.RATE_LIMIT_KV.get(rateLimitKey)
  
  if (count && parseInt(count) >= 10) {
    return c.json({ error: 'Rate limit exceeded' }, 429)
  }
  
  // Verify site access (RLS handles this)
  const { data: site } = await c.env.SUPABASE
    .from('sites')
    .select('domain')
    .eq('id', site_id)
    .single()
  
  if (!site) {
    return c.json({ error: 'Site not found' }, 404)
  }
  
  // Calculate date range
  const days = parseInt(range.replace('d', '')) || 30
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  let csv = ''
  
  switch (type) {
    case 'uptime':
      csv = await exportUptimeCSV(c.env, site_id, startDate)
      break
    case 'psi':
      csv = await exportPSICSV(c.env, site_id, startDate)
      break
    case 'rum':
      csv = await exportRUMCSV(c.env, site_id, startDate)
      break
    default:
      return c.json({ error: 'Invalid type' }, 400)
  }
  
  // Increment rate limit
  await c.env.RATE_LIMIT_KV.put(
    rateLimitKey,
    String(parseInt(count || '0') + 1),
    { expirationTtl: 3600 }
  )
  
  // Log audit event
  await logAudit(c.env, {
    agency_id: site.agency_id,
    user_id: user.id,
    action: `export.csv.${type}`,
    target: site_id
  })
  
  const filename = `${type}-export-${new Date().toISOString().substring(0, 10)}.csv`
  
  return c.body(csv, 200, {
    'Content-Type': 'text/csv',
    'Content-Disposition': `attachment; filename="${filename}"`
  })
})

async function exportUptimeCSV(env: Env, siteId: string, startDate: Date): Promise<string> {
  const { data: checks } = await env.SUPABASE
    .from('uptime_checks')
    .select('checked_at, region, http_status, ttfb_ms, ok, err')
    .eq('site_id', siteId)
    .gte('checked_at', startDate.toISOString())
    .order('checked_at', { ascending: false })
  
  const rows = checks?.map(c => [
    c.checked_at,
    c.region,
    c.http_status || '',
    c.ttfb_ms || '',
    c.ok ? 'Up' : 'Down',
    c.err || ''
  ]) || []
  
  const csv = [
    ['Timestamp', 'Region', 'HTTP Status', 'TTFB (ms)', 'Result', 'Error'],
    ...rows
  ].map(row => row.join(',')).join('\n')
  
  return csv
}

async function exportPSICSV(env: Env, siteId: string, startDate: Date): Promise<string> {
  const { data: results } = await env.SUPABASE
    .from('psi_results')
    .select('scanned_at, device, performance_score, lcp_ms, cls, inp_ms, fcp_ms, lighthouse_version')
    .eq('site_id', siteId)
    .gte('scanned_at', startDate.toISOString())
    .order('scanned_at', { ascending: false })
  
  const rows = results?.map(r => [
    r.scanned_at,
    r.device,
    r.performance_score,
    r.lcp_ms,
    r.cls,
    r.inp_ms,
    r.fcp_ms,
    r.lighthouse_version
  ]) || []
  
  const csv = [
    ['Scanned At', 'Device', 'Performance Score', 'LCP (ms)', 'CLS', 'INP (ms)', 'FCP (ms)', 'Lighthouse Version'],
    ...rows
  ].map(row => row.join(',')).join('\n')
  
  return csv
}

export default exportRouter
```

---

### Story 7.6: Audit Log Viewer

**As a** admin user,  
**I want** to view audit logs of high-impact actions,  
**so that** I can track changes for compliance and troubleshooting.

#### Acceptance Criteria

1. Settings → Audit Log page displays table with columns: Timestamp, User, Action, Target (site/user/billing), Details, IP Address
2. Table data fetched from `audit_log` table filtered by `agency_id`
3. Table includes pagination: 50 rows per page
4. Filters available: Date Range (last 7d/30d/90d/custom), Action Type (dropdown: all | site.* | team.* | billing.* | export.*), User (dropdown: all | specific user)
5. Action types logged: site.create, site.update, site.delete, team.member.invited, team.member.removed, billing.plan.changed, export.csv.*, branding.updated, alert.config.changed
6. Details column shows JSON with relevant info (e.g., old/new values for updates)
7. Clicking row expands to show full details in formatted JSON viewer
8. Export audit log button: downloads CSV of filtered results (rate limited: 5 per day)
9. Audit logs retained for 12 months (automatic cleanup by scheduled Worker)
10. Admin-only access: Staff/Client roles see 403 Forbidden
11. System actions (automated Workers) recorded with `user_id=NULL`, source="system"

#### Technical Notes

**Database Schema:**
```sql
CREATE TABLE public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  target TEXT,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  source TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_agency_time ON audit_log(agency_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_user ON audit_log(user_id);
```

**Audit Log Component:**
```vue
<template>
  <div class="audit-log-viewer">
    <h2>Audit Log</h2>
    
    <div class="filters">
      <select v-model="filters.dateRange">
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
        <option value="90d">Last 90 days</option>
        <option value="custom">Custom</option>
      </select>
      
      <select v-model="filters.actionType">
        <option value="all">All Actions</option>
        <option value="site">Site Actions</option>
        <option value="team">Team Actions</option>
        <option value="billing">Billing Actions</option>
        <option value="export">Export Actions</option>
      </select>
      
      <select v-model="filters.userId">
        <option value="all">All Users</option>
        <option v-for="user in teamMembers" :key="user.id" :value="user.id">
          {{ user.name }}
        </option>
      </select>
      
      <button @click="exportAuditLog">Export CSV</button>
    </div>
    
    <table class="audit-table">
      <thead>
        <tr>
          <th>Timestamp</th>
          <th>User</th>
          <th>Action</th>
          <th>Target</th>
          <th>IP Address</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <template v-for="log in auditLogs" :key="log.id">
          <tr @click="expandLog(log.id)">
            <td>{{ formatDate(log.created_at) }}</td>
            <td>{{ log.user?.name || 'System' }}</td>
            <td><code>{{ log.action }}</code></td>
            <td>{{ log.target }}</td>
            <td>{{ log.ip_address }}</td>
            <td>
              <button>{{ expandedLog === log.id ? '▼' : '▶' }}</button>
            </td>
          </tr>
          <tr v-if="expandedLog === log.id">
            <td colspan="6">
              <pre>{{ JSON.stringify(log.details, null, 2) }}</pre>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
    
    <Pagination 
      :page="page"
      :total="totalPages"
      @change="page = $event"
    />
  </div>
</template>
```

---

### Story 7.7: Client Dashboard UI (Agency Tier)

**As a** client user,  
**I want** a simplified, read-only dashboard showing my site metrics,  
**so that** I can monitor performance without clutter or access to other clients' data.

#### Acceptance Criteria

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

#### Technical Notes

**Client Dashboard Component:**
```vue
<template>
  <div class="client-dashboard" :style="brandingStyles">
    <header class="dashboard-header">
      <img v-if="branding.logo_url" :src="branding.logo_url" alt="Logo" />
      <span v-else>{{ agency.name }}</span>
    </header>
    
    <div class="site-grid">
      <div v-for="site in grantedSites" :key="site.id" class="site-card">
        <h3>{{ site.domain }}</h3>
        
        <div class="site-metrics">
          <div class="metric">
            <span class="label">Uptime (30d)</span>
            <span class="value">{{ site.uptime_percent }}%</span>
          </div>
          
          <div class="metric">
            <span class="label">PSI Score</span>
            <span class="value">{{ site.latest_psi_score }}</span>
          </div>
          
          <div v-if="site.last_incident" class="incident-badge">
            Last incident: {{ formatDate(site.last_incident.opened_at) }}
          </div>
        </div>
        
        <NuxtLink :to="`/client-dashboard/sites/${site.id}`" class="btn-view">
          View Details
        </NuxtLink>
      </div>
    </div>
    
    <div v-if="grantedSites.length === 0" class="empty-state">
      <p>No sites assigned. Contact your agency admin.</p>
    </div>
    
    <footer class="dashboard-footer">
      <p>{{ branding.footer_text || `Monitored by ${agency.name} using Website Mage` }}</p>
    </footer>
  </div>
</template>

<script setup>
const { data: grantedSites } = await useFetch('/api/client/sites')
const { data: agency } = await useFetch('/api/client/agency')

const branding = computed(() => agency.value?.branding_json || {})

const brandingStyles = computed(() => ({
  '--primary-color': branding.value.primary_color || '#2563eb'
}))
</script>

<style scoped>
.client-dashboard {
  --primary-color: #2563eb;
}

.btn-view {
  background: var(--primary-color);
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
}

.site-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 24px;
}

.site-metrics {
  display: flex;
  gap: 16px;
  margin: 16px 0;
}

.dashboard-footer {
  text-align: center;
  color: #6b7280;
  padding: 32px 0;
  font-size: 14px;
}
</style>
```

**Request Improvement Feature:**
```typescript
app.post('/client/request-improvement', async (c) => {
  const { site_id, message } = await c.req.json()
  const user = c.get('user')
  
  const { data: site } = await c.env.SUPABASE
    .from('sites')
    .select('domain, agencies(admin_email, name)')
    .eq('id', site_id)
    .single()
  
  // Send notification to agency admin
  await sendEmail(c.env, {
    to: site.agencies.admin_email,
    subject: `Client requested performance improvement for ${site.domain}`,
    body: `Client ${user.name} (${user.email}) has requested performance improvement for ${site.domain}.\n\nMessage: ${message}\n\nView site: https://app.websitemage.com/sites/${site_id}`
  })
  
  return c.json({ success: true })
})
```

---

## Epic Completion Checklist

- [ ] All 7 stories completed and tested
- [ ] Team member invitations working with role management
- [ ] Client site access control enforced via RLS
- [ ] White-label branding applied to client dashboards
- [ ] Monthly PDF reports generating automatically
- [ ] CSV exports functional with rate limiting
- [ ] Audit log viewer displaying all actions
- [ ] Client dashboard simplified and read-only
- [ ] End-to-end agency workflow validated
- [ ] Ready for production launch

---

## Dependencies & Prerequisites

**Requires Epics 1-6 Completion:**
- Full platform operational
- Billing system for tier enforcement
- Alert system for notifications

**New Services Needed:**
- Supabase Storage for logos and reports
- PDF generation service (DocRaptor or Puppeteer)
- Custom domain SSL via Cloudflare

**After Epic 7 Completion:**
- Complete agency-tier feature set
- White-label solution operational
- Client self-service dashboards live
- Platform ready for MVP launch
