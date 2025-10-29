import { vi } from 'vitest';

// Mock Nuxt auto-imports
global.defineNuxtRouteMiddleware = vi.fn((fn) => fn);
global.navigateTo = vi.fn();
global.useSupabaseClient = vi.fn();
global.useSupabaseUser = vi.fn();
global.useRuntimeConfig = vi.fn(() => ({
  public: {
    supabaseUrl: 'http://localhost:54321',
    supabaseKey: 'test-key',
    sentryDsn: '',
    apiUrl: 'http://localhost:8787',
  },
}));
