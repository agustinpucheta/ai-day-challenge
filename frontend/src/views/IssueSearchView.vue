<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import IssueErrorState from '@/components/IssueErrorState.vue';
import IssueSearchForm from '@/components/IssueSearchForm.vue';
import IssueTable from '@/components/IssueTable.vue';
import LastFetched from '@/components/LastFetched.vue';
import TrackToggle from '@/components/TrackToggle.vue';
import { useIssueSearch } from '@/issues/useIssueSearch';
import { normalizeQuery, validateQuery } from '@/issues/query';

const route = useRoute();
const router = useRouter();
const issues = useIssueSearch();

/** The URL is the source of truth, so reload and the back button restore the search. */
const query = computed(() => normalizeQuery(route.query.q));
const queryError = computed(() => (query.value === '' ? null : validateQuery(query.value)));

watch(
  query,
  (q) => {
    if (q === '' || validateQuery(q) !== null) issues.reset();
    else void issues.search(q);
  },
  { immediate: true },
);

function onSearch(q: string): void {
  if (q === query.value) void issues.search(q);
  else void router.push({ name: 'issues', query: { q } });
}

const state = issues.state;
const busy = computed(() => state.value.kind === 'loading');
</script>

<template>
  <section class="page" aria-labelledby="issues-title" :aria-busy="busy">
    <header class="page-header">
      <h1 id="issues-title">Issues</h1>
    </header>

    <IssueSearchForm :initial-query="query" :busy="busy" @search="onSearch" />

    <div class="stack" aria-live="polite">
      <p v-if="queryError" class="alert alert--error" role="alert">{{ queryError }}</p>

      <div v-else-if="state.kind === 'idle'" class="empty-state empty-state--line">
        <span class="empty-state__line" aria-hidden="true"></span>
        <p>Search by text or by issue key (for example MASIN-123).</p>
      </div>

      <div v-else-if="state.kind === 'loading'" class="stack">
        <p class="muted">Searching Jira…</p>
        <div class="skeleton-rows" aria-hidden="true">
          <span v-for="n in 5" :key="n" class="skeleton skeleton--row"></span>
        </div>
      </div>

      <IssueErrorState
        v-else-if="state.kind === 'error'"
        :error="state.error"
        @retry="issues.search(query)"
      />

      <template v-else>
        <div v-if="state.items.length === 0" class="empty-state empty-state--line">
          <span class="empty-state__line" aria-hidden="true"></span>
          <p>No issues found for “{{ state.query }}”.</p>
        </div>
        <IssueTable
          v-else
          :issues="state.items"
          caption="Search results"
          show-type
          actions-label="Tracking"
        >
          <template #actions="{ issue }">
            <TrackToggle :issue-key="issue.key" />
          </template>
        </IssueTable>

        <IssueErrorState
          v-if="state.loadMoreError"
          :error="state.loadMoreError"
          @retry="issues.loadMore()"
        />

        <div v-if="state.items.length > 0" class="results-bar">
          <p class="results-bar__count">{{ state.items.length }} loaded</p>
          <LastFetched :fetched-at="state.fetchedAt" />
          <button
            v-if="state.nextPageToken && !state.loadMoreError"
            type="button"
            class="button"
            :disabled="state.loadingMore"
            @click="issues.loadMore()"
          >
            {{ state.loadingMore ? 'Loading…' : 'Load more' }}
          </button>
        </div>
        <LastFetched v-else :fetched-at="state.fetchedAt" />
      </template>
    </div>
  </section>
</template>
