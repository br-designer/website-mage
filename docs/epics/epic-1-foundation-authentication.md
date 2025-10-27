# Epic 1: Foundation & Authentication

**Status:** Draft  
**Version:** 1.0  
**Date:** 2025-10-26  
**Author:** Kyle Baker

---

## Epic Goal

Establish the technical foundation including monorepo structure, core services setup (Supabase, Netlify, Cloudflare Workers), CI/CD pipeline, OAuth authentication, and database schema. Deliver a working login flow and simple health check dashboard to validate the architecture end-to-end.

## Epic Scope

This epic delivers the foundational infrastructure required for all subsequent development:

- Monorepo setup with PNPM workspaces and Turborepo
- Supabase project initialization with core database schema and RLS
- Nuxt 4 SSR application with authentication and basic routing
- OAuth integration (Google, Microsoft, GitHub)
- Cloudflare Workers API gateway with rate limiting
- CI/CD pipeline with automated testing and deployment
- Simple dashboard confirming end-to-end functionality

**Success Criteria:** A logged-in user can view a dashboard showing their agency name and system health status, demonstrating successful integration of all core systems.

---

## Stories

### Story 1.1: Monorepo Setup & Project Scaffolding

**As a** developer,  
**I want** a properly configured monorepo with all core dependencies and build tools,  
**so that** I can develop frontend and backend code with shared utilities efficiently.

#### Acceptance Criteria

1. Repository initialized with PNPM workspaces and Turborepo configuration
2. Workspace structure created with `packages/web` (Nuxt 4), `packages/workers` (Cloudflare Workers), `packages/shared` (shared types/utils)
3. TypeScript 5.3+ configured with strict mode and path aliases
4. ESLint, Prettier, and commitlint configured with pre-commit hooks
5. Root `package.json` includes workspace scripts: `dev`, `build`, `test`, `lint`
6. README documents setup instructions and workspace structure
7. `.gitignore` properly excludes `node_modules`, `.nuxt`, `dist`, `.wrangler`, and environment files

#### Technical Notes

**Source Tree Structure:**
```
website-mage/
├── packages/
│   ├── web/              # Nuxt 4 frontend
│   ├── workers/          # Cloudflare Workers
│   ├── rum-js/           # RUM JavaScript
│   └── shared/           # Shared utilities
├── package.json          # Root with workspaces
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.json
```

**Key Technologies:**
- PNPM 8.15.0 (workspace management)
- Turborepo 1.12.0 (build orchestration)
- TypeScript 5.3.3 (strict mode)
- ESLint 8.56.0 + Prettier 3.2.0
- Husky 9.0.0 (git hooks)
- commitlint 18.6.0 (conventional commits)

**Architecture Reference:** See `docs/architecture.md` - Source Tree section

---

### Story 1.2: Supabase Project Setup & Core Schema

**As a** developer,  
**I want** a Supabase project with core database schema and RLS policies,  
**so that** I can store multi-tenant data securely with authentication ready.

#### Acceptance Criteria

1. Supabase project created for dev/staging/production environments
2. Database migration created for core tables: `agencies`, `agency_members`, `sites`, `users` (Supabase Auth native)
3. Enums created: `agency_tier` (base/pro/agency), `member_role` (admin/staff/client)
4. RLS policies enabled on all tables with `is_member_of()` helper function
5. Foreign key constraints and indexes created per schema design
6. Seed data script populates dev/staging with 1 test agency, 1 admin user, 3 demo sites
7. Supabase URL and anon key configured in workspace environment variables

#### Technical Notes

**Database Schema (Core Tables):**
```sql
-- Enums
CREATE TYPE agency_tier AS ENUM ('base', 'pro', 'agency', 'enterprise_future');
CREATE TYPE member_role AS ENUM ('admin', 'staff', 'client');

-- agencies
CREATE TABLE public.agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tier agency_tier NOT NULL DEFAULT 'base',
  branding_json JSONB NOT NULL DEFAULT '{}',
  custom_domain TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- agency_members
CREATE TABLE public.agency_members (
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role member_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (agency_id, user_id)
);

-- sites (basic structure for Epic 1)
CREATE TABLE public.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agency_id, domain)
);
```

**RLS Helper Function:**
```sql
CREATE OR REPLACE FUNCTION is_member_of(ag_id UUID) RETURNS BOOLEAN
LANGUAGE SQL STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM agency_members
    WHERE agency_id = ag_id AND user_id = auth.uid()
  );
$$;
```

**Seed Data (dev/staging only):**
- 1 test agency: `name='Test Agency'`, `tier='pro'`
- 1 admin user: linked via OAuth (use your test Google account)
- 3 demo sites: `example.com`, `test.com`, `demo.com`

**Environment Variables:**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY` (Workers only)

**Architecture Reference:** See `docs/architecture.md` - Database Schema section

---

### Story 1.3: Nuxt 4 Application Foundation

**As a** developer,  
**I want** a Nuxt 4 SSR application with routing, plugins, and Supabase integration,  
**so that** I can build authenticated dashboard pages.

#### Acceptance Criteria

1. Nuxt 4 initialized in `packages/web` with TypeScript and SSR enabled
2. TailwindCSS configured with custom color tokens (purple/blue primary, green/yellow/red status)
3. Pinia store configured for state management
4. `@supabase/nuxt` plugin integrated with auth helpers
5. `@sentry/nuxt` plugin configured with DSN from environment
6. Layout created with header, nav placeholder, and main content area
7. Basic pages created: `/login`, `/dashboard`, `/sites`, `/settings`
8. Middleware configured to redirect unauthenticated users to `/login`
9. Application runs locally on `localhost:3000` and displays placeholder "Website Mage Dashboard"

#### Technical Notes

**Nuxt Structure:**
```
packages/web/
├── app/
│   ├── components/
│   │   └── ui/
│   │       ├── Button.vue
│   │       ├── Card.vue
│   │       └── Badge.vue
│   ├── composables/
│   │   ├── useAuth.ts
│   │   └── useSupabase.ts
│   ├── layouts/
│   │   └── default.vue
│   ├── pages/
│   │   ├── login.vue
│   │   ├── dashboard.vue
│   │   ├── sites/
│   │   │   └── index.vue
│   │   └── settings/
│   │       └── index.vue
│   ├── middleware/
│   │   └── auth.ts
│   ├── plugins/
│   │   ├── supabase.ts
│   │   └── sentry.client.ts
│   └── stores/
│       └── user.ts
├── nuxt.config.ts
├── tailwind.config.ts
└── package.json
```

**Key Dependencies:**
```json
{
  "dependencies": {
    "nuxt": "^4.0.0",
    "@supabase/suxt": "^1.0.0",
    "@sentry/nuxt": "^7.100.0",
    "pinia": "^2.1.7",
    "@pinia/nuxt": "^0.5.0"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.1",
    "@nuxtjs/tailwindcss": "^6.11.0"
  }
}
```

**TailwindCSS Custom Colors:**
```js
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f3ff',
          500: '#8b5cf6',  // Purple
          600: '#7c3aed',
        },
        status: {
          success: '#10b981',  // Green
          warning: '#f59e0b',  // Yellow
          error: '#ef4444',    // Red
        }
      }
    }
  }
}
```

**Middleware (auth.ts):**
```typescript
export default defineNuxtRouteMiddleware((to, from) => {
  const user = useSupabaseUser()
  
  if (!user.value && to.path !== '/login') {
    return navigateTo('/login')
  }
})
```

**Architecture Reference:** See `docs/architecture.md` - Components (Nuxt Frontend) section

---

### Story 1.4: OAuth Authentication Flow

**As a** user,  
**I want** to log in using Google, Microsoft, or GitHub,  
**so that** I can access my dashboard securely without managing passwords.

#### Acceptance Criteria

1. Login page displays OAuth buttons for Google, Microsoft, GitHub
2. Supabase Auth configured with OAuth providers and redirect URLs
3. Successful OAuth flow creates/retrieves user in Supabase Auth
4. New user automatically creates default agency with "base" tier and "admin" role in `agency_members`
5. Session token stored in secure HTTP-only cookie
6. Successful login redirects to `/dashboard`
7. Logout button clears session and redirects to `/login`
8. Middleware enforces authentication on protected routes
9. User's name/email/avatar displayed in header after login

#### Technical Notes

**Supabase OAuth Configuration:**
- Configure in Supabase Dashboard → Authentication → Providers
- Enable: Google, Microsoft (Azure AD), GitHub
- Redirect URLs: 
  - Dev: `http://localhost:3000/auth/callback`
  - Staging: `https://staging.websitemage.com/auth/callback`
  - Prod: `https://app.websitemage.com/auth/callback`

**Login Page Component:**
```vue
<template>
  <div class="flex min-h-screen items-center justify-center">
    <div class="w-full max-w-md space-y-4">
      <h1 class="text-2xl font-bold">Welcome to Website Mage</h1>
      
      <button @click="signInWithGoogle" class="btn-primary">
        Sign in with Google
      </button>
      
      <button @click="signInWithMicrosoft" class="btn-primary">
        Sign in with Microsoft
      </button>
      
      <button @click="signInWithGitHub" class="btn-primary">
        Sign in with GitHub
      </button>
    </div>
  </div>
</template>

<script setup>
const supabase = useSupabaseClient()

async function signInWithGoogle() {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: '/dashboard' }
  })
}
// Similar for Microsoft and GitHub
</script>
```

**Post-Login Agency Creation Logic:**
```typescript
// In auth callback handler or middleware
const user = useSupabaseUser()

if (user.value) {
  // Check if user has agency
  const { data: membership } = await supabase
    .from('agency_members')
    .select('agency_id')
    .eq('user_id', user.value.id)
    .single()
  
  if (!membership) {
    // Create default agency
    const { data: agency } = await supabase
      .from('agencies')
      .insert({ 
        name: `${user.value.user_metadata.name}'s Agency`,
        tier: 'base'
      })
      .select()
      .single()
    
    // Create membership
    await supabase
      .from('agency_members')
      .insert({
        agency_id: agency.id,
        user_id: user.value.id,
        role: 'admin'
      })
  }
}
```

**Architecture Reference:** See `docs/architecture.md` - Core Workflows (User Login)

---

### Story 1.5: Cloudflare Workers API Gateway

**As a** developer,  
**I want** a Cloudflare Worker serving as the API gateway with rate limiting and Supabase connection,  
**so that** I can proxy requests securely and enforce per-tenant limits.

#### Acceptance Criteria

1. Worker created in `packages/workers/api` with TypeScript
2. Worker handles GET `/health` endpoint returning `{status: "ok", timestamp: ISO}`
3. Worker configured with Supabase service key in Cloudflare Secrets
4. Worker bindings configured: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `RATE_LIMIT_KV` namespace
5. Rate limiting middleware implemented using KV with per-agency counter (60 req/min default)
6. CORS headers configured to allow `app.websitemage.com` origin
7. Worker deployed to `api.websitemage.com` route
8. Nuxt app successfully calls `/health` endpoint and displays result on dashboard
9. Rate limiting returns 429 with `Retry-After` header when exceeded

#### Technical Notes

**Worker Structure:**
```
packages/workers/api/
├── src/
│   ├── index.ts           # Main entry (Hono router)
│   ├── routes/
│   │   └── health.ts
│   ├── middleware/
│   │   ├── cors.ts
│   │   └── rateLimit.ts
│   └── utils/
│       └── supabase.ts
├── wrangler.toml
└── package.json
```

**wrangler.toml:**
```toml
name = "websitemage-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[env.production]
route = "api.websitemage.com/*"

[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "your-kv-namespace-id"

[vars]
SUPABASE_URL = "https://your-project.supabase.co"

# Secrets (set via: wrangler secret put SUPABASE_SERVICE_KEY)
# SUPABASE_SERVICE_KEY
```

**Health Endpoint (routes/health.ts):**
```typescript
import { Hono } from 'hono'

const health = new Hono()

health.get('/', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'websitemage-api',
    version: '1.0.0'
  })
})

export default health
```

**Rate Limiting Middleware:**
```typescript
// middleware/rateLimit.ts
export async function rateLimit(c, next) {
  const agencyId = c.req.header('X-Agency-ID') || 'anonymous'
  const key = `ratelimit:${agencyId}:${Math.floor(Date.now() / 60000)}`
  
  const count = await c.env.RATE_LIMIT_KV.get(key)
  const limit = 60 // 60 requests per minute
  
  if (count && parseInt(count) >= limit) {
    return c.json({ error: 'Rate limit exceeded' }, 429, {
      'Retry-After': '60'
    })
  }
  
  await c.env.RATE_LIMIT_KV.put(key, String((parseInt(count || '0') + 1)), {
    expirationTtl: 60
  })
  
  await next()
}
```

**Main Router (index.ts):**
```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import health from './routes/health'
import { rateLimit } from './middleware/rateLimit'

const app = new Hono()

app.use('*', cors({
  origin: ['https://app.websitemage.com', 'http://localhost:3000'],
  credentials: true
}))

app.use('*', rateLimit)

app.route('/health', health)

export default app
```

**Key Dependencies:**
- `hono`: ^4.0.0 (lightweight router for Workers)
- `@supabase/supabase-js`: ^2.39.0

**Deployment:**
```bash
cd packages/workers/api
wrangler deploy
```

**Architecture Reference:** See `docs/architecture.md` - Components (Cloudflare Workers)

---

### Story 1.6: CI/CD Pipeline Setup

**As a** developer,  
**I want** automated CI/CD pipelines for testing and deployment,  
**so that** code changes are validated and deployed consistently.

#### Acceptance Criteria

1. GitHub Actions workflow created: `.github/workflows/ci.yml`
2. CI runs on all PRs: `pnpm lint`, `pnpm test`, `pnpm build`
3. CI requires ≥90% test pass rate to succeed
4. Netlify connected to repository with auto-deploy on `main` branch to staging
5. Netlify preview deploys created for all PRs
6. Cloudflare Workers deploy configured via GitHub Action on `main` merge
7. Database migrations automatically applied to staging environment
8. Deployment status posted to Slack `#dev-ops` channel
9. Rollback procedure documented in `docs/ops/rollback.md`

#### Technical Notes

**GitHub Actions CI Workflow (.github/workflows/ci.yml):**
```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: 8.15.0
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20.11.0'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Lint
        run: pnpm lint
      
      - name: Type check
        run: pnpm typecheck
      
      - name: Test
        run: pnpm test
        env:
          CI: true
      
      - name: Build
        run: pnpm build

  deploy-workers:
    if: github.ref == 'refs/heads/main'
    needs: lint-and-test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: 8.15.0
      
      - name: Deploy Workers
        run: pnpm --filter "./packages/workers/*" deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

**Netlify Configuration (netlify.toml):**
```toml
[build]
  base = "packages/web"
  command = "pnpm build"
  publish = ".output/public"

[build.environment]
  NODE_VERSION = "20.11.0"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[context.production]
  environment = { NUXT_PUBLIC_SUPABASE_URL = "https://prod.supabase.co" }

[context.deploy-preview]
  environment = { NUXT_PUBLIC_SUPABASE_URL = "https://staging.supabase.co" }
```

**Rollback Procedure (docs/ops/rollback.md):**
```markdown
# Rollback Procedure

## Netlify Rollback
1. Go to Netlify dashboard → Deploys
2. Find last known good deployment
3. Click "Publish deploy"
4. Verify on staging/production URL

## Cloudflare Workers Rollback
1. `cd packages/workers/api`
2. `wrangler rollback`
3. Verify: `curl https://api.websitemage.com/health`

## Database Migration Rollback
1. Identify migration to rollback
2. `supabase db reset --db-url <STAGING_URL>`
3. Test thoroughly before production
```

**Architecture Reference:** See `docs/architecture.md` - Infrastructure and Deployment

---

### Story 1.7: Initial Dashboard with Health Status

**As a** logged-in user,  
**I want** to see a simple dashboard displaying my agency name and system health,  
**so that** I can confirm the application is working end-to-end.

#### Acceptance Criteria

1. Dashboard page displays "Welcome, [Agency Name]"
2. Dashboard fetches and displays API health check status with timestamp
3. Dashboard shows placeholder cards for "Sites (0)", "Uptime (--)", "Alerts (0)"
4. Dashboard shows user's tier badge (Base/Pro/Agency)
5. Navigation sidebar includes links to: Dashboard, Sites, Reports, Settings
6. Settings page displays user info (name, email, role) from Supabase Auth
7. Settings page includes "Logout" button
8. All pages use consistent layout and TailwindCSS styling
9. Mobile responsive design confirmed on viewport widths 375px, 768px, 1440px

#### Technical Notes

**Dashboard Page (pages/dashboard.vue):**
```vue
<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold">
        Welcome, {{ agency?.name }}
      </h1>
      <Badge :variant="tierColor">{{ agency?.tier }}</Badge>
    </div>
    
    <!-- Health Status Card -->
    <Card>
      <CardHeader>System Health</CardHeader>
      <CardContent>
        <div v-if="health" class="flex items-center space-x-2">
          <div class="h-3 w-3 rounded-full bg-green-500"></div>
          <span>All systems operational</span>
          <span class="text-sm text-gray-500">
            {{ new Date(health.timestamp).toLocaleString() }}
          </span>
        </div>
        <div v-else>Loading...</div>
      </CardContent>
    </Card>
    
    <!-- Stats Grid -->
    <div class="grid gap-6 md:grid-cols-3">
      <StatCard title="Sites" value="0" />
      <StatCard title="Uptime" value="--" />
      <StatCard title="Alerts" value="0" />
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  middleware: ['auth']
})

const supabase = useSupabaseClient()
const user = useSupabaseUser()

// Fetch agency
const { data: membership } = await supabase
  .from('agency_members')
  .select('agency_id, agencies(*)')
  .eq('user_id', user.value.id)
  .single()

const agency = membership?.agencies

// Fetch health status
const { data: health } = await useFetch('https://api.websitemage.com/health')

const tierColor = computed(() => {
  const colors = {
    base: 'gray',
    pro: 'blue',
    agency: 'purple'
  }
  return colors[agency?.tier] || 'gray'
})
</script>
```

**Default Layout (layouts/default.vue):**
```vue
<template>
  <div class="flex h-screen">
    <!-- Sidebar -->
    <aside class="w-64 border-r bg-gray-50">
      <div class="p-4">
        <h2 class="text-xl font-bold">Website Mage</h2>
      </div>
      <nav class="space-y-1 p-2">
        <NuxtLink to="/dashboard" class="nav-item">
          Dashboard
        </NuxtLink>
        <NuxtLink to="/sites" class="nav-item">
          Sites
        </NuxtLink>
        <NuxtLink to="/reports" class="nav-item">
          Reports
        </NuxtLink>
        <NuxtLink to="/settings" class="nav-item">
          Settings
        </NuxtLink>
      </nav>
    </aside>
    
    <!-- Main Content -->
    <main class="flex-1 overflow-y-auto">
      <header class="border-b bg-white p-4">
        <div class="flex items-center justify-between">
          <div></div>
          <UserMenu />
        </div>
      </header>
      <div class="p-6">
        <slot />
      </div>
    </main>
  </div>
</template>

<style scoped>
.nav-item {
  @apply block rounded px-4 py-2 hover:bg-gray-200;
}
.router-link-active {
  @apply bg-primary-100 text-primary-700;
}
</style>
```

**Responsive Design Testing:**
- Mobile (375px): Sidebar collapses to hamburger menu
- Tablet (768px): Sidebar visible, stats grid 2 columns
- Desktop (1440px): Full layout, stats grid 3 columns

**Architecture Reference:** See `docs/architecture.md` - Components (Nuxt Frontend)

---

## Epic Completion Checklist

- [ ] All 7 stories completed and tested
- [ ] End-to-end flow validated: login → dashboard → health check
- [ ] CI/CD pipeline running successfully
- [ ] All three environments configured (dev/staging/prod)
- [ ] Documentation complete (README, setup guide, rollback procedure)
- [ ] Code review completed (≥2 approvals)
- [ ] Deployed to staging for 24h soak test
- [ ] Ready for Epic 2: Uptime Monitoring

---

## Dependencies & Prerequisites

**Before Starting Epic 1:**
- GitHub repository created
- Cloudflare account with Workers enabled
- Supabase account (free tier sufficient for dev)
- Netlify account
- OAuth app credentials (Google, Microsoft, GitHub)

**Accounts & Services Needed:**
- GitHub (repository)
- Cloudflare (Workers, KV, R2)
- Supabase (3 projects: dev, staging, prod)
- Netlify (frontend hosting)
- Sentry (error tracking)

**After Epic 1 Completion:**
- Foundation ready for Epic 2 (Uptime Monitoring)
- All core services operational
- Authentication working
- CI/CD pipeline active
