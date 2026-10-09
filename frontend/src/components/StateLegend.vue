<script setup lang="ts">
import { es } from '@/i18n/es';
import type { StationKind } from '@/issues/progress';
import StationMark from './StationMark.vue';

/** Always-visible key to the station forms, in the order a line draws them. */
const ITEMS: readonly { kind: StationKind; label: string }[] = [
  { kind: 'done', label: es.states.done },
  { kind: 'inProgress', label: es.states.inProgress },
  { kind: 'pending', label: es.states.pending },
  { kind: 'available', label: es.states.available },
  { kind: 'cancelled', label: es.states.cancelled },
  { kind: 'unknown', label: es.states.unknown },
];
</script>

<template>
  <ul class="state-legend" :aria-label="es.states.legendLabel">
    <li v-for="item in ITEMS" :key="item.kind" class="state-legend__item" :data-kind="item.kind">
      <StationMark :kind="item.kind" />
      <span>{{ item.label }}</span>
    </li>
  </ul>
</template>
