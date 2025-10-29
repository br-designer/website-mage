# Website Mage - Web Application

Nuxt 4 SSR application for Website Mage dashboard.

## Setup

### Prerequisites

- Node.js 18+
- pnpm 8+
- Supabase project (local or cloud)

### Environment Variables

Create a `.env` file in this directory with the following variables:

```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key

# Sentry Error Tracking (optional)
SENTRY_DSN=your_sentry_dsn
```

See `.env.example` for a template.

### Installation

```bash
pnpm install
```

## Development

Start the development server on `http://localhost:3000`:

```bash
pnpm run dev
```

## Building

Build the application for production:

```bash
pnpm run build
```

Preview the production build:

```bash
pnpm run preview
```

## Testing

Run unit tests:

```bash
pnpm run test
```

Run tests in watch mode:

```bash
pnpm run test:watch
```

## Project Structure

```
app/
├── components/
│   └── ui/              # Reusable UI components (Button, Card, Badge)
├── composables/
│   ├── useAuth.ts       # Authentication state and methods
│   ├── useSupabase.ts   # Supabase client wrapper
│   └── useAPI.ts        # API calls to Workers backend
├── layouts/
│   └── default.vue      # Main dashboard layout
├── middleware/
│   └── auth.ts          # Authentication middleware
├── pages/
│   ├── login.vue        # Login page
│   ├── dashboard.vue    # Main dashboard
│   ├── sites/           # Sites management
│   └── settings/        # Account settings
├── plugins/
│   └── sentry.client.ts # Sentry error tracking
└── stores/
    ├── user.ts          # User session state (Pinia)
    ├── sites.ts         # Sites list state
    └── usage.ts         # Usage counters state
```

## Features

- ✅ Nuxt 4 with SSR enabled
- ✅ TypeScript support
- ✅ TailwindCSS for styling with custom design tokens
- ✅ Pinia state management
- ✅ Supabase authentication integration
- ✅ Sentry error tracking
- ✅ Authentication middleware
- ✅ Responsive layout with sidebar navigation

## Available Scripts

| Script        | Description                       |
| ------------- | --------------------------------- |
| `dev`         | Start development server          |
| `build`       | Build for production              |
| `generate`    | Generate static site              |
| `preview`     | Preview production build          |
| `postinstall` | Prepare Nuxt (runs automatically) |
| `lint`        | Run ESLint                        |
| `test`        | Run unit tests                    |
| `test:watch`  | Run tests in watch mode           |

## Authentication

The application uses Supabase for authentication. Protected routes (dashboard, sites, settings) require authentication and will redirect to `/login` if the user is not signed in.

OAuth integration will be added in Story 1.4.

## Next Steps

- Story 1.4: Implement Google OAuth authentication
- Story 1.5: Connect to Cloudflare Workers API
- Story 1.6: Implement sites management UI
