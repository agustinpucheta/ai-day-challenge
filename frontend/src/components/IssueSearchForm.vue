<script setup lang="ts">
import { ref, watch } from 'vue';
import { normalizeQuery, validateQuery } from '@/issues/query';

const props = withDefaults(
  defineProps<{ initialQuery?: string; busy?: boolean; inputId?: string; label?: string }>(),
  { initialQuery: '', busy: false, inputId: 'issue-search', label: 'Search issues' },
);

const emit = defineEmits<{ search: [query: string] }>();

const text = ref(props.initialQuery);
const error = ref<string | null>(null);

watch(
  () => props.initialQuery,
  (value) => {
    text.value = value;
    error.value = null;
  },
);

function onSubmit(): void {
  error.value = validateQuery(text.value);
  if (error.value === null) emit('search', normalizeQuery(text.value));
}
</script>

<template>
  <form class="search-form" role="search" novalidate @submit.prevent="onSubmit">
    <div class="field search-form__field">
      <label :for="inputId">{{ label }}</label>
      <input
        :id="inputId"
        v-model="text"
        type="search"
        autocomplete="off"
        placeholder="Text or issue key, e.g. MASIN-123"
        :aria-invalid="error !== null"
        :aria-describedby="error ? `${inputId}-error` : undefined"
      />
      <p v-if="error" :id="`${inputId}-error`" class="field__error" role="alert">{{ error }}</p>
    </div>
    <button type="submit" class="button button--primary search-form__submit" :disabled="busy">
      Search
    </button>
  </form>
</template>
