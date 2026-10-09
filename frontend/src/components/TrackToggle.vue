<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { es } from '@/i18n/es';
import { useTracking } from '@/tracking/useTracking';

const props = defineProps<{ issueKey: string; primary?: boolean }>();

const tracking = useTracking();

onMounted(() => void tracking.ensureLoaded());

const tracked = computed(() => tracking.isTracked(props.issueKey));
const pending = computed(() => tracking.isPending(props.issueKey));
const error = computed(() => tracking.errorFor(props.issueKey));
/** While the followed keys are unknown the button cannot tell "Track" from "Untrack". */
const unknown = computed(
  () => !tracked.value && ['idle', 'loading'].includes(tracking.loadState.value),
);

const label = computed(() => {
  if (tracked.value) return pending.value ? es.tracking.removing : es.common.untrack;
  return pending.value ? es.tracking.tracking : es.common.track;
});

/** Leading space kept in the expression: the template compiler would trim a bare one. */
const nameSuffix = computed(() => ` ${props.issueKey}`);

function onClick(): void {
  void (tracked.value ? tracking.untrack(props.issueKey) : tracking.track(props.issueKey));
}
</script>

<template>
  <span class="track-toggle">
    <button
      type="button"
      :class="['button', { 'button--primary': primary && !tracked }]"
      :disabled="pending || unknown"
      :aria-busy="pending || unknown"
      @click="onClick"
    >
      {{ label }}<span class="sr-only">{{ nameSuffix }}</span>
    </button>
    <span v-if="error" class="field__error" role="alert">{{ error }}</span>
  </span>
</template>
