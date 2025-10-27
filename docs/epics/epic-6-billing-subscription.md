# Epic 6: Billing & Subscription Management

**Status:** Draft  
**Version:** 1.0  
**Date:** 2025-10-26  
**Author:** Kyle Baker

---

## Epic Goal

Integrate Stripe for subscription management with three tiers (Base, Pro, Agency), implement metered usage billing for email/SMS overages, handle trial-to-paid conversion, enforce dunning flow with service pause/resume, and synchronize subscription state with Worker behavior.

## Epic Scope

This epic delivers complete billing capabilities:

- Stripe product catalog for all tiers
- Checkout flow and subscription creation
- Webhook synchronization with database
- Trial management and conversion
- Dunning flow with service pause
- Plan upgrades and downgrades
- Metered usage reporting for overages
- Cancellation and refund handling

**Success Criteria:** Users can subscribe, trial, upgrade/downgrade plans, experience reliable billing with automatic retry logic, and have metered usage accurately billed through Stripe.

---

## Stories

### Story 6.1: Stripe Product Catalog Setup

**As a** developer,  
**I want** Stripe products and prices configured for all subscription tiers,  
**so that** users can subscribe and billing is automated.

#### Acceptance Criteria

1. Stripe account created with test and live mode environments
2. Three recurring products created in Stripe: "Base", "Pro", "Agency"
3. Prices configured: Base $1/site/month (per-unit pricing), Pro $5/site/month (per-unit), Agency $25/month (fixed, represents 25-site bundle)
4. Metered products created: "Email Overage" ($0.01 per email), "SMS Alert" ($0.016 per SMS)
5. Products tagged with metadata: `tier=base|pro|agency`, `sites_included=1|1|25`
6. Stripe Tax enabled for automatic tax calculation
7. Test mode configuration matches live mode structure
8. Stripe publishable key and webhook secret stored in environment variables (Netlify for frontend, Cloudflare Secrets for Workers)
9. Product/price IDs documented in `docs/billing/stripe-catalog.md`

#### Technical Notes

**Stripe Configuration Script:**
```typescript
// scripts/setup-stripe-catalog.ts
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
})

async function setupCatalog() {
  // Base Tier
  const baseProduct = await stripe.products.create({
    name: 'Website Mage Base',
    description: 'Essential monitoring for individual sites',
    metadata: { tier: 'base', sites_included: '1' }
  })
  
  const basePrice = await stripe.prices.create({
    product: baseProduct.id,
    unit_amount: 100, // $1.00
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { tier: 'base' }
  })
  
  // Pro Tier
  const proProduct = await stripe.products.create({
    name: 'Website Mage Pro',
    description: 'Advanced monitoring with faster checks',
    metadata: { tier: 'pro', sites_included: '1' }
  })
  
  const proPrice = await stripe.prices.create({
    product: proProduct.id,
    unit_amount: 500, // $5.00
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { tier: 'pro' }
  })
  
  // Agency Tier
  const agencyProduct = await stripe.products.create({
    name: 'Website Mage Agency',
    description: 'White-label solution for agencies',
    metadata: { tier: 'agency', sites_included: '25' }
  })
  
  const agencyPrice = await stripe.prices.create({
    product: agencyProduct.id,
    unit_amount: 2500, // $25.00 (25-site bundle)
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { tier: 'agency' }
  })
  
  // Metered Usage Products
  const emailOverageProduct = await stripe.products.create({
    name: 'Email Overage',
    description: 'Additional email alerts beyond plan limit'
  })
  
  const emailOveragePrice = await stripe.prices.create({
    product: emailOverageProduct.id,
    unit_amount: 1, // $0.01
    currency: 'usd',
    recurring: {
      interval: 'month',
      usage_type: 'metered'
    }
  })
  
  const smsProduct = await stripe.products.create({
    name: 'SMS Alerts',
    description: 'SMS alert delivery'
  })
  
  const smsPrice = await stripe.prices.create({
    product: smsProduct.id,
    unit_amount: 2, // $0.016 rounded to $0.02
    currency: 'usd',
    recurring: {
      interval: 'month',
      usage_type: 'metered'
    }
  })
  
  console.log('Stripe catalog created successfully')
  console.log({
    base: { product: baseProduct.id, price: basePrice.id },
    pro: { product: proProduct.id, price: proPrice.id },
    agency: { product: agencyProduct.id, price: agencyPrice.id },
    email_overage: { product: emailOverageProduct.id, price: emailOveragePrice.id },
    sms: { product: smsProduct.id, price: smsPrice.id }
  })
}

setupCatalog()
```

**Environment Variables:**
```env
# .env
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Price IDs (copy from script output)
STRIPE_PRICE_BASE=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_AGENCY=price_...
STRIPE_PRICE_EMAIL_OVERAGE=price_...
STRIPE_PRICE_SMS=price_...
```

---

### Story 6.2: Checkout Flow & Subscription Creation

**As a** new user,  
**I want** to select a subscription plan and complete checkout,  
**so that** I can start monitoring sites immediately.

#### Acceptance Criteria

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

#### Technical Notes

**Billing Page Component:**
```vue
<template>
  <div class="billing-page">
    <h1>Choose Your Plan</h1>
    
    <div class="plan-cards">
      <div v-for="plan in plans" :key="plan.tier" class="plan-card">
        <div class="plan-header">
          <h2>{{ plan.name }}</h2>
          <div class="price">
            <span class="amount">${{ plan.price }}</span>
            <span class="unit">{{ plan.priceUnit }}</span>
          </div>
        </div>
        
        <ul class="features">
          <li v-for="feature in plan.features" :key="feature">{{ feature }}</li>
        </ul>
        
        <button 
          @click="selectPlan(plan.tier)"
          :class="{ 'btn-current': isCurrentPlan(plan.tier) }"
        >
          {{ isCurrentPlan(plan.tier) ? 'Current Plan' : 'Select Plan' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
const plans = [
  {
    tier: 'base',
    name: 'Base',
    price: 1,
    priceUnit: '/site/month',
    features: [
      '10-minute uptime checks',
      'Monthly PSI scans',
      '1% RUM sampling',
      '100 email alerts/month',
      '1 alert recipient'
    ]
  },
  {
    tier: 'pro',
    name: 'Pro',
    price: 5,
    priceUnit: '/site/month',
    features: [
      '5-minute uptime checks',
      'Weekly PSI scans',
      '5% RUM sampling',
      '500 email alerts/month',
      'SSL & DNS monitoring',
      '3 alert recipients'
    ]
  },
  {
    tier: 'agency',
    name: 'Agency',
    price: 25,
    priceUnit: '/month (25 sites)',
    features: [
      '5-minute uptime checks',
      'Weekly PSI scans',
      '10% RUM sampling',
      '5,000 email alerts/month',
      'White-label branding',
      'Client dashboards',
      '10 alert recipients per site'
    ]
  }
]

async function selectPlan(tier: string) {
  const priceIds = {
    base: import.meta.env.VITE_STRIPE_PRICE_BASE,
    pro: import.meta.env.VITE_STRIPE_PRICE_PRO,
    agency: import.meta.env.VITE_STRIPE_PRICE_AGENCY
  }
  
  const response = await $fetch('/api/billing/create-checkout', {
    method: 'POST',
    body: {
      price_id: priceIds[tier],
      quantity: tier === 'agency' ? 1 : 1 // Default 1 site or 1 bundle
    }
  })
  
  // Redirect to Stripe Checkout
  window.location.href = response.url
}
</script>
```

**API Endpoint:**
```typescript
// packages/workers/api/src/routes/billing.ts
import { Hono } from 'hono'
import Stripe from 'stripe'

const billing = new Hono()

billing.post('/create-checkout', async (c) => {
  const { price_id, quantity } = await c.req.json()
  const user = c.get('user') // from auth middleware
  
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16'
  })
  
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: user.email,
    line_items: [
      {
        price: price_id,
        quantity: quantity
      }
    ],
    metadata: {
      agency_id: user.agency_id,
      user_id: user.id
    },
    subscription_data: {
      trial_period_days: 30,
      metadata: {
        agency_id: user.agency_id
      }
    },
    success_url: `https://app.websitemage.com/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `https://app.websitemage.com/billing`,
    automatic_tax: { enabled: true }
  })
  
  return c.json({ url: session.url })
})

export default billing
```

---

### Story 6.3: Stripe Webhook Handler

**As a** system,  
**I want** to process Stripe webhooks to keep subscription state synchronized,  
**so that** billing changes reflect immediately in the application.

#### Acceptance Criteria

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

#### Technical Notes

**Webhook Worker:**
```typescript
// packages/workers/stripe-webhook/src/index.ts
import { Hono } from 'hono'
import Stripe from 'stripe'

const app = new Hono()

app.post('/webhooks/stripe', async (c) => {
  const signature = c.req.header('stripe-signature')
  const body = await c.req.text()
  
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16'
  })
  
  let event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      c.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (error) {
    console.error('Webhook signature verification failed:', error)
    return c.json({ error: 'Invalid signature' }, 400)
  }
  
  // Check idempotency
  const { data: existing } = await c.env.SUPABASE
    .from('webhook_events')
    .select('id')
    .eq('stripe_event_id', event.id)
    .single()
  
  if (existing) {
    console.log(`Event ${event.id} already processed`)
    return c.json({ received: true })
  }
  
  try {
    await handleWebhookEvent(c.env, event)
    
    // Log webhook event
    await c.env.SUPABASE
      .from('webhook_events')
      .insert({
        stripe_event_id: event.id,
        type: event.type,
        processed_at: new Date().toISOString()
      })
    
    return c.json({ received: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return c.json({ error: 'Processing failed' }, 500)
  }
})

async function handleWebhookEvent(env: Env, event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutComplete(env, event.data.object as Stripe.Checkout.Session)
      break
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(env, event.data.object as Stripe.Subscription)
      break
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(env, event.data.object as Stripe.Subscription)
      break
    case 'invoice.payment_succeeded':
      await handlePaymentSucceeded(env, event.data.object as Stripe.Invoice)
      break
    case 'invoice.payment_failed':
      await handlePaymentFailed(env, event.data.object as Stripe.Invoice)
      break
  }
}

async function handleCheckoutComplete(env: Env, session: Stripe.Checkout.Session) {
  const agencyId = session.metadata.agency_id
  const subscription = session.subscription as string
  
  await env.SUPABASE
    .from('subscriptions')
    .insert({
      agency_id: agencyId,
      stripe_subscription_id: subscription,
      stripe_customer_id: session.customer as string,
      status: 'trialing', // 30-day trial
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    })
  
  console.log(`Subscription created for agency ${agencyId}`)
}

async function handleSubscriptionUpdated(env: Env, subscription: Stripe.Subscription) {
  await env.SUPABASE
    .from('subscriptions')
    .update({
      status: subscription.status,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
    })
    .eq('stripe_subscription_id', subscription.id)
}

async function handlePaymentSucceeded(env: Env, invoice: Stripe.Invoice) {
  const subscription = invoice.subscription as string
  
  await env.SUPABASE
    .from('subscriptions')
    .update({ status: 'active' })
    .eq('stripe_subscription_id', subscription)
  
  // Resume services
  const { data: sub } = await env.SUPABASE
    .from('subscriptions')
    .select('agency_id')
    .eq('stripe_subscription_id', subscription)
    .single()
  
  if (sub) {
    await env.SUPABASE
      .from('agencies')
      .update({ service_paused: false })
      .eq('id', sub.agency_id)
  }
}

async function handlePaymentFailed(env: Env, invoice: Stripe.Invoice) {
  const subscription = invoice.subscription as string
  
  await env.SUPABASE
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('stripe_subscription_id', subscription)
  
  // Trigger dunning email (Epic 5 integration)
  // await sendDunningEmail(env, subscription)
}

export default app
```

---

### Story 6.4: Trial Management & Conversion

**As a** new user,  
**I want** a 1-month free trial to test the platform,  
**so that** I can evaluate value before committing to payment.

#### Acceptance Criteria

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

#### Technical Notes

**Trial Reminder Worker:**
```typescript
// packages/workers/cron/src/trial-reminders.ts
export async function sendTrialReminders(env: Env) {
  const fiveDaysFromNow = new Date()
  fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5)
  
  const oneDayFromNow = new Date()
  oneDayFromNow.setDate(oneDayFromNow.getDate() + 1)
  
  // Get subscriptions expiring in 5 days
  const { data: expiring5d } = await env.SUPABASE
    .from('subscriptions')
    .select('*, agencies(admin_email)')
    .eq('status', 'trialing')
    .lte('current_period_end', fiveDaysFromNow.toISOString())
    .gte('current_period_end', oneDayFromNow.toISOString())
    .is('reminder_5d_sent', null)
  
  for (const sub of expiring5d || []) {
    await sendEmail(env, {
      to: sub.agencies.admin_email,
      subject: 'Your Website Mage trial ends in 5 days',
      body: `Your trial ends on ${sub.current_period_end}. You'll be automatically charged unless you cancel.`
    })
    
    await env.SUPABASE
      .from('subscriptions')
      .update({ reminder_5d_sent: true })
      .eq('id', sub.id)
  }
  
  // Get subscriptions expiring in 1 day
  const { data: expiring1d } = await env.SUPABASE
    .from('subscriptions')
    .select('*, agencies(admin_email)')
    .eq('status', 'trialing')
    .lte('current_period_end', oneDayFromNow.toISOString())
    .is('reminder_1d_sent', null)
  
  for (const sub of expiring1d || []) {
    await sendEmail(env, {
      to: sub.agencies.admin_email,
      subject: 'Your Website Mage trial ends tomorrow',
      body: `Your trial ends tomorrow. You'll be charged unless you cancel today.`
    })
    
    await env.SUPABASE
      .from('subscriptions')
      .update({ reminder_1d_sent: true })
      .eq('id', sub.id)
  }
}
```

---

### Story 6.5: Dunning Flow & Service Pause

**As a** system,  
**I want** to handle failed payments with retry attempts and service degradation,  
**so that** we recover revenue while protecting costs.

#### Acceptance Criteria

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

#### Technical Notes

**Service Pause Logic:**
```typescript
// In webhook handler
async function handlePaymentFailed(env: Env, invoice: Stripe.Invoice) {
  const subscription = invoice.subscription as string
  
  await env.SUPABASE
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('stripe_subscription_id', subscription)
  
  const { data: sub } = await env.SUPABASE
    .from('subscriptions')
    .select('agency_id, attempt_count')
    .eq('stripe_subscription_id', subscription)
    .single()
  
  const attemptCount = (sub.attempt_count || 0) + 1
  
  await env.SUPABASE
    .from('subscriptions')
    .update({ attempt_count: attemptCount })
    .eq('id', sub.id)
  
  // Send dunning email
  await sendDunningEmail(env, sub.agency_id, attemptCount)
  
  // If final attempt failed, pause service
  if (attemptCount >= 4) {
    await env.SUPABASE
      .from('agencies')
      .update({ service_paused: true })
      .eq('id', sub.agency_id)
    
    await env.SUPABASE
      .from('subscriptions')
      .update({ status: 'unpaid' })
      .eq('id', sub.id)
    
    console.log(`Service paused for agency ${sub.agency_id}`)
  }
}
```

**Worker Checks:**
```typescript
// In uptime/psi/rum workers
export async function shouldProcessAgency(env: Env, agencyId: string): Promise<boolean> {
  const { data: agency } = await env.SUPABASE
    .from('agencies')
    .select('service_paused')
    .eq('id', agencyId)
    .single()
  
  if (agency?.service_paused) {
    console.log(`Skipping paused agency ${agencyId}`)
    return false
  }
  
  return true
}
```

---

### Story 6.6: Plan Upgrades & Downgrades

**As a** user,  
**I want** to change my subscription plan and site quantity,  
**so that** my plan matches my current needs.

#### Acceptance Criteria

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

#### Technical Notes

**Plan Change API:**
```typescript
billing.post('/change-plan', async (c) => {
  const { new_price_id, quantity } = await c.req.json()
  const user = c.get('user')
  
  const { data: subscription } = await c.env.SUPABASE
    .from('subscriptions')
    .select('stripe_subscription_id')
    .eq('agency_id', user.agency_id)
    .single()
  
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16'
  })
  
  // Get current subscription
  const stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id)
  
  // Determine if upgrade or downgrade
  const currentAmount = stripeSub.items.data[0].price.unit_amount
  const newPrice = await stripe.prices.retrieve(new_price_id)
  const isUpgrade = newPrice.unit_amount > currentAmount
  
  if (isUpgrade) {
    // Immediate upgrade with proration
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      items: [{
        id: stripeSub.items.data[0].id,
        price: new_price_id,
        quantity: quantity
      }],
      proration_behavior: 'always_invoice'
    })
    
    return c.json({ message: 'Plan upgraded successfully', immediate: true })
  } else {
    // Downgrade at period end
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      items: [{
        id: stripeSub.items.data[0].id,
        price: new_price_id,
        quantity: quantity
      }],
      proration_behavior: 'none',
      billing_cycle_anchor: 'unchanged'
    })
    
    return c.json({ 
      message: 'Plan change scheduled',
      immediate: false,
      effective_date: new Date(stripeSub.current_period_end * 1000)
    })
  }
})
```

---

### Story 6.7: Metered Usage Reporting to Stripe

**As a** system,  
**I want** to report metered usage (email overages, SMS) to Stripe for billing,  
**so that** users are charged accurately for usage beyond plan limits.

#### Acceptance Criteria

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

#### Technical Notes

**Metered Usage Worker:**
```typescript
// packages/workers/cron/src/metered-usage.ts
export async function reportMeteredUsage(env: Env) {
  const lastMonth = new Date()
  lastMonth.setMonth(lastMonth.getMonth() - 1)
  const monthStr = lastMonth.toISOString().substring(0, 7)
  
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16'
  })
  
  // Get all agencies with subscriptions
  const { data: subscriptions } = await env.SUPABASE
    .from('subscriptions')
    .select('*, agencies(*), usage_counters(*)')
    .eq('status', 'active')
  
  for (const sub of subscriptions || []) {
    // Email overages
    const emailUsage = sub.usage_counters.find(u => u.metric === 'email' && u.month === monthStr)
    if (emailUsage && emailUsage.used > emailUsage.cap) {
      const overage = emailUsage.used - emailUsage.cap
      
      try {
        await stripe.subscriptionItems.createUsageRecord(
          sub.email_overage_item_id,
          {
            quantity: overage,
            timestamp: Math.floor(Date.now() / 1000),
            action: 'set'
          },
          { idempotencyKey: `${sub.agency_id}_${monthStr}_email` }
        )
        
        console.log(`Reported ${overage} email overages for ${sub.agency_id}`)
      } catch (error) {
        console.error(`Failed to report email usage:`, error)
      }
    }
    
    // SMS usage
    const smsUsage = sub.usage_counters.find(u => u.metric === 'sms' && u.month === monthStr)
    if (smsUsage && smsUsage.used > 0) {
      try {
        await stripe.subscriptionItems.createUsageRecord(
          sub.sms_item_id,
          {
            quantity: smsUsage.used,
            timestamp: Math.floor(Date.now() / 1000),
            action: 'set'
          },
          { idempotencyKey: `${sub.agency_id}_${monthStr}_sms` }
        )
        
        console.log(`Reported ${smsUsage.used} SMS for ${sub.agency_id}`)
      } catch (error) {
        console.error(`Failed to report SMS usage:`, error)
      }
    }
  }
}
```

---

### Story 6.8: Cancellation & Refund Policy

**As a** user,  
**I want** to cancel my subscription and understand refund terms,  
**so that** I can discontinue service if needed.

#### Acceptance Criteria

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

#### Technical Notes

**Cancellation Flow:**
- User manages cancellation through Stripe Customer Portal
- Webhook `customer.subscription.updated` with `cancel_at_period_end=true` triggers dashboard notification
- On period end, webhook `customer.subscription.deleted` marks subscription as canceled and pauses services

---

## Epic Completion Checklist

- [ ] All 8 stories completed and tested
- [ ] Stripe catalog configured for all tiers
- [ ] Checkout and subscription creation working
- [ ] Webhook handler processing all events
- [ ] Trial management functional
- [ ] Dunning flow and service pause operational
- [ ] Plan upgrades/downgrades working
- [ ] Metered usage reporting to Stripe
- [ ] Cancellation flow verified
- [ ] End-to-end billing tested in Stripe test mode
- [ ] Ready for Epic 7: Agency Features & Reporting

---

## Dependencies & Prerequisites

**Requires Epic 5 Completion:**
- Alert usage tracking for metered billing

**New Services Needed:**
- Stripe account (test and live mode)
- Stripe Tax configuration
- Webhook endpoint configured in Stripe Dashboard

**After Epic 6 Completion:**
- Subscription management fully operational
- Revenue collection automated
- Metered billing tracking usage
- Foundation for agency white-label features (Epic 7)
