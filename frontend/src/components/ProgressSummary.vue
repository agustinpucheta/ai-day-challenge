<script setup lang="ts">
import { computed } from 'vue';
import type { Progress } from '@/api/client';
import { availableText, countsText, noProgressText, unknownText } from '@/issues/progress';

const props = defineProps<{
  progress: Progress;
  warnings?: readonly string[];
  /** The caller already shows the available count (e.g. as a chip). */
  hideAvailable?: boolean;
}>();

const notice = computed(() => {
  const warnings = props.warnings ?? [];
  if (!props.progress.isApproximate && warnings.length === 0) return null;
  return warnings.length > 0
    ? [...warnings]
    : ['The list of items was truncated, so these numbers are approximate.'];
});
</script>

<template>
  <div class="progress-summary">
    <p v-if="progress.state === 'ok'" class="progress-summary__counts">
      {{ countsText(progress) }}
    </p>
    <p v-else class="muted progress-summary__none">{{ noProgressText(progress) }}</p>

    <p
      v-if="progress.state === 'ok' && progress.available > 0 && !hideAvailable"
      class="progress-summary__available"
    >
      {{ availableText(progress.available) }}
    </p>

    <p v-if="progress.unknown > 0" class="hint">{{ unknownText(progress.unknown) }}</p>

    <div v-if="notice" class="alert alert--warning progress-summary__notice">
      <strong>Approximate</strong>
      <ul class="warnings">
        <li v-for="line in notice" :key="line">{{ line }}</li>
      </ul>
    </div>
  </div>
</template>
