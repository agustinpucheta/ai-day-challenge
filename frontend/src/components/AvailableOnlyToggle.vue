<script setup lang="ts">
import { useId } from 'vue';
import { es } from '@/i18n/es';

/** Local, non-persisted "Solo disponibles" filter for a table of issues. */
const model = defineModel<boolean>({ default: false });
const id = useId();
</script>

<template>
  <div class="checkbox available-toggle">
    <input :id="id" v-model="model" type="checkbox" />
    <label :for="id">{{ es.badges.onlyAvailable }}</label>
  </div>
</template>
