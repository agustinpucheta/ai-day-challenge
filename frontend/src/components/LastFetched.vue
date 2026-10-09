<script setup lang="ts">
import { computed } from 'vue';
import { formatDateTime } from '@/issues/format';

const props = defineProps<{ fetchedAt: string }>();

const formatted = computed(() => formatDateTime(props.fetchedAt));
</script>

<template>
  <p v-if="formatted" class="hint">
    Last fetched <time :datetime="formatted.iso">{{ formatted.label }}</time>
  </p>
</template>
