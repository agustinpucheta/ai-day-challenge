<script setup lang="ts">
import type { IssueStatus } from '@/api/client';
import OpenInJira from './OpenInJira.vue';
import StatusBadge from './StatusBadge.vue';

export interface IssueRow {
  key: string;
  summary: string;
  issueType?: { name: string };
  status: IssueStatus;
  url: string;
}

defineProps<{
  issues: readonly IssueRow[];
  caption: string;
  showType?: boolean;
  /** Header of the optional per-row `actions` slot column. */
  actionsLabel?: string;
}>();

defineSlots<{ actions?: (props: { issue: IssueRow }) => unknown }>();
</script>

<template>
  <div class="table-wrap">
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
        <tr v-for="issue in issues" :key="issue.key">
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
</template>
