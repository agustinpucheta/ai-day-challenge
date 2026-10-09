<script setup lang="ts">
import { computed, ref } from 'vue';
import { es } from '@/i18n/es';

const props = withDefaults(
  defineProps<{ issueKey: string; busy?: boolean; error?: string | null; label?: string }>(),
  { busy: false, error: null, label: es.common.untrack },
);

defineEmits<{ confirm: [] }>();

/** A small inline confirmation instead of window.confirm: removing is easy to undo, not instant. */
const confirming = ref(false);

/** Leading space kept in the expression: the template compiler would trim a bare one. */
const nameSuffix = computed(() => ` ${props.issueKey}`);
</script>

<template>
  <div class="stop-tracking">
    <button v-if="!confirming" type="button" class="button" @click="confirming = true">
      {{ label }}<span class="sr-only">{{ nameSuffix }}</span>
    </button>
    <div v-else class="stop-tracking__confirm" role="group" :aria-label="`${label} ${issueKey}`">
      <span>{{ label }} {{ issueKey }}?</span>
      <button
        type="button"
        class="button button--danger"
        :disabled="busy"
        :aria-busy="busy"
        @click="$emit('confirm')"
      >
        {{ busy ? es.tracking.removing : es.tracking.confirmRemove }}
      </button>
      <button type="button" class="button" :disabled="busy" @click="confirming = false">
        {{ es.common.cancel }}
      </button>
    </div>
    <p v-if="error" class="field__error" role="alert">{{ error }}</p>
  </div>
</template>
