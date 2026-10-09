<script setup lang="ts">
import { es } from '@/i18n/es';

/** "N disponibles": items waiting to be taken. Renders nothing when there are none. */
defineProps<{ count: number }>();
</script>

<template>
  <span v-if="count > 0" class="badge badge--available available-chip" data-testid="available-chip">
    {{ es.badges.availableCount(count) }}
  </span>
</template>
