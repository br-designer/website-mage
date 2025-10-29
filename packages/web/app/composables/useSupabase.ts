export const useSupabase = () => {
  const supabase = useSupabaseClient();

  return {
    client: supabase,

    // Helper methods for common operations
    from: (table: string) => supabase.from(table),

    auth: supabase.auth,

    storage: supabase.storage,
  };
};
