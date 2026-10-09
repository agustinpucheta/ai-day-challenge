<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import EpicChildrenTable from '@/components/EpicChildrenTable.vue';
import IssueErrorState from '@/components/IssueErrorState.vue';
import IssueTable from '@/components/IssueTable.vue';
import LastFetched from '@/components/LastFetched.vue';
import OpenInJira from '@/components/OpenInJira.vue';
import ProgressBar from '@/components/ProgressBar.vue';
import ProgressSummary from '@/components/ProgressSummary.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import StoryPointsBlock from '@/components/StoryPointsBlock.vue';
import TrackToggle from '@/components/TrackToggle.vue';
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
            <TrackToggle :issue-key="state.data.issue.key" primary />
          </p>
          <p v-if="state.data.issue.parentKey">
            Parent:
            <RouterLink :to="{ name: 'issue', params: { key: state.data.issue.parentKey } }">{{
              state.data.issue.parentKey
            }}</RouterLink>
          </p>
        </header>

        <section class="card card--prominent" aria-labelledby="progress-title">
          <h2 id="progress-title" class="card__title">Progress</h2>
          <div class="stack">
            <ProgressBar
              :progress="state.data.progress"
              :label="`${state.data.issue.key} progress`"
            />
            <ProgressSummary
              :progress="state.data.progress"
              :warnings="state.data.metadata.warnings"
            />
          </div>
        </section>

        <section class="card" aria-labelledby="sp-title">
          <h2 id="sp-title" class="card__title">Story points</h2>
          <StoryPointsBlock
            :final="state.data.issue.storyPoints.final"
            :planned="state.data.issue.storyPoints.planned"
          />
        </section>

        <section v-if="state.data.children" class="card" aria-labelledby="children-title">
          <h2 id="children-title" class="card__title">Stories</h2>
          <p v-if="state.data.children.length === 0" class="empty-state">No children yet</p>
          <EpicChildrenTable v-else :children="state.data.children" caption="Stories" />
        </section>

        <section v-else class="card" aria-labelledby="subtasks-title">
          <h2 id="subtasks-title" class="card__title">Subtasks</h2>
          <p v-if="state.data.subtasks.length === 0" class="empty-state">No subtasks</p>
          <IssueTable v-else :issues="state.data.subtasks" caption="Subtasks" available-filter />
        </section>

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
