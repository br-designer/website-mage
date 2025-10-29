# Website Mage

A serverless-first website monitoring and performance platform built with Nuxt 4, Cloudflare Workers, and Supabase.

## Overview

Website Mage provides comprehensive website monitoring including:

- Uptime monitoring with global checks
- PageSpeed Insights integration
- Real User Monitoring (RUM)
- Custom alerts and notifications
- Agency-level white-label reporting

## Workspace Structure

This is a monorepo managed with PNPM workspaces and Turborepo:

```
website-mage/
├── packages/
│   ├── web/              # Nuxt 4 frontend (SSR dashboard)
│   ├── workers/          # Cloudflare Workers (API Gateway, Cron Jobs)
│   └── shared/           # Shared TypeScript types and utilities
├── supabase/             # Supabase migrations and configuration
├── docs/                 # Project documentation
└── BMAD-METHOD/          # BMAD development methodology files
```

### Package Purposes

- **packages/web**: Nuxt 4 SSR application providing the main dashboard interface
- **packages/workers**: Cloudflare Workers for edge compute (API gateway, cron jobs, webhooks)
- **packages/shared**: Shared TypeScript types, constants, and utility functions used across packages

## Prerequisites

- **Node.js**: 20.11.0 LTS or higher
- **PNPM**: 8.15.0 or higher
- **Git**: Latest stable version

## Setup Instructions

### 1. Clone the repository

```bash
git clone <repository-url>
cd website-mage
```

### 2. Install dependencies

```bash
pnpm install
```

This will install all dependencies and set up git hooks automatically.

### 3. Supabase Setup

Website Mage uses Supabase for authentication and database. Follow these steps:

#### 3.1 Create Supabase Project

1. Sign up at [supabase.com](https://supabase.com)
2. Create a new project (e.g., `websitemage-dev`)
3. Note your project's URL and API keys from Project Settings > API

#### 3.2 Link Supabase CLI

```bash
# Install Supabase CLI (macOS)
brew install supabase/tap/supabase

# Link to your Supabase project
supabase link --project-ref <your-project-ref>
```

#### 3.3 Run Database Migrations

```bash
# Push migrations to your Supabase project
supabase db push
```

This will create the core database schema including:

- `agencies` table
- `agency_members` table
- `sites` table
- Row Level Security (RLS) policies
- Seed data for development

### 4. Environment Variables

Copy the example environment file and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

Update `.env.local` with your values:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-role-key-here
```

**Security Note**: Never commit `.env.local` or expose `SUPABASE_SERVICE_KEY` client-side.

### 5. Start Development Servers

```bash
pnpm run dev
```

This will start all workspace packages in development mode.

## Available Scripts

| Script            | Description                            |
| ----------------- | -------------------------------------- |
| `pnpm run dev`    | Start all packages in development mode |
| `pnpm run build`  | Build all packages for production      |
| `pnpm run test`   | Run tests across all packages          |
| `pnpm run lint`   | Lint all packages with ESLint          |
| `pnpm run format` | Format code with Prettier              |

## Architecture

For detailed architecture documentation, see:

- [Architecture Overview](docs/architecture.md)
- [Product Requirements](docs/prd.md)
- [Epic Documentation](docs/epics/)

## Technology Stack

- **Frontend**: Nuxt 4, Vue 3, TailwindCSS
- **Backend**: Cloudflare Workers, Supabase (PostgreSQL + Auth)
- **Language**: TypeScript 5.3.3 (strict mode)
- **Monorepo**: PNPM workspaces + Turborepo
- **Payments**: Stripe
- **Monitoring**: Sentry

## Development Standards

- **Code Style**: ESLint + Prettier (enforced via pre-commit hooks)
- **Commit Format**: Conventional Commits (enforced via commit-msg hooks)
- **TypeScript**: Strict mode enabled
- **Testing**: Vitest for unit tests

## Contributing

1. Create a feature branch from `main`
2. Make your changes following the coding standards
3. Ensure all tests pass: `pnpm run test`
4. Ensure linting passes: `pnpm run lint`
5. Commit using conventional commit format (enforced automatically)
6. Submit a pull request

## License

[License information to be added]

## Support

[Support information to be added]
