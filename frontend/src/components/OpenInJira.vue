<script setup lang="ts">
import { es } from '@/i18n/es';

defineProps<{ url: string; issueKey: string }>();
</script>

<template>
  <a :href="url" target="_blank" rel="noopener noreferrer" class="external-link">
    {{ es.common.openInJira }}<span class="sr-only"> ({{ issueKey }})</span>
  </a>
</template>
