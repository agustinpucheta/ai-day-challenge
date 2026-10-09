<script setup lang="ts">
import { computed } from 'vue';
import { ApiError, errorMessage } from '@/api/errors';

const props = defineProps<{ error: unknown }>();

const details = computed(() =>
  props.error instanceof ApiError ? (props.error.details ?? []) : [],
);
</script>

<template>
  <div class="alert alert--error" role="alert">
    <p>{{ errorMessage(error) }}</p>
    <ul v-if="details.length" class="alert__details">
      <li v-for="detail in details" :key="detail.field">
        <strong>{{ detail.field }}:</strong> {{ detail.constraints.join(', ') }}
      </li>
    </ul>
  </div>
</template>
