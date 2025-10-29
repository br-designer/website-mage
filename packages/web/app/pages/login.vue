<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="max-w-md w-full space-y-8">
      <div>
        <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Website Mage
        </h2>
        <p class="mt-2 text-center text-sm text-gray-600">
          Login Page (OAuth integration in Story 1.4)
        </p>
      </div>
      <UiCard>
        <div class="space-y-4">
          <p class="text-center text-gray-500">
            Authentication will be implemented in the next story.
          </p>
          <UiButton class="w-full" @click="handleTestLogin">
            Test Login (Placeholder)
          </UiButton>
        </div>
      </UiCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false,
})

const handleTestLogin = () => {
  // Placeholder for OAuth login - will be implemented in Story 1.4
  // TODO: Remove console.log or gate with development-only check
  if (process.env.NODE_ENV === 'development') {
    console.log('Login button clicked - OAuth integration coming in Story 1.4')
  }
}
</script>
