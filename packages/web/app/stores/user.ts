import { defineStore } from 'pinia';
import type { User } from '@supabase/supabase-js';

interface Agency {
  id: string;
  name: string;
  tier: 'base' | 'pro' | 'agency' | 'enterprise_future';
}

interface UserState {
  user: User | null;
  agency: Agency | null;
  isAuthenticated: boolean;
}

export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    user: null,
    agency: null,
    isAuthenticated: false,
  }),

  actions: {
    setUser(user: User | null) {
      this.user = user;
      this.isAuthenticated = !!user;
    },

    setAgency(agency: Agency | null) {
      this.agency = agency;
    },

    clearUser() {
      this.user = null;
      this.agency = null;
      this.isAuthenticated = false;
    },
  },

  getters: {
    userEmail: (state) => state.user?.email ?? null,
    agencyTier: (state) => state.agency?.tier ?? 'base',
  },
});
