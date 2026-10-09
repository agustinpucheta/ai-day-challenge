<script setup lang="ts">
import { computed } from 'vue';
import { es } from '@/i18n/es';
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
    <LineProgress broken :label="es.progress.label(item.issueKey)" />
    <div class="alert alert--error">
      <strong>{{ compact ? es.tracking.loadFailed : copy.title }}</strong>
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
        {{ retrying ? es.tracking.retrying : es.common.retry
        }}<span class="sr-only">{{ es.tracking.retryItemHint(item.issueKey) }}</span>
      </button>
      <StopTrackingControl
        :issue-key="item.issueKey"
        :label="es.tracking.remove"
        :busy="removing"
        :error="removeError"
        @confirm="$emit('remove')"
      />
    </div>
  </article>
</template>
