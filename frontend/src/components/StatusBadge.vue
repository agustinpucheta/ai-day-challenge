<script setup lang="ts">
import { computed } from 'vue';
import type { IssueStatus } from '@/api/client';
import { es } from '@/i18n/es';
import { statusStation } from '@/issues/progress';
import StationMark from './StationMark.vue';

const props = defineProps<{
  status: Readonly<IssueStatus>;
  /** Puts the station form of the state before the name, as in a line, so it never rides on hue. */
  mark?: boolean;
}>();

/**
 * Precedence: cancelled > available > category. Cancelled is its own state (it is "done" in
 * Jira's category but was never completed); "available to take" keeps the real status name
 * visible so the badge is never colour-only.
 */
const variant = computed(() => {
  if (props.status.isCancelled) return 'cancelled';
  if (props.status.isAvailable) return 'available';
  return props.status.categoryKey;
});
const label = computed(() => {
  if (props.status.isCancelled) return es.badges.cancelled;
  if (props.status.isAvailable) return `${es.badges.available} · ${props.status.name}`;
  return props.status.name;
});
</script>

<template>
  <span :class="['badge', `badge--${variant}`, { 'badge--marked': mark }]" :data-status="variant">
    <StationMark v-if="mark" :kind="statusStation(status)" />{{ label }}
  </span>
</template>
