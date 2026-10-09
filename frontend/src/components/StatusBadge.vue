<script setup lang="ts">
import { computed } from 'vue';
import type { IssueStatus } from '@/api/client';

const props = defineProps<{ status: Readonly<IssueStatus> }>();

/** Cancelled is its own state: it is "done" in Jira's category but was never completed. */
const variant = computed(() => (props.status.isCancelled ? 'cancelled' : props.status.categoryKey));
const label = computed(() => (props.status.isCancelled ? 'Cancelled' : props.status.name));
</script>

<template>
  <span :class="['badge', `badge--${variant}`]" :data-status="variant">{{ label }}</span>
</template>
