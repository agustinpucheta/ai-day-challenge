<script setup lang="ts">
import { computed } from 'vue';
import type { ChildrenState, TrackedItem } from '@/tracking/useTrackedList';
import { formatTime } from '@/issues/format';
import { toneAt } from '@/issues/progress';
import AvailableChip from './AvailableChip.vue';
import EpicChildrenTable from './EpicChildrenTable.vue';
import IssueErrorState from './IssueErrorState.vue';
import OpenInJira from './OpenInJira.vue';
import LineProgress from './LineProgress.vue';
import ProgressSummary from './ProgressSummary.vue';
import StatusBadge from './StatusBadge.vue';
import StopTrackingControl from './StopTrackingControl.vue';
import StoryPointsInline from './StoryPointsInline.vue';

/** A tracked issue whose Jira read succeeded: `issue` and `progress` are always present. */
const props = withDefaults(
  defineProps<{
    item: TrackedItem;
    expanded: boolean;
    children?: ChildrenState;
    removing: boolean;
    removeError: string | null;
    /** Position of the card in its list: it picks the line ink, so neighbours never match. */
    toneIndex?: number;
  }>(),
  { children: undefined, toneIndex: 0 },
);

defineEmits<{ toggle: []; retryChildren: []; remove: [] }>();

const issue = computed(() => props.item.issue);
const progress = computed(() => props.item.progress);
/** Only epics report a children count. */
const isEpic = computed(() => props.item.childrenCount !== undefined);
const fetchedTime = computed(() => formatTime(props.item.fetchedAt));
const tone = computed(() => toneAt(props.toneIndex));
const titleId = computed(() => `tracked-${props.item.id}-title`);
const childrenId = computed(() => `tracked-${props.item.id}-children`);
</script>

<template>
  <article
    v-if="issue && progress"
    class="tracked-card"
    :data-tone="tone"
    :aria-labelledby="titleId"
  >
    <span class="tracked-card__tab" aria-hidden="true"></span>
    <header class="tracked-card__header">
      <h2 :id="titleId" class="tracked-card__key">
        <RouterLink :to="{ name: 'issue', params: { key: issue.key } }">{{ issue.key }}</RouterLink>
      </h2>
      <p class="meta">
        <span class="badge badge--neutral">{{ issue.issueType.name }}</span>
        <StatusBadge :status="issue.status" />
        <AvailableChip :count="progress.available" />
      </p>
    </header>
    <p class="tracked-card__summary">{{ issue.summary }}</p>

    <div class="tracked-card__progress">
      <LineProgress :progress="progress" :tone-index="tone" :label="`${issue.key} progress`" />
      <ProgressSummary :progress="progress" :warnings="item.warnings" />
    </div>

    <StoryPointsInline
      v-if="!isEpic"
      :planned="issue.storyPoints.planned"
      :final="issue.storyPoints.final"
    />

    <div v-if="isEpic && item.childrenCount" class="tracked-card__children">
      <button
        type="button"
        class="button"
        :aria-expanded="expanded"
        :aria-controls="childrenId"
        @click="$emit('toggle')"
      >
        {{ expanded ? 'Hide stories' : `Show stories (${item.childrenCount})`
        }}<span class="sr-only"> of {{ issue.key }}</span>
      </button>
      <div v-if="expanded" :id="childrenId" class="stack" :aria-busy="children?.kind === 'loading'">
        <h3 class="tracked-card__subtitle">Stories</h3>
        <p v-if="!children || children.kind === 'loading'" class="muted">Loading stories…</p>
        <IssueErrorState
          v-else-if="children.kind === 'error'"
          :error="children.error"
          @retry="$emit('retryChildren')"
        />
        <p v-else-if="children.children.length === 0" class="empty-state">No children yet</p>
        <EpicChildrenTable
          v-else
          :children="children.children"
          :caption="`Stories of ${issue.key}`"
          :tone-offset="tone + 1"
          compact
        />
      </div>
    </div>

    <footer class="tracked-card__footer">
      <OpenInJira :url="issue.url" :issue-key="issue.key" />
      <StopTrackingControl
        :issue-key="issue.key"
        :busy="removing"
        :error="removeError"
        @confirm="$emit('remove')"
      />
      <p v-if="fetchedTime" class="hint">Read from Jira at {{ fetchedTime }}</p>
    </footer>
  </article>
</template>
