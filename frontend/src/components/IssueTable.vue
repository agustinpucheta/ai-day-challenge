<script setup lang="ts">
import { computed, ref } from 'vue';
import type { IssueStatus } from '@/api/client';
import AvailableOnlyToggle from './AvailableOnlyToggle.vue';
import OpenInJira from './OpenInJira.vue';
import StatusBadge from './StatusBadge.vue';

export interface IssueRow {
  key: string;
  summary: string;
  issueType?: { name: string };
  status: IssueStatus;
  url: string;
}

const props = defineProps<{
  issues: readonly IssueRow[];
  caption: string;
  showType?: boolean;
  /** Header of the optional per-row `actions` slot column. */
  actionsLabel?: string;
  /** Adds a local (non-persisted) "Only available" filter above the table. */
  availableFilter?: boolean;
}>();

const onlyAvailable = ref(false);
const rows = computed(() =>
  props.availableFilter && onlyAvailable.value
    ? props.issues.filter((issue) => issue.status.isAvailable)
    : props.issues,
);

defineSlots<{ actions?: (props: { issue: IssueRow }) => unknown }>();
</script>

<template>
  <div class="stack">
    <AvailableOnlyToggle v-if="availableFilter" v-model="onlyAvailable" />
    <p v-if="availableFilter && onlyAvailable && rows.length === 0" class="empty-state">
      No available items
    </p>
    <div v-else class="table-wrap">
      <table class="table">
        <caption class="sr-only">
          {{
            caption
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">Key</th>
            <th scope="col">Summary</th>
            <th v-if="showType" scope="col">Type</th>
            <th scope="col">Status</th>
            <th scope="col">Jira</th>
            <th v-if="$slots.actions" scope="col">{{ actionsLabel }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="issue in rows"
            :key="issue.key"
            :class="{ 'is-available': issue.status.isAvailable }"
          >
            <td>
              <RouterLink :to="{ name: 'issue', params: { key: issue.key } }">{{
                issue.key
              }}</RouterLink>
            </td>
            <td>{{ issue.summary }}</td>
            <td v-if="showType">{{ issue.issueType?.name }}</td>
            <td><StatusBadge :status="issue.status" /></td>
            <td><OpenInJira :url="issue.url" :issue-key="issue.key" /></td>
            <td v-if="$slots.actions"><slot name="actions" :issue="issue" /></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
