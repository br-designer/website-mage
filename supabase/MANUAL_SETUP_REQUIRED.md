# Manual Setup Required for Story 1.2

This document outlines the manual steps that need to be completed to finish the Supabase setup.

## ✅ Completed by Dev Agent

- [x] Supabase CLI installed (via Homebrew)
- [x] Supabase project initialized (`supabase init`)
- [x] Migration files created:
  - [x] `001_initial_schema.sql` - Core tables, enums, indexes
  - [x] `002_rls_policies.sql` - RLS policies and helper functions
  - [x] `003_seed_data.sql` - Development seed data
- [x] Supabase `config.toml` configured (PostgreSQL 15)
- [x] `.env.example` file created with Supabase variable placeholders
- [x] README.md updated with Supabase setup instructions
- [x] Helper scripts created (`link_test_user.sql`)
- [x] Comprehensive documentation in `supabase/README.md`

## ⚠️ Manual Steps Required

### 1. Create Supabase Projects (AC: 1)

**You need to manually create Supabase projects via the web dashboard.**

#### Development Project

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Settings:
   - **Name**: `websitemage-dev`
   - **Database Password**: Choose a strong password (save to password manager)
   - **Region**: US East (N. Virginia) `us-east-1`
   - **Tier**: Free
4. Click "Create new project"
5. Wait ~2 minutes for provisioning

#### Staging Project

Repeat above steps with:

- **Name**: `websitemage-staging`
- **Tier**: Free

#### Production Project

Repeat above steps with:

- **Name**: `websitemage-prod`
- **Tier**: Pro (paid tier for production workloads)

### 2. Link Supabase CLI to Development Project (AC: 1)

```bash
# Get your project-ref from the Supabase dashboard URL
# Format: https://app.supabase.com/project/<project-ref>

# Link CLI to dev project
supabase link --project-ref <your-dev-project-ref>
```

### 3. Push Migrations to Development Project (AC: 2, 3, 4, 5)

```bash
# Push all migrations to your linked dev project
supabase db push

# Expected output:
# - Migration 001_initial_schema.sql applied
# - Migration 002_rls_policies.sql applied
# - Migration 003_seed_data.sql applied
```

### 4. Configure Environment Variables (AC: 7)

1. Go to Supabase Dashboard > Project Settings > API
2. Copy the following values:
   - **Project URL**: `https://<project-ref>.supabase.co`
   - **anon/public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **service_role key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

3. Create `.env.local` in project root:

```bash
cp .env.example .env.local
```

4. Edit `.env.local` and replace placeholder values:

```env
SUPABASE_URL=https://your-actual-project-ref.supabase.co
SUPABASE_ANON_KEY=your-actual-anon-key
SUPABASE_SERVICE_KEY=your-actual-service-role-key
```

5. Verify `.env.local` is gitignored:

```bash
git status  # Should NOT show .env.local
```

### 5. Verify Schema Setup (AC: 1-7)

Run these queries in Supabase SQL Editor to verify:

```sql
-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('agencies', 'agency_members', 'sites');

-- Check enums exist
SELECT typname
FROM pg_type
WHERE typname IN ('agency_tier', 'member_role');

-- Check test agency exists
SELECT id, name, tier FROM agencies WHERE name = 'Test Agency';

-- Check demo sites exist
SELECT id, domain FROM sites ORDER BY domain;

-- Check indexes exist
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%';

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('agencies', 'agency_members', 'sites');

-- Check RLS policies exist
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public';
```

### 6. Link Your OAuth User to Test Agency (Post-Migration)

**After your first OAuth login:**

1. Sign in to your app via OAuth (Google/Microsoft/GitHub)
2. Go to Supabase Dashboard > Authentication > Users
3. Copy your `user_id` (UUID)
4. Open `supabase/link_test_user.sql`
5. Replace `<YOUR-USER-ID>` with your actual user_id
6. Run the SQL in Supabase SQL Editor

This grants you admin access to the Test Agency.

## Verification Checklist

After completing manual steps, verify:

- [ ] Dev project created and accessible
- [ ] Staging project created and accessible
- [ ] Production project created and accessible
- [ ] Supabase CLI linked to dev project
- [ ] All 3 migrations applied successfully
- [ ] `.env.local` created with correct values
- [ ] Test agency exists in database
- [ ] 3 demo sites exist in database
- [ ] RLS policies enabled on all tables
- [ ] Indexes created successfully
- [ ] Helper functions `is_member_of()` and `get_member_role()` exist

## Next Steps

Once manual setup is complete:

1. Update Story 1.2 completion status
2. Test Supabase connection from Nuxt app (Story 1.3)
3. Implement OAuth authentication flows (Story 1.4)

## Troubleshooting

### Supabase CLI not linked

```bash
supabase link --project-ref <project-ref>
```

### Migration conflicts

```bash
# Pull current remote schema
supabase db pull

# Review generated migration
# Resolve conflicts
# Push again
supabase db push
```

### RLS policies not working

- Ensure user has `agency_members` record
- Test with service role key (bypasses RLS) to verify data exists
- Check policy syntax in Supabase Dashboard > Database > Policies

### Seed data not visible

- Verify migration 003 was applied: `supabase db remote commit`
- Check for errors in Supabase logs
- Manually run seed SQL if needed

## Documentation References

- [Supabase Setup Guide](./README.md)
- [Project README](../README.md)
- [Architecture Documentation](../docs/architecture.md)
