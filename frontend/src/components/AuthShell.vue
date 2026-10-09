<script setup lang="ts">
import LineMotif from './LineMotif.vue';

/** The calm centred frame of every page outside the app shell: sign in, register, errors. */
defineProps<{ titleId: string }>();
</script>

<template>
  <main class="auth-page">
    <div class="auth-brand">
      <span class="auth-brand__name">Jira Dashboard</span>
      <LineMotif />
    </div>
    <section class="card auth-card" :aria-labelledby="titleId">
      <slot />
    </section>
  </main>
</template>
