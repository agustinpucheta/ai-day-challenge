<script setup lang="ts">
import type { StationKind } from '@/issues/progress';

/**
 * One station, drawn so its form says the state even without colour: filled = done, half filled =
 * in progress, hollow = pending, double ring with a flag = available, struck = cancelled,
 * dotted = unknown. Decorative: the words next to it carry the meaning.
 */
defineProps<{ kind: StationKind }>();
</script>

<template>
  <svg
    class="station"
    :data-station="kind"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <template v-if="kind === 'done'">
      <circle class="station__ring" cx="12" cy="12" r="9" />
      <circle class="station__fill" cx="12" cy="12" r="9" />
    </template>
    <template v-else-if="kind === 'inProgress'">
      <circle class="station__ring station__ring--open" cx="12" cy="12" r="9" />
      <path class="station__fill" d="M12 5.5A6.5 6.5 0 0 0 12 18.5Z" />
    </template>
    <template v-else-if="kind === 'pending'">
      <circle class="station__ring station__ring--open" cx="12" cy="12" r="9" />
    </template>
    <template v-else-if="kind === 'available'">
      <circle class="station__ring station__ring--available" cx="10.5" cy="13.5" r="8.5" />
      <circle
        class="station__ring station__ring--available station__ring--inner"
        cx="10.5"
        cy="13.5"
        r="4"
      />
      <path class="station__flag-pole" d="M19 10V1.5" />
      <path class="station__flag" d="M19 1.5H23.5L19 6Z" />
    </template>
    <template v-else-if="kind === 'cancelled'">
      <circle class="station__ring station__ring--muted" cx="12" cy="12" r="8" />
      <path class="station__strike" d="M4 20L20 4" />
    </template>
    <template v-else>
      <circle class="station__ring station__ring--dotted" cx="12" cy="12" r="9" />
    </template>
  </svg>
</template>
