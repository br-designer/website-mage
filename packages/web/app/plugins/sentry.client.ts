import * as Sentry from '@sentry/nuxt';

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();
  const sentryDsn = config.public.sentryDsn;

  if (!sentryDsn) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Sentry] DSN not configured, error tracking disabled');
    }
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV || 'development',
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });

  nuxtApp.vueApp.config.errorHandler = (err, instance, info) => {
    Sentry.captureException(err, {
      contexts: {
        vue: {
          componentName: instance?.$options?.name,
          propsData: instance?.$props,
          info,
        },
      },
    });
  };
});
