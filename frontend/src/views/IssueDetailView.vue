<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import IssueErrorState from '@/components/IssueErrorState.vue';
import IssueTable from '@/components/IssueTable.vue';
import LastFetched from '@/components/LastFetched.vue';
import OpenInJira from '@/components/OpenInJira.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import StoryPointsBlock from '@/components/StoryPointsBlock.vue';
import { useDashboardIssue } from '@/issues/useDashboardIssue';

const route = useRoute();
const issueKey = computed(() => String(route.params.key ?? ''));
const detail = useDashboardIssue(issueKey);
const state = detail.state;
</script>

<template>
  <section
    class="page"
    aria-labelledby="issue-title"
    :aria-busy="state.kind === 'loading' || (state.kind === 'loaded' && state.refreshing)"
  >
    <p><RouterLink :to="{ name: 'issues' }">← Back to search</RouterLink></p>

    <div aria-live="polite" class="stack">
      <template v-if="state.kind === 'loading'">
        <h1 id="issue-title">{{ issueKey }}</h1>
        <p class="muted">Loading issue…</p>
      </template>

      <template v-else-if="state.kind === 'error'">
        <h1 id="issue-title">{{ issueKey }}</h1>
        <IssueErrorState :error="state.error" @retry="detail.retry()" />
      </template>

      <template v-else>
        <header class="stack">
          <h1 id="issue-title">
            <span class="issue-key">{{ state.data.issue.key }}</span>
            {{ state.data.issue.summary }}
          </h1>
          <p class="meta">
            <span class="badge badge--neutral">{{ state.data.issue.issueType.name }}</span>
            <StatusBadge :status="state.data.issue.status" />
            <OpenInJira :url="state.data.issue.url" :issue-key="state.data.issue.key" />
          </p>
          <p v-if="state.data.issue.parentKey">
            Parent:
            <RouterLink :to="{ name: 'issue', params: { key: state.data.issue.parentKey } }">{{
              state.data.issue.parentKey
            }}</RouterLink>
          </p>
        </header>

        <section class="card" aria-labelledby="sp-title">
          <h2 id="sp-title" class="card__title">Story points</h2>
          <StoryPointsBlock
            :final="state.data.issue.storyPoints.final"
            :planned="state.data.issue.storyPoints.planned"
          />
        </section>

        <section class="card" aria-labelledby="subtasks-title">
          <h2 id="subtasks-title" class="card__title">Subtasks</h2>
          <p v-if="state.data.subtasks.length === 0" class="empty-state">No subtasks</p>
          <IssueTable v-else :issues="state.data.subtasks" caption="Subtasks" />
        </section>

        <ul v-if="state.data.metadata.warnings.length" class="alert alert--warning warnings">
          <li v-for="warning in state.data.metadata.warnings" :key="warning">{{ warning }}</li>
        </ul>

        <div class="meta">
          <LastFetched :fetched-at="state.data.metadata.fetchedAt" />
          <button
            type="button"
            class="button"
            :disabled="state.refreshing"
            @click="detail.refresh()"
          >
            {{ state.refreshing ? 'Refreshing…' : 'Refresh' }}
          </button>
        </div>
      </template>
    </div>
  </section>
</template>
