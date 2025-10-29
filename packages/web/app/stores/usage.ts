import { defineStore } from 'pinia';

interface UsageCounters {
  uptimeChecks: number;
  pagespeedChecks: number;
  rumPageViews: number;
}

interface UsageLimits {
  uptimeChecks: number;
  pagespeedChecks: number;
  rumPageViews: number;
}

interface UsageState {
  current: UsageCounters;
  limits: UsageLimits;
  loading: boolean;
}

export const useUsageStore = defineStore('usage', {
  state: (): UsageState => ({
    current: {
      uptimeChecks: 0,
      pagespeedChecks: 0,
      rumPageViews: 0,
    },
    limits: {
      uptimeChecks: 0,
      pagespeedChecks: 0,
      rumPageViews: 0,
    },
    loading: false,
  }),

  actions: {
    setUsage(current: UsageCounters, limits: UsageLimits) {
      this.current = current;
      this.limits = limits;
    },

    setLoading(loading: boolean) {
      this.loading = loading;
    },
  },

  getters: {
    uptimePercentage: (state) => {
      if (state.limits.uptimeChecks === 0) return 0;
      return (state.current.uptimeChecks / state.limits.uptimeChecks) * 100;
    },
    pagespeedPercentage: (state) => {
      if (state.limits.pagespeedChecks === 0) return 0;
      return (state.current.pagespeedChecks / state.limits.pagespeedChecks) * 100;
    },
    rumPercentage: (state) => {
      if (state.limits.rumPageViews === 0) return 0;
      return (state.current.rumPageViews / state.limits.rumPageViews) * 100;
    },
  },
});
