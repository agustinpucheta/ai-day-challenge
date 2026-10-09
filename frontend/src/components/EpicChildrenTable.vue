<script setup lang="ts">
import { computed, ref } from 'vue';
import type { DashboardChild } from '@/api/client';
import AvailableChip from './AvailableChip.vue';
import AvailableOnlyToggle from './AvailableOnlyToggle.vue';
import OpenInJira from './OpenInJira.vue';
import ProgressBar from './ProgressBar.vue';
import ProgressSummary from './ProgressSummary.vue';
import StatusBadge from './StatusBadge.vue';
import StoryPointsInline from './StoryPointsInline.vue';

const props = defineProps<{
  children: readonly DashboardChild[];
  caption: string;
  compact?: boolean;
}>();

/** Local state on purpose: the filter is never persisted. */
const onlyAvailable = ref(false);
const rows = computed(() =>
  onlyAvailable.value ? props.children.filter((child) => child.status.isAvailable) : props.children,
);
</script>

<template>
  <div class="stack">
    <AvailableOnlyToggle v-model="onlyAvailable" />
    <p v-if="rows.length === 0" class="empty-state">No available items</p>
    <div v-else class="table-wrap">
      <table class="table table--children">
        <caption class="sr-only">
          {{
            caption
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">Key</th>
            <th scope="col">Summary</th>
            <th v-if="!compact" scope="col">Type</th>
            <th scope="col">Status</th>
            <th scope="col">Progress</th>
            <th scope="col">Story points</th>
            <th scope="col">Jira</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="child in rows"
            :key="child.key"
            :class="{ 'is-available': child.status.isAvailable }"
          >
            <td>
              <RouterLink :to="{ name: 'issue', params: { key: child.key } }">{{
                child.key
              }}</RouterLink>
            </td>
            <td>{{ child.summary }}</td>
            <td v-if="!compact">{{ child.issueType.name }}</td>
            <td><StatusBadge :status="child.status" /></td>
            <td class="table__progress">
              <ProgressBar :progress="child.progress" :label="`${child.key} progress`" size="sm" />
              <ProgressSummary :progress="child.progress" hide-available />
              <AvailableChip :count="child.progress.available" />
            </td>
            <td>
              <StoryPointsInline
                :planned="child.storyPoints.planned"
                :final="child.storyPoints.final"
              />
            </td>
            <td><OpenInJira :url="child.url" :issue-key="child.key" /></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
