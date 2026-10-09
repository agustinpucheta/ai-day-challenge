<script setup lang="ts">
import JiraConnectionPanel from '@/components/JiraConnectionPanel.vue';
import { useJiraConnection } from '@/jira/useJiraConnection';

const jira = useJiraConnection();
</script>

<template>
  <section class="page" aria-labelledby="dashboard-title">
    <h1 id="dashboard-title">Dashboard</h1>

    <div class="grid">
      <JiraConnectionPanel :state="jira.state.value" @verify="jira.verify" @reload="jira.reload" />

      <section class="card" aria-labelledby="issues-title">
        <h2 id="issues-title" class="card__title">Tracked issues</h2>
        <p class="empty-state">
          No Jira data yet. Issues and metrics appear here once a Jira connection exists.
        </p>
      </section>
    </div>
  </section>
</template>
