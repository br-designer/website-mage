<template>
  <div>
    <h1 class="text-3xl font-bold text-gray-900 mb-6">Website Mage Dashboard</h1>
    
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <UiCard>
        <template #header>
          <h2 class="text-lg font-semibold text-gray-900">Sites</h2>
        </template>
        <p class="text-3xl font-bold text-primary-600">{{ sitesCount }}</p>
        <p class="text-sm text-gray-500 mt-1">Total monitored sites</p>
      </UiCard>
      
      <UiCard>
        <template #header>
          <h2 class="text-lg font-semibold text-gray-900">Uptime</h2>
        </template>
        <p class="text-3xl font-bold text-status-success">99.9%</p>
        <p class="text-sm text-gray-500 mt-1">Average uptime</p>
      </UiCard>
      
      <UiCard>
        <template #header>
          <h2 class="text-lg font-semibold text-gray-900">Performance</h2>
        </template>
        <p class="text-3xl font-bold text-status-warning">85</p>
        <p class="text-sm text-gray-500 mt-1">Avg. PageSpeed score</p>
      </UiCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSitesStore } from '~/app/stores/sites'

definePageMeta({
  middleware: ['auth'],
})

const sitesStore = useSitesStore()
const sitesCount = computed(() => sitesStore.siteCount)
</script>
