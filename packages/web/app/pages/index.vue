<template>
  <div></div>
</template>

<script setup lang="ts">
// Redirect to dashboard on root access
definePageMeta({
  middleware: (to) => {
    return navigateTo('/dashboard')
  },
})
</script>
