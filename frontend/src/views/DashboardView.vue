<script setup lang="ts">
import { useRouter } from 'vue-router';
import IssueSearchForm from '@/components/IssueSearchForm.vue';
import JiraConnectionPanel from '@/components/JiraConnectionPanel.vue';
import { useJiraConnection } from '@/jira/useJiraConnection';

const jira = useJiraConnection();
const router = useRouter();

function onSearch(q: string): void {
  void router.push({ name: 'issues', query: { q } });
}
</script>

<template>
  <section class="page" aria-labelledby="dashboard-title">
    <h1 id="dashboard-title">Dashboard</h1>

    <section class="card card--prominent" aria-labelledby="search-title">
      <h2 id="search-title" class="card__title">Find an issue</h2>
      <IssueSearchForm
        input-id="dashboard-search"
        label="Search by text or issue key"
        @search="onSearch"
      />
    </section>

    <div class="grid">
      <JiraConnectionPanel :state="jira.state.value" @verify="jira.verify" @reload="jira.reload" />

      <section class="card" aria-labelledby="issues-title">
        <h2 id="issues-title" class="card__title">Tracked issues</h2>
        <p class="empty-state">
          Issue tracking and metrics arrive in the next phases. For now, use the search above to
          open an issue.
        </p>
      </section>
    </div>
  </section>
</template>
