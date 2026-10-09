<script setup lang="ts">
/** "N available": items waiting to be taken. Renders nothing when there are none. */
defineProps<{ count: number }>();
</script>

<template>
  <span v-if="count > 0" class="badge badge--available available-chip" data-testid="available-chip">
    {{ count }} available
  </span>
</template>
