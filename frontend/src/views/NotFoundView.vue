<script setup lang="ts">
import AuthShell from '@/components/AuthShell.vue';
import { es } from '@/i18n/es';
</script>

<template>
  <AuthShell title-id="not-found-title">
    <h1 id="not-found-title">{{ es.pages.notFound }}</h1>
    <p class="muted">{{ es.pages.notFoundText }}</p>
    <p>
      <RouterLink :to="{ name: 'home' }">{{ es.pages.goHome }}</RouterLink>
    </p>
  </AuthShell>
</template>
