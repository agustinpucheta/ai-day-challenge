<script setup lang="ts">
import type { StationKind } from '@/issues/progress';
import StationMark from './StationMark.vue';

/** Always-visible key to the station forms, in the order a line draws them. */
const ITEMS: readonly { kind: StationKind; label: string }[] = [
  { kind: 'done', label: 'Done' },
  { kind: 'inProgress', label: 'In progress' },
  { kind: 'pending', label: 'Pending' },
  { kind: 'available', label: 'Available to take' },
  { kind: 'cancelled', label: 'Cancelled' },
  { kind: 'unknown', label: 'Unknown status' },
];
</script>

<template>
  <ul class="state-legend" aria-label="Station legend">
    <li v-for="item in ITEMS" :key="item.kind" class="state-legend__item" :data-kind="item.kind">
      <StationMark :kind="item.kind" />
      <span>{{ item.label }}</span>
    </li>
  </ul>
</template>
