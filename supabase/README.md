# Supabase Setup Guide

This directory contains Supabase migrations and configuration for Website Mage.

## Directory Structure

```
supabase/
├── migrations/
│   ├── 001_initial_schema.sql    # Core tables, enums, indexes
│   ├── 002_rls_policies.sql      # Row Level Security policies
│   └── 003_seed_data.sql         # Dev/staging seed data
├── config.toml                    # Supabase CLI configuration
├── link_test_user.sql            # Helper script to link OAuth user to test agency
└── README.md                      # This file
```

## Prerequisites

1. **Supabase Account**: Sign up at [supabase.com](https://supabase.com)
2. **Supabase CLI**: Install via Homebrew (macOS) or other package managers

```bash
# macOS
brew install supabase/tap/supabase

# Verify installation
supabase --version
```

## Setup Instructions

### 1. Create Supabase Projects

Create separate projects for each environment:

| Environment | Project Name          | Tier     | Region    |
| ----------- | --------------------- | -------- | --------- |
| Development | `websitemage-dev`     | Free     | US East 1 |
| Staging     | `websitemage-staging` | Free     | US East 1 |
| Production  | `websitemage-prod`    | Paid/Pro | US East 1 |

**Steps:**

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Select organization, enter project name, database password, and region
4. Wait for project to be provisioned (~2 minutes)

### 2. Link Supabase CLI to Development Project

```bash
# Link to your dev project
supabase link --project-ref <your-dev-project-ref>

# Get project-ref from your Supabase project URL:
# https://app.supabase.com/project/<project-ref>
```

### 3. Push Migrations to Supabase

```bash
# Push all migrations to your linked project
supabase db push

# Verify migrations were applied
supabase db remote commit
```

This will create:

- ✅ Enums: `agency_tier`, `member_role`
- ✅ Tables: `agencies`, `agency_members`, `sites`
- ✅ RLS Policies with `is_member_of()` helper function
- ✅ Seed data: Test Agency + 3 demo sites

### 4. Configure Environment Variables

Get your project credentials from Supabase Dashboard:

**Project Settings > API > Project URL and API Keys**

Copy to `.env.local` in project root:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **Security**: Never commit `.env.local` or expose `SUPABASE_SERVICE_KEY` client-side!

### 5. Link OAuth User to Test Agency

After your first OAuth login:

1. Go to Supabase Dashboard > Authentication > Users
2. Copy your `user_id` (UUID)
3. Open `supabase/link_test_user.sql`
4. Replace `<YOUR-USER-ID>` with your actual user_id
5. Run the SQL in Supabase SQL Editor

This will grant you admin access to the Test Agency.

## Database Schema

### Core Tables

#### `agencies`

Root entity for multi-tenancy. Each agency represents a customer organization.

| Column        | Type        | Description                               |
| ------------- | ----------- | ----------------------------------------- |
| id            | UUID        | Primary key                               |
| name          | TEXT        | Agency display name                       |
| tier          | agency_tier | Subscription tier (base/pro/agency)       |
| branding_json | JSONB       | White-label settings (logo, colors)       |
| custom_domain | TEXT        | Custom domain (e.g., monitoring.acme.com) |
| created_at    | TIMESTAMPTZ | Creation timestamp                        |
| updated_at    | TIMESTAMPTZ | Last update timestamp                     |

#### `agency_members`

Junction table linking users to agencies with roles.

| Column     | Type        | Description                      |
| ---------- | ----------- | -------------------------------- |
| agency_id  | UUID        | FK to agencies.id                |
| user_id    | UUID        | FK to auth.users.id              |
| role       | member_role | Member role (admin/staff/client) |
| created_at | TIMESTAMPTZ | Creation timestamp               |

**Primary Key**: `(agency_id, user_id)`

#### `sites`

Monitored websites belonging to agencies.

| Column           | Type        | Description                          |
| ---------------- | ----------- | ------------------------------------ |
| id               | UUID        | Primary key                          |
| agency_id        | UUID        | FK to agencies.id                    |
| domain           | TEXT        | Full URL (e.g., https://example.com) |
| expected_keyword | TEXT        | Keyword for uptime content check     |
| settings_json    | JSONB       | Site-specific settings               |
| deleted_at       | TIMESTAMPTZ | Soft delete timestamp                |
| created_at       | TIMESTAMPTZ | Creation timestamp                   |
| updated_at       | TIMESTAMPTZ | Last update timestamp                |

**Unique Constraint**: `(agency_id, domain)`

### Row Level Security (RLS)

All tables enforce RLS based on agency membership:

- **SELECT**: `is_member_of(agency_id)` - Users can view data for agencies they belong to
- **INSERT/UPDATE/DELETE**:
  - `agencies`: Admin only
  - `agency_members`: Admin only
  - `sites`: Admin or Staff

**Helper Functions**:

- `is_member_of(agency_id UUID)`: Returns true if current user is member of agency
- `get_member_role(agency_id UUID)`: Returns current user's role in agency

## Development Workflow

### Local Development with Supabase

```bash
# Start local Supabase stack (PostgreSQL, Studio, etc.)
supabase start

# Access Supabase Studio
open http://localhost:54323

# Stop local Supabase
supabase stop
```

### Creating New Migrations

```bash
# Create a new migration file
supabase migration new <migration_name>

# Example
supabase migration new add_uptime_checks_table

# Edit the generated file in supabase/migrations/
# Then push to remote
supabase db push
```

### Testing Migrations

```bash
# Reset local database and re-run all migrations
supabase db reset

# Diff remote schema against local migrations
supabase db diff

# Verify RLS policies
supabase test db
```

## Troubleshooting

### Migration Conflicts

If migrations conflict with remote schema:

```bash
# Pull remote changes
supabase db pull

# Review generated migration
# Merge with your local changes
# Push updated migrations
supabase db push
```

### RLS Access Denied

If queries fail with "permission denied":

1. Verify user is linked to agency via `agency_members`
2. Check RLS policies: `SELECT * FROM pg_policies WHERE schemaname = 'public';`
3. Test policies in SQL Editor with user context set

### Connection Issues

```bash
# Check Supabase CLI link status
supabase status

# Re-link if needed
supabase link --project-ref <project-ref>
```

## Production Deployment

### Migration Strategy

1. **Test migrations locally**: `supabase db reset` → verify data integrity
2. **Test on staging**: Push to staging project, run smoke tests
3. **Deploy to production**: During low-traffic window
4. **Rollback plan**: Keep previous schema snapshot

### Seed Data in Production

⚠️ **Critical**: Comment out or remove `003_seed_data.sql` before deploying to production!

The seed migration includes test data that should **never** run in production.

```bash
# Before production deployment, remove seed migration
rm supabase/migrations/003_seed_data.sql

# Or comment out all INSERT statements in the file
```

## Useful SQL Queries

### Check Applied Migrations

```sql
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;
```

### View All Agencies

```sql
SELECT id, name, tier, created_at FROM agencies;
```

### View Agency Members

```sql
SELECT
  a.name as agency,
  u.email,
  am.role
FROM agency_members am
JOIN agencies a ON a.id = am.agency_id
JOIN auth.users u ON u.id = am.user_id;
```

### View Sites with Agency Info

```sql
SELECT
  s.domain,
  a.name as agency,
  s.created_at
FROM sites s
JOIN agencies a ON a.id = s.agency_id
WHERE s.deleted_at IS NULL;
```

### Test RLS Context

```sql
-- Set user context for testing
SET request.jwt.claim.sub = '<user-id>';

-- Query should now respect RLS
SELECT * FROM sites;
```

## Support

For Supabase-specific issues:

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)
- [Supabase Discord](https://discord.supabase.com)
