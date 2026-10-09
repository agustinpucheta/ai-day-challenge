<script setup lang="ts">
import { computed } from 'vue';
import type { IssueStatus } from '@/api/client';

const props = defineProps<{ status: Readonly<IssueStatus> }>();

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
  if (props.status.isCancelled) return 'Cancelled';
  if (props.status.isAvailable) return `Available · ${props.status.name}`;
  return props.status.name;
});
</script>

<template>
  <span :class="['badge', `badge--${variant}`]" :data-status="variant">{{ label }}</span>
</template>
