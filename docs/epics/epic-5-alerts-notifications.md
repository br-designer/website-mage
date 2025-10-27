# Epic 5: Alerts & Notifications

**Status:** Draft  
**Version:** 1.0  
**Date:** 2025-10-26  
**Author:** Kyle Baker

---

## Epic Goal

Build comprehensive alert delivery system using AWS SES for email and Twilio for SMS. Implement quiet hours with timezone support, per-incident throttling, usage tracking for billing, and overage notifications. Ensure alerts respect monthly caps and integrate with billing for overage charges.

## Epic Scope

This epic delivers reliable notification capabilities:

- AWS SES email integration with templates
- Twilio SMS integration with metered billing
- Multi-recipient alert management
- Quiet hours with timezone support
- Per-incident throttling to prevent spam
- Usage tracking and overage billing
- Delivery reliability with retries

**Success Criteria:** Users receive timely, accurate alerts via email and SMS when sites go down or recover, with configurable preferences and reliable delivery.

---

## Stories

### Story 5.1: Email Alert Integration (AWS SES)

**As a** system,  
**I want** to send email alerts via AWS SES when incidents occur,  
**so that** users are notified promptly of site issues.

#### Acceptance Criteria

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

#### Technical Notes

**Database Schema:**

```sql
CREATE TABLE public.alerts_sent (
  id BIGSERIAL PRIMARY KEY,
  agency_id UUID NOT NULL,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  incident_id BIGINT REFERENCES uptime_incidents(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  recipient TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta JSONB,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending'))
);

CREATE INDEX idx_alerts_incident ON alerts_sent(incident_id);
CREATE INDEX idx_alerts_agency ON alerts_sent(agency_id, sent_at DESC);
```

**Email Templates:**

```html
<!-- Site Down Template -->
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Site Down Alert</title>
  </head>
  <body>
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #dc2626;">🚨 Site Down Alert</h1>
      <p>Your site <strong>{{domain}}</strong> is currently down.</p>

      <div style="background: #fee2e2; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p><strong>Status:</strong> Down</p>
        <p><strong>Time:</strong> {{timestamp}}</p>
        <p><strong>Reason:</strong> {{reason}}</p>
      </div>

      <p>
        <a
          href="{{incident_link}}"
          style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;"
        >
          View Incident Details
        </a>
      </p>

      <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
        Website Mage is monitoring your site and will alert you when it recovers.
      </p>
    </div>
  </body>
</html>
```

**Alert Worker Logic:**

```typescript
// packages/workers/uptime/src/alerts.ts
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

export async function sendDownAlert(env: Env, site: Site, incident: Incident) {
  const recipients = site.settings_json.alert_recipients || [{ email: site.agency.admin_email }];

  const ses = new SESClient({
    region: 'us-east-1',
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });

  for (const recipient of recipients) {
    if (!recipient.email) continue;

    // Check quiet hours
    if (isInQuietHours(recipient)) {
      console.log(`Skipping email to ${recipient.email} (quiet hours)`);
      continue;
    }

    try {
      const html = renderDownEmailTemplate({
        domain: site.domain,
        timestamp: incident.opened_at,
        reason: incident.reason,
        incident_link: `https://app.websitemage.com/sites/${site.id}/incidents/${incident.id}`,
      });

      const command = new SendEmailCommand({
        Source: 'alerts@websitemage.com',
        Destination: { ToAddresses: [recipient.email] },
        Message: {
          Subject: { Data: `🚨 ${site.domain} is DOWN` },
          Body: { Html: { Data: html } },
        },
      });

      const response = await ses.send(command);

      // Log successful send
      await env.SUPABASE.from('alerts_sent').insert({
        agency_id: site.agency_id,
        site_id: site.id,
        incident_id: incident.id,
        channel: 'email',
        recipient: recipient.email,
        status: 'sent',
        meta: { ses_message_id: response.MessageId },
      });

      // Increment usage counter
      await incrementUsage(env, site.agency_id, 'email');
    } catch (error) {
      console.error(`Failed to send email to ${recipient.email}:`, error);

      await env.SUPABASE.from('alerts_sent').insert({
        agency_id: site.agency_id,
        site_id: site.id,
        incident_id: incident.id,
        channel: 'email',
        recipient: recipient.email,
        status: 'failed',
        meta: { error: error.message },
      });
    }
  }
}
```

---

### Story 5.2: SMS Alert Integration (Twilio)

**As a** user,  
**I want** to receive SMS alerts for critical site outages,  
**so that** I'm notified even when away from email.

#### Acceptance Criteria

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

#### Technical Notes

**Twilio Integration:**

```typescript
// packages/workers/uptime/src/sms.ts
import { Twilio } from 'twilio';

export async function sendSMSAlert(
  env: Env,
  site: Site,
  incident: Incident,
  type: 'down' | 'recovered'
) {
  const recipients = site.settings_json.alert_recipients || [];

  const twilio = new Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

  for (const recipient of recipients) {
    if (!recipient.phone || !recipient.sms_enabled) continue;

    // Validate US/Canada phone number
    if (!recipient.phone.match(/^\+1\d{10}$/)) {
      console.log(`Invalid phone number: ${recipient.phone}`);
      continue;
    }

    // Check quiet hours
    if (type === 'down' && isInQuietHours(recipient)) {
      console.log(`Skipping SMS to ${recipient.phone} (quiet hours)`);
      continue;
    }

    try {
      const message =
        type === 'down'
          ? `[Website Mage] ALERT: ${site.domain} is down. Check dashboard: https://app.websitemage.com/sites/${site.id}`
          : `[Website Mage] ${site.domain} recovered after ${formatDuration(incident.closed_at - incident.opened_at)}.`;

      const sms = await twilio.messages.create({
        body: message,
        from: env.TWILIO_PHONE_NUMBER,
        to: recipient.phone,
        statusCallback: `https://api.websitemage.com/webhooks/twilio/status`,
      });

      await env.SUPABASE.from('alerts_sent').insert({
        agency_id: site.agency_id,
        site_id: site.id,
        incident_id: incident.id,
        channel: 'sms',
        recipient: recipient.phone,
        status: 'sent',
        meta: { twilio_sid: sms.sid, status: sms.status },
      });

      // Increment SMS usage (always metered)
      await incrementUsage(env, site.agency_id, 'sms');
    } catch (error) {
      console.error(`Failed to send SMS to ${recipient.phone}:`, error);

      await env.SUPABASE.from('alerts_sent').insert({
        agency_id: site.agency_id,
        site_id: site.id,
        incident_id: incident.id,
        channel: 'sms',
        recipient: recipient.phone,
        status: 'failed',
        meta: { error: error.message },
      });
    }
  }
}
```

**Twilio Status Callback Webhook:**

```typescript
// packages/workers/api/src/routes/webhooks.ts
app.post('/webhooks/twilio/status', async (c) => {
  const { MessageSid, MessageStatus } = await c.req.parseBody();

  await c.env.SUPABASE.from('alerts_sent')
    .update({ meta: { twilio_sid: MessageSid, status: MessageStatus } })
    .eq('meta->>twilio_sid', MessageSid);

  return c.text('OK');
});
```

---

### Story 5.3: Alert Recipient Management

**As a** user,  
**I want** to configure multiple alert recipients with different contact methods,  
**so that** my team receives notifications on their preferred channels.

#### Acceptance Criteria

1. Site settings page displays "Alert Recipients" section
2. Section shows list of recipients with columns: Name, Email, Phone, Quiet Hours, Actions
3. "Add Recipient" button opens form: Name (required), Email (optional, validated), Phone (optional, E.164 format), Quiet Hours Start/End (optional, 24h format), Timezone (dropdown, default: account timezone)
4. Recipients stored as JSON array in `sites.settings_json.alert_recipients`: `[{name, email, phone, quiet_hours: {start, end, timezone}}]`
5. At least one recipient required (validation on save)
6. Edit recipient opens same form pre-filled
7. Delete recipient shows confirmation dialog
8. Default recipient auto-created on site creation: agency admin with account email
9. Recipient limit enforced: Base 1, Pro 3, Agency 10 per site

#### Technical Notes

**Recipient Form Component:**

```vue
<template>
  <div class="alert-recipients">
    <div class="recipient-list">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Quiet Hours</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(recipient, index) in recipients" :key="index">
            <td>{{ recipient.name }}</td>
            <td>{{ recipient.email || '—' }}</td>
            <td>{{ recipient.phone || '—' }}</td>
            <td>
              <span v-if="recipient.quiet_hours">
                {{ recipient.quiet_hours.start }} - {{ recipient.quiet_hours.end }}
                <span class="badge">{{ recipient.quiet_hours.timezone }}</span>
              </span>
              <span v-else>—</span>
            </td>
            <td>
              <button @click="editRecipient(index)">Edit</button>
              <button @click="deleteRecipient(index)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <button
      @click="showAddModal = true"
      :disabled="recipients.length >= recipientLimit"
      class="btn-primary"
    >
      Add Recipient
    </button>

    <div v-if="recipients.length >= recipientLimit" class="upgrade-prompt">
      <p>Recipient limit reached. Upgrade to add more recipients.</p>
    </div>

    <RecipientModal
      v-if="showAddModal"
      :recipient="editingRecipient"
      @save="handleSave"
      @close="showAddModal = false"
    />
  </div>
</template>

<script setup>
const props = defineProps<{
  siteId: string
  tier: string
}>()

const recipientLimits = {
  base: 1,
  pro: 3,
  agency: 10
}

const recipients = ref([])
const recipientLimit = computed(() => recipientLimits[props.tier])

async function handleSave(recipient) {
  // Validate at least one contact method
  if (!recipient.email && !recipient.phone) {
    alert('Recipient must have at least email or phone')
    return
  }

  // Update settings_json
  await $fetch(`/api/sites/${props.siteId}`, {
    method: 'PATCH',
    body: {
      settings_json: {
        alert_recipients: [...recipients.value, recipient]
      }
    }
  })

  showAddModal.value = false
}
</script>
```

**Validation Schema:**

```typescript
import { z } from 'zod';

export const RecipientSchema = z
  .object({
    name: z.string().min(1).max(100),
    email: z.string().email().optional(),
    phone: z
      .string()
      .regex(/^\+1\d{10}$/)
      .optional(),
    sms_enabled: z.boolean().default(false),
    quiet_hours: z
      .object({
        enabled: z.boolean(),
        start: z.string().regex(/^\d{2}:\d{2}$/),
        end: z.string().regex(/^\d{2}:\d{2}$/),
        timezone: z.string(),
      })
      .optional(),
  })
  .refine((data) => data.email || data.phone, {
    message: 'At least one contact method (email or phone) is required',
  });
```

---

### Story 5.4: Quiet Hours & Timezone Handling

**As a** user,  
**I want** to configure quiet hours when alerts are suppressed,  
**so that** I'm not disturbed during off-hours for non-critical issues.

#### Acceptance Criteria

1. Recipient form includes "Quiet Hours" toggle (default: off)
2. When enabled, user sets: Start Time (HH:MM), End Time (HH:MM), Timezone (dropdown: all IANA timezones)
3. Alert Worker checks current time in recipient's timezone before sending alert
4. If current time falls within quiet hours window, Worker skips alert delivery for that recipient
5. Quiet hours logic: if `start=22:00, end=08:00`, suppress alerts from 10pm to 8am in recipient's timezone
6. Critical incidents bypass quiet hours (future: severity levels, MVP suppresses all)
7. Recovery alerts always delivered regardless of quiet hours
8. Dashboard shows recipient list with "Quiet Hours Active" badge if currently in quiet window
9. Quiet hours configuration optional per recipient (some recipients may have quiet hours, others 24/7)

#### Technical Notes

**Quiet Hours Logic:**

```typescript
import { DateTime } from 'luxon';

export function isInQuietHours(recipient: Recipient): boolean {
  if (!recipient.quiet_hours?.enabled) return false;

  const now = DateTime.now().setZone(recipient.quiet_hours.timezone);
  const currentTime = now.toFormat('HH:mm');

  const start = recipient.quiet_hours.start;
  const end = recipient.quiet_hours.end;

  // Handle overnight quiet hours (e.g., 22:00 - 08:00)
  if (start > end) {
    return currentTime >= start || currentTime < end;
  }

  // Normal quiet hours (e.g., 09:00 - 17:00)
  return currentTime >= start && currentTime < end;
}

export function shouldSendAlert(recipient: Recipient, alertType: 'down' | 'recovered'): boolean {
  // Always send recovery alerts
  if (alertType === 'recovered') return true;

  // Check quiet hours for down alerts
  return !isInQuietHours(recipient);
}
```

---

### Story 5.5: Per-Incident Alert Throttling

**As a** system,  
**I want** to limit the number of alerts sent per incident to prevent spam,  
**so that** users aren't overwhelmed by repeated notifications.

#### Acceptance Criteria

1. Alert Worker checks `uptime_incidents.alert_sent_count` before sending alert
2. Maximum 3 alerts sent per incident lifecycle: 1 initial "down", up to 2 reminders, 1 recovery
3. Reminder alerts sent if incident still open after: 1 hour (2nd alert), 6 hours (3rd alert)
4. Worker increments `alert_sent_count` after each alert sent
5. If count reaches 3 and incident still open, Worker suppresses further alerts until recovery
6. Recovery alert sent when incident closes, regardless of previous count (final alert)
7. Throttling state displayed in incident detail view: "3 alerts sent (throttled)"
8. Configuration option in site settings: "Alert Frequency" dropdown: "Immediate Only (1)" | "Immediate + 1 Reminder (2)" | "Immediate + 2 Reminders (3, default)"
9. Worker logs throttled alerts to Sentry for monitoring: "Incident [id] throttled after 3 alerts"

#### Technical Notes

**Throttling Logic:**

```typescript
export async function handleAlertThrottling(env: Env, incident: Incident, site: Site) {
  const maxAlerts = site.settings_json.max_alerts || 3;

  // Check current alert count
  if (incident.alert_sent_count >= maxAlerts) {
    console.log(`Incident ${incident.id} throttled (${incident.alert_sent_count} alerts sent)`);
    return false; // Don't send
  }

  // Check if it's time for a reminder
  const now = Date.now();
  const openedAt = new Date(incident.opened_at).getTime();
  const hoursSinceOpened = (now - openedAt) / (1000 * 60 * 60);

  const reminderIntervals = [0, 1, 6]; // Initial, 1h, 6h
  const nextReminderIndex = incident.alert_sent_count;

  if (nextReminderIndex >= reminderIntervals.length) {
    return false; // No more reminders
  }

  const nextReminderTime = reminderIntervals[nextReminderIndex];

  if (hoursSinceOpened >= nextReminderTime) {
    // Time to send reminder
    await sendDownAlert(env, site, incident);

    // Increment counter
    await env.SUPABASE.from('uptime_incidents')
      .update({ alert_sent_count: incident.alert_sent_count + 1 })
      .eq('id', incident.id);

    return true;
  }

  return false;
}
```

---

### Story 5.6: Alert Usage Tracking & Overage Billing

**As a** system,  
**I want** to track email and SMS usage per agency and bill overages,  
**so that** costs are covered and users stay within plan limits.

#### Acceptance Criteria

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

#### Technical Notes

**Usage Tracking:**

```typescript
export async function incrementUsage(env: Env, agencyId: string, metric: 'email' | 'sms') {
  const month = new Date().toISOString().substring(0, 7); // YYYY-MM

  const { data: usage } = await env.SUPABASE.from('usage_counters')
    .select('*')
    .eq('agency_id', agencyId)
    .eq('metric', metric)
    .eq('month', month)
    .single();

  if (usage) {
    await env.SUPABASE.from('usage_counters')
      .update({ used: usage.used + 1 })
      .eq('id', usage.id);
  } else {
    // Get agency tier to determine cap
    const { data: agency } = await env.SUPABASE.from('agencies')
      .select('tier')
      .eq('id', agencyId)
      .single();

    const caps = {
      email: { base: 100, pro: 500, agency: 5000 },
      sms: { base: 0, pro: 0, agency: 0 }, // SMS always metered
    };

    await env.SUPABASE.from('usage_counters').insert({
      agency_id: agencyId,
      metric,
      month,
      used: 1,
      cap: caps[metric][agency.tier],
    });
  }
}
```

---

### Story 5.7: Alert Delivery Reliability & Retries

**As a** system,  
**I want** to retry failed alert deliveries and log failures,  
**so that** users reliably receive notifications even during service disruptions.

#### Acceptance Criteria

1. Worker implements retry logic with exponential backoff: attempt 1 (immediate), attempt 2 (+30s), attempt 3 (+120s)
2. SES/Twilio errors categorized: Transient (429, 503) → retry, Permanent (400, 404) → log and abort
3. Failed alerts logged to `alerts_sent.meta.error` JSON field
4. After 3 failed attempts, Worker logs error to Sentry with full context (incident_id, recipient, error message)
5. Dashboard displays alert delivery status in incident timeline: "✓ Email sent to admin@example.com" or "✗ SMS failed (invalid number)"
6. Retry queue implemented using Cloudflare Durable Objects or separate `alert_queue` table
7. Alert delivery SLA: 95% delivered within 30 seconds, 99% within 5 minutes
8. Monitoring dashboard (internal) shows alert success rate, average delivery time, failure reasons
9. User notification shown if all delivery attempts fail: "Alert delivery failed. Check settings."

#### Technical Notes

**Retry Logic:**

```typescript
async function sendWithRetry(sendFn: () => Promise<void>, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await sendFn();
      return { success: true, attempts: attempt };
    } catch (error) {
      const isTransient = error.code === 429 || error.code === 503;

      if (attempt === maxAttempts || !isTransient) {
        return { success: false, attempts: attempt, error: error.message };
      }

      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export async function sendAlertWithRetry(env: Env, site: Site, incident: Incident) {
  const result = await sendWithRetry(async () => {
    await sendDownAlert(env, site, incident);
  });

  if (!result.success) {
    console.error(`Alert delivery failed after ${result.attempts} attempts:`, result.error);

    // Log to Sentry
    Sentry.captureException(new Error(`Alert delivery failed: ${result.error}`), {
      extra: {
        incident_id: incident.id,
        site_id: site.id,
        attempts: result.attempts,
      },
    });
  }

  return result;
}
```

---

## Epic Completion Checklist

- [ ] All 7 stories completed and tested
- [ ] AWS SES configured and email alerts working
- [ ] Twilio SMS integration functional
- [ ] Multi-recipient management implemented
- [ ] Quiet hours respecting timezones
- [ ] Per-incident throttling preventing spam
- [ ] Usage tracking and overage billing operational
- [ ] Alert delivery reliability >95% within 30s
- [ ] End-to-end alert workflow validated
- [ ] Ready for Epic 6: Billing & Subscription Management

---

## Dependencies & Prerequisites

**Requires Epics 1, 2, 3, 4 Completion:**

- Incident tracking system
- Sites infrastructure
- Tier management

**New Services Needed:**

- AWS SES account with verified domain
- Twilio account with phone number
- SES SMTP credentials
- Twilio API credentials

**After Epic 5 Completion:**

- Users notified of all incidents
- Multiple alert channels operational
- Usage tracking for billing ready
- Foundation for Epic 6 metered billing
