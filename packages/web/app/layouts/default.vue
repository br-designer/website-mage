<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center">
            <h1 class="text-2xl font-bold text-primary-600">Website Mage</h1>
          </div>
          
          <!-- User menu placeholder -->
          <div class="flex items-center space-x-4">
            <span class="text-sm text-gray-600">User Menu</span>
          </div>
        </div>
      </div>
    </header>
    
    <div class="flex">
      <!-- Sidebar Navigation -->
      <aside class="w-64 bg-white shadow-sm min-h-[calc(100vh-4rem)]">
        <nav class="px-4 py-6 space-y-2">
          <NuxtLink
            to="/dashboard"
            class="block px-4 py-2 text-gray-700 rounded-lg hover:bg-primary-50 hover:text-primary-600 transition-colors"
          >
            Dashboard
          </NuxtLink>
          <NuxtLink
            to="/sites"
            class="block px-4 py-2 text-gray-700 rounded-lg hover:bg-primary-50 hover:text-primary-600 transition-colors"
          >
            Sites
          </NuxtLink>
          <NuxtLink
            to="/reports"
            class="block px-4 py-2 text-gray-700 rounded-lg hover:bg-primary-50 hover:text-primary-600 transition-colors"
          >
            Reports
          </NuxtLink>
          <NuxtLink
            to="/settings"
            class="block px-4 py-2 text-gray-700 rounded-lg hover:bg-primary-50 hover:text-primary-600 transition-colors"
          >
            Settings
          </NuxtLink>
        </nav>
      </aside>
      
      <!-- Main Content -->
      <main class="flex-1 p-8">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.router-link-active {
  @apply bg-primary-50 text-primary-600;
}
</style>
