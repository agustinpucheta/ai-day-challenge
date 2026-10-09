<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { es } from '@/i18n/es';
import IssueErrorState from '@/components/IssueErrorState.vue';
import IssueSearchForm from '@/components/IssueSearchForm.vue';
import JiraConnectionPanel from '@/components/JiraConnectionPanel.vue';
import LastFetched from '@/components/LastFetched.vue';
import StateLegend from '@/components/StateLegend.vue';
import TrackedIssueCard from '@/components/TrackedIssueCard.vue';
import TrackedIssueErrorCard from '@/components/TrackedIssueErrorCard.vue';
import { useJiraConnection } from '@/jira/useJiraConnection';
import { describeFailure } from '@/tracking/errorCopy';
import { useTrackedList } from '@/tracking/useTrackedList';
import { useTracking } from '@/tracking/useTracking';

const jira = useJiraConnection();
const router = useRouter();
const tracking = useTracking();
const list = useTrackedList();
const state = list.state;

function onSearch(q: string): void {
  void router.push({ name: 'issues', query: { q } });
}

/** Codes that describe Jira as a whole rather than one issue. */
const WIDE_CODES = new Set([
  'JIRA_NOT_CONNECTED',
  'JIRA_REAUTH_REQUIRED',
  'JIRA_FORBIDDEN',
  'JIRA_RATE_LIMITED',
  'JIRA_UNAVAILABLE',
]);

/** When every item failed for the same Jira-wide reason, say it once instead of on each card. */
const wideFailure = computed(() => {
  if (state.value.kind !== 'loaded') return null;
  const { items } = state.value;
  const code = items[0]?.error?.code;
  if (!code || !WIDE_CODES.has(code)) return null;
  return items.every((item) => item.status === 'error' && item.error?.code === code)
    ? describeFailure(code)
    : null;
});

const busy = computed(
  () => state.value.kind === 'loading' || (state.value.kind === 'loaded' && state.value.refreshing),
);
const refreshing = computed(() => state.value.kind === 'loaded' && state.value.refreshing);
</script>

<template>
  <section class="page" aria-labelledby="dashboard-title" :aria-busy="busy">
    <header class="page-header">
      <h1 id="dashboard-title">{{ es.nav.tracking }}</h1>
      <div class="page-header__actions">
        <LastFetched
          v-if="state.kind === 'loaded'"
          :fetched-at="state.fetchedAt"
          :label="es.dates.lastUpdated"
        />
        <button
          type="button"
          class="button"
          :disabled="state.kind !== 'loaded' || state.refreshing"
          @click="list.refresh()"
        >
          {{ refreshing ? es.common.refreshing : es.common.refresh }}
        </button>
      </div>
    </header>

    <div class="toolbar">
      <IssueSearchForm
        input-id="dashboard-search"
        :label="es.search.labelDashboard"
        @search="onSearch"
      />
    </div>

    <JiraConnectionPanel
      compact
      :state="jira.state.value"
      @verify="jira.verify"
      @reload="jira.reload"
    />

    <StateLegend />

    <div class="stack" aria-live="polite">
      <div v-if="state.kind === 'loading'" class="grid grid--cards" data-testid="tracking-skeleton">
        <p class="sr-only">{{ es.tracking.loadingList }}</p>
        <div v-for="n in 4" :key="n" class="skeleton-card" aria-hidden="true">
          <span class="skeleton skeleton--title"></span>
          <span class="skeleton skeleton--line"></span>
          <span class="skeleton skeleton--numeral"></span>
          <span class="skeleton skeleton--rail"></span>
          <span class="skeleton skeleton--line"></span>
        </div>
      </div>

      <IssueErrorState
        v-else-if="state.kind === 'error'"
        :error="state.error"
        @retry="list.retry()"
      />

      <div v-else-if="state.items.length === 0" class="empty-state empty-state--line">
        <span class="empty-state__line" aria-hidden="true"></span>
        <p>
          {{ es.tracking.empty.before }}
          <RouterLink :to="{ name: 'issues' }">{{ es.tracking.empty.link }}</RouterLink>
          {{ es.tracking.empty.after }}
        </p>
      </div>

      <template v-else>
        <div v-if="wideFailure" class="alert alert--error" role="alert">
          <strong>{{ wideFailure.title }}</strong>
          <p>{{ wideFailure.text }}</p>
          <p>{{ es.tracking.jiraUnreadable }}</p>
          <p>
            <button type="button" class="button" @click="list.refresh()">
              {{ es.common.retry }}
            </button>
          </p>
        </div>

        <ul class="grid grid--cards cards">
          <li v-for="(item, index) in state.items" :key="item.id">
            <TrackedIssueErrorCard
              v-if="item.status === 'error' || !item.issue || !item.progress"
              :item="item"
              :compact="wideFailure !== null"
              :retrying="list.retrying.has(item.issueKey)"
              :removing="tracking.isPending(item.issueKey)"
              :remove-error="tracking.errorFor(item.issueKey)"
              @retry="list.retryItem(item.issueKey)"
              @remove="list.remove(item.issueKey)"
            />
            <TrackedIssueCard
              v-else
              :item="item"
              :tone-index="index"
              :expanded="list.expanded.has(item.issueKey)"
              :children="list.children.get(item.issueKey)"
              :removing="tracking.isPending(item.issueKey)"
              :remove-error="tracking.errorFor(item.issueKey)"
              @toggle="list.toggle(item.issueKey)"
              @retry-children="list.retryChildren(item.issueKey)"
              @remove="list.remove(item.issueKey)"
            />
          </li>
        </ul>
      </template>
    </div>
  </section>
</template>
