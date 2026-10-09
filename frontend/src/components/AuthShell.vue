<script setup lang="ts">
import { es } from '@/i18n/es';
import LineMotif from './LineMotif.vue';

/** The calm centred frame of every page outside the app shell: sign in, register, errors. */
defineProps<{ titleId: string }>();
</script>

<template>
  <main class="auth-page">
    <div class="auth-brand">
      <span class="auth-brand__name">{{ es.app.name }}</span>
      <LineMotif />
    </div>
    <section class="card auth-card" :aria-labelledby="titleId">
      <slot />
    </section>
  </main>
</template>
