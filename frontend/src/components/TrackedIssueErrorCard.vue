<script setup lang="ts">
import { computed } from 'vue';
import type { TrackedItem } from '@/tracking/useTrackedList';
import { describeFailure } from '@/tracking/errorCopy';
import LineProgress from './LineProgress.vue';
import StopTrackingControl from './StopTrackingControl.vue';

/**
 * A tracked issue whose Jira read failed. It never shows progress, not even zeros: the failure
 * is the whole content. `compact` drops the guidance when a list-wide notice already gives it.
 */
const props = defineProps<{
  item: TrackedItem;
  retrying: boolean;
  removing: boolean;
  removeError: string | null;
  compact?: boolean;
}>();

defineEmits<{ retry: []; remove: [] }>();

const copy = computed(() =>
  describeFailure(props.item.error?.code ?? 'UNKNOWN', props.item.error?.retryAfterSeconds),
);
const titleId = computed(() => `tracked-${props.item.id}-title`);
</script>

<template>
  <article
    class="tracked-card tracked-card--error"
    data-testid="tracked-error"
    :aria-labelledby="titleId"
    :aria-busy="retrying"
  >
    <span class="tracked-card__tab tracked-card__tab--broken" aria-hidden="true"></span>
    <h2 :id="titleId" class="tracked-card__key">
      <RouterLink :to="{ name: 'issue', params: { key: item.issueKey } }">{{
        item.issueKey
      }}</RouterLink>
    </h2>
    <LineProgress broken :label="`${item.issueKey} progress`" />
    <div class="alert alert--error">
      <strong>{{ compact ? 'Could not load this issue' : copy.title }}</strong>
      <p v-if="!compact">{{ copy.text }}</p>
    </div>
    <div class="tracked-card__footer">
      <button
        v-if="copy.retry"
        type="button"
        class="button"
        :disabled="retrying"
        @click="$emit('retry')"
      >
        {{ retrying ? 'Retrying…' : 'Retry'
        }}<span class="sr-only"> loading {{ item.issueKey }}</span>
      </button>
      <StopTrackingControl
        :issue-key="item.issueKey"
        label="Remove"
        :busy="removing"
        :error="removeError"
        @confirm="$emit('remove')"
      />
    </div>
  </article>
</template>
