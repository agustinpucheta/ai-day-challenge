<script setup lang="ts">
import { useId } from 'vue';

/** Local, non-persisted "Only available" filter for a table of issues. */
const model = defineModel<boolean>({ default: false });
const id = useId();
</script>

<template>
  <div class="checkbox available-toggle">
    <input :id="id" v-model="model" type="checkbox" />
    <label :for="id">Only available</label>
  </div>
</template>
