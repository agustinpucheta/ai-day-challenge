<script setup lang="ts">
import { computed } from 'vue';
import { es } from '@/i18n/es';
import { formatDateTime } from '@/issues/format';

const props = withDefaults(defineProps<{ fetchedAt: string; label?: string }>(), {
  label: es.dates.lastFetched,
});

const formatted = computed(() => formatDateTime(props.fetchedAt));
</script>

<template>
  <p v-if="formatted" class="hint">
    {{ label }} <time :datetime="formatted.iso">{{ formatted.label }}</time>
  </p>
</template>
