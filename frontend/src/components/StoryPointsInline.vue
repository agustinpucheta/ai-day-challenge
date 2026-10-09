<script setup lang="ts">
defineProps<{ planned: number | null; final: number | null }>();
</script>

<template>
  <span class="sp-inline">
    <span data-testid="sp-planned">
      Planned
      <strong v-if="planned !== null">{{ planned }}</strong>
      <span v-else class="muted">Not estimated</span>
    </span>
    <span data-testid="sp-final">
      Final
      <strong v-if="final !== null">{{ final }}</strong>
      <span v-else class="muted">Not estimated</span>
    </span>
  </span>
</template>
