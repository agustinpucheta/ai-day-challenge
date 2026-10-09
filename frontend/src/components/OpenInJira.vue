<script setup lang="ts">
defineProps<{ url: string; issueKey: string }>();
</script>

<template>
  <a :href="url" target="_blank" rel="noopener noreferrer" class="external-link">
    Open in Jira<span class="sr-only"> ({{ issueKey }})</span>
  </a>
</template>
