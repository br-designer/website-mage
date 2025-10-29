<template>
  <div>
    <h1 class="text-3xl font-bold text-gray-900 mb-6">Settings</h1>
    
    <div class="space-y-6">
      <UiCard>
        <template #header>
          <h2 class="text-lg font-semibold text-gray-900">Account Settings</h2>
        </template>
        
        <div class="space-y-4">
          <p class="text-gray-500">
            Account management features will be implemented in future stories.
          </p>
        </div>
      </UiCard>
      
      <UiCard>
        <template #header>
          <h2 class="text-lg font-semibold text-gray-900">Agency Settings</h2>
        </template>
        
        <div class="space-y-4">
          <p class="text-gray-500">
            Agency configuration will be implemented in future stories.
          </p>
        </div>
      </UiCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['auth'],
})

// Settings page - full implementation in later stories
</script>
