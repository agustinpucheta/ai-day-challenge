<script setup lang="ts">
import { computed } from 'vue';
import type { Progress } from '@/api/client';
import { displayPercent, formatPercent } from '@/issues/progress';

const props = withDefaults(
  defineProps<{ progress: Progress; label: string; size?: 'md' | 'sm' }>(),
  { size: 'md' },
);

const percent = computed(() => displayPercent(props.progress));
const text = computed(() => (percent.value === null ? null : formatPercent(percent.value)));

/** Colour comes from the state: complete, in progress, no data, or everything cancelled. */
const variant = computed(() => {
  if (percent.value === null)
    return props.progress.state === 'all_cancelled' ? 'all_cancelled' : 'none';
  return percent.value >= 100 ? 'complete' : 'ok';
});
</script>

<template>
  <div :class="['progress', `progress--${size}`]" :data-state="variant">
    <div
      v-if="percent !== null"
      class="progress__track"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="percent"
      :aria-valuetext="text ?? undefined"
      :aria-label="label"
    >
      <div class="progress__fill" :style="{ width: `${percent}%` }"></div>
    </div>
    <div v-else class="progress__track" aria-hidden="true"></div>
    <span v-if="text" class="progress__value">{{ text }}</span>
  </div>
</template>
