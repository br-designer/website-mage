// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: true,

  srcDir: 'app/',

  typescript: {
    strict: true,
    typeCheck: false,
  },

  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt', '@nuxtjs/supabase'],

  runtimeConfig: {
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_ANON_KEY,
      sentryDsn: process.env.SENTRY_DSN,
    },
  },

  supabase: {
    redirect: false,
  },

  devtools: { enabled: true },

  compatibilityDate: '2024-11-01',
});
