<script setup lang="ts">
import type { StationKind } from '@/issues/progress';
import StationMark from './StationMark.vue';

/**
 * A short decorative line of stations, the product's sign: stations passed, the one in progress
 * and what is still ahead. Purely visual, so it is hidden from assistive technology.
 */
withDefaults(defineProps<{ kinds?: readonly StationKind[] }>(), {
  kinds: () => ['done', 'done', 'inProgress', 'pending', 'available'],
});
</script>

<template>
  <div class="line-motif" data-tone="0" aria-hidden="true">
    <template v-for="(kind, i) in kinds" :key="i">
      <span v-if="i > 0" class="line-motif__segment" :data-travelled="i <= 2 || undefined"></span>
      <StationMark :kind="kind" />
    </template>
  </div>
</template>
