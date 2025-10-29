export default defineNuxtRouteMiddleware((to) => {
  const user = useSupabaseUser();

  // Allow access to login page without authentication
  if (to.path === '/login') {
    return;
  }

  // Redirect to login if user is not authenticated
  if (!user.value) {
    return navigateTo('/login');
  }
});
