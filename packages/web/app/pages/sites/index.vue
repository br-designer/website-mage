<template>
  <div>
    <h1 class="text-3xl font-bold text-gray-900 mb-6">Sites</h1>
    
    <UiCard>
      <template #header>
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-semibold text-gray-900">Your Sites</h2>
          <UiButton size="sm">Add Site</UiButton>
        </div>
      </template>
      
      <div class="text-center py-8">
        <p class="text-gray-500">
          Site management features will be implemented in future stories.
        </p>
      </div>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['auth'],
})

// Sites page - full implementation in later stories
</script>
