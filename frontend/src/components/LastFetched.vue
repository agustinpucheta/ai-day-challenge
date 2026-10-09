<script setup lang="ts">
import { computed } from 'vue';
import { formatDateTime } from '@/issues/format';

const props = withDefaults(defineProps<{ fetchedAt: string; label?: string }>(), {
  label: 'Last fetched',
});

const formatted = computed(() => formatDateTime(props.fetchedAt));
</script>

<template>
  <p v-if="formatted" class="hint">
    {{ label }} <time :datetime="formatted.iso">{{ formatted.label }}</time>
  </p>
</template>
