<script setup lang="ts">
import type { DashboardChild } from '@/api/client';
import OpenInJira from './OpenInJira.vue';
import ProgressBar from './ProgressBar.vue';
import ProgressSummary from './ProgressSummary.vue';
import StatusBadge from './StatusBadge.vue';
import StoryPointsInline from './StoryPointsInline.vue';

defineProps<{ children: readonly DashboardChild[]; caption: string; compact?: boolean }>();
</script>

<template>
  <div class="table-wrap">
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
        <tr v-for="child in children" :key="child.key">
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
            <ProgressSummary :progress="child.progress" />
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
</template>
