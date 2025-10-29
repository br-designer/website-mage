import { defineStore } from 'pinia';

interface Site {
  id: string;
  url: string;
  name: string;
  agencyId: string;
  createdAt: string;
}

interface SitesState {
  sites: Site[];
  loading: boolean;
  filter: string;
}

export const useSitesStore = defineStore('sites', {
  state: (): SitesState => ({
    sites: [],
    loading: false,
    filter: '',
  }),

  actions: {
    setSites(sites: Site[]) {
      this.sites = sites;
    },

    setLoading(loading: boolean) {
      this.loading = loading;
    },

    setFilter(filter: string) {
      this.filter = filter;
    },

    addSite(site: Site) {
      this.sites.push(site);
    },

    removeSite(siteId: string) {
      this.sites = this.sites.filter((s) => s.id !== siteId);
    },
  },

  getters: {
    filteredSites: (state) => {
      if (!state.filter) return state.sites;
      return state.sites.filter(
        (site) =>
          site.name.toLowerCase().includes(state.filter.toLowerCase()) ||
          site.url.toLowerCase().includes(state.filter.toLowerCase())
      );
    },
    siteCount: (state) => state.sites.length,
  },
});
