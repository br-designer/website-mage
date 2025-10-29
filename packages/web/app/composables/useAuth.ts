import { useUserStore } from '~/app/stores/user';

export const useAuth = () => {
  const supabase = useSupabaseClient();
  const user = useSupabaseUser();
  const userStore = useUserStore();

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (data.user) {
      userStore.setUser(data.user);
    }

    return data;
  };

  const loginWithOAuth = async (provider: 'google' | 'github') => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) throw error;
    return data;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    userStore.clearUser();
  };

  const getSession = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    if (data.session?.user) {
      userStore.setUser(data.session.user);
    }

    return data.session;
  };

  return {
    user,
    login,
    loginWithOAuth,
    logout,
    getSession,
  };
};
