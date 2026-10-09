<script setup lang="ts">
import { computed, ref } from 'vue';
import type { DashboardChild } from '@/api/client';
import { es } from '@/i18n/es';
import { toneAt } from '@/issues/progress';
import AvailableChip from './AvailableChip.vue';
import AvailableOnlyToggle from './AvailableOnlyToggle.vue';
import LineProgress from './LineProgress.vue';
import OpenInJira from './OpenInJira.vue';
import ProgressSummary from './ProgressSummary.vue';
import StatusBadge from './StatusBadge.vue';
import StoryPointsInline from './StoryPointsInline.vue';

const props = withDefaults(
  defineProps<{
    children: readonly DashboardChild[];
    caption: string;
    compact?: boolean;
    /** Where the cycle of line inks starts, so a table never opens with its parent's ink. */
    toneOffset?: number;
  }>(),
  { compact: false, toneOffset: 0 },
);

/** Local state on purpose: the filter is never persisted. */
const onlyAvailable = ref(false);
const rows = computed(() =>
  onlyAvailable.value ? props.children.filter((child) => child.status.isAvailable) : props.children,
);
</script>

<template>
  <div class="stack">
    <AvailableOnlyToggle v-model="onlyAvailable" />
    <p v-if="rows.length === 0" class="empty-state">{{ es.badges.noAvailable }}</p>
    <div v-else class="table-wrap" role="region" :aria-label="caption" tabindex="0">
      <table :class="['table', 'table--children', { 'table--compact': compact }]">
        <caption class="sr-only">
          {{
            caption
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">{{ es.table.key }}</th>
            <th scope="col">{{ es.table.summary }}</th>
            <th v-if="!compact" scope="col">{{ es.table.type }}</th>
            <th scope="col">{{ es.table.status }}</th>
            <th scope="col">{{ es.table.progress }}</th>
            <th scope="col">{{ es.common.storyPoints }}</th>
            <th scope="col">{{ es.common.jira }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(child, index) in rows"
            :key="child.key"
            :class="{ 'is-available': child.status.isAvailable }"
          >
            <td class="table__key">
              <RouterLink :to="{ name: 'issue', params: { key: child.key } }">{{
                child.key
              }}</RouterLink>
            </td>
            <td class="table__summary">{{ child.summary }}</td>
            <td v-if="!compact">{{ child.issueType.name }}</td>
            <td><StatusBadge :status="child.status" mark /></td>
            <td class="table__progress">
              <LineProgress
                :progress="child.progress"
                :tone-index="toneAt(index + toneOffset)"
                :label="es.progress.label(child.key)"
                size="sm"
              />
              <ProgressSummary :progress="child.progress" hide-available />
              <AvailableChip :count="child.progress.available" />
            </td>
            <td class="table__sp">
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
