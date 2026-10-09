<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AvailableChip from '@/components/AvailableChip.vue';
import EpicChildrenTable from '@/components/EpicChildrenTable.vue';
import IssueErrorState from '@/components/IssueErrorState.vue';
import IssueTable from '@/components/IssueTable.vue';
import LastFetched from '@/components/LastFetched.vue';
import LineProgress from '@/components/LineProgress.vue';
import OpenInJira from '@/components/OpenInJira.vue';
import ProgressSummary from '@/components/ProgressSummary.vue';
import StateLegend from '@/components/StateLegend.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import StoryPointsBlock from '@/components/StoryPointsBlock.vue';
import TrackToggle from '@/components/TrackToggle.vue';
import { es } from '@/i18n/es';
import { lineTone } from '@/issues/progress';
import { useDashboardIssue } from '@/issues/useDashboardIssue';

const route = useRoute();
const issueKey = computed(() => String(route.params.key ?? ''));
const detail = useDashboardIssue(issueKey);
const state = detail.state;
/** A detail page has no list to take a position in, so its line keeps the ink of its key. */
const tone = computed(() => lineTone(issueKey.value));
</script>

<template>
  <section
    class="page"
    aria-labelledby="issue-title"
    :data-tone="tone"
    :aria-busy="state.kind === 'loading' || (state.kind === 'loaded' && state.refreshing)"
  >
    <p>
      <RouterLink :to="{ name: 'issues' }">{{ es.detail.back }}</RouterLink>
    </p>

    <div aria-live="polite" class="stack">
      <template v-if="state.kind === 'loading'">
        <h1 id="issue-title">{{ issueKey }}</h1>
        <p class="muted">{{ es.detail.loading }}</p>
        <div class="skeleton-card" aria-hidden="true">
          <span class="skeleton skeleton--title"></span>
          <span class="skeleton skeleton--numeral"></span>
          <span class="skeleton skeleton--rail"></span>
          <span class="skeleton skeleton--line"></span>
        </div>
      </template>

      <template v-else-if="state.kind === 'error'">
        <h1 id="issue-title">{{ issueKey }}</h1>
        <IssueErrorState :error="state.error" @retry="detail.retry()" />
      </template>

      <template v-else>
        <header class="issue-head">
          <span class="issue-head__tab" aria-hidden="true"></span>
          <h1 id="issue-title">
            <span class="issue-key">{{ state.data.issue.key }}</span>
            {{ state.data.issue.summary }}
          </h1>
          <p class="meta">
            <span class="badge badge--neutral">{{ state.data.issue.issueType.name }}</span>
            <StatusBadge :status="state.data.issue.status" mark />
            <AvailableChip :count="state.data.progress.available" />
          </p>
          <p v-if="state.data.issue.parentKey" class="issue-head__parent">
            {{ es.detail.parent }}
            <RouterLink :to="{ name: 'issue', params: { key: state.data.issue.parentKey } }">{{
              state.data.issue.parentKey
            }}</RouterLink>
          </p>
          <div class="issue-head__actions">
            <TrackToggle :issue-key="state.data.issue.key" primary />
            <OpenInJira :url="state.data.issue.url" :issue-key="state.data.issue.key" />
          </div>
        </header>

        <StateLegend />

        <div class="issue-overview">
          <section class="card card--prominent" aria-labelledby="progress-title">
            <h2 id="progress-title" class="card__title">{{ es.progress.heading }}</h2>
            <div class="stack">
              <LineProgress
                :progress="state.data.progress"
                :tone-index="tone"
                :label="es.progress.label(state.data.issue.key)"
                size="lg"
              />
              <ProgressSummary
                :progress="state.data.progress"
                :warnings="state.data.metadata.warnings"
              />
            </div>
          </section>

          <section class="card" aria-labelledby="sp-title">
            <h2 id="sp-title" class="card__title">{{ es.common.storyPoints }}</h2>
            <p v-if="state.data.issue.issueType.hierarchyLevel >= 1" class="muted">
              {{ es.storyPoints.epicNote }}
            </p>
            <StoryPointsBlock
              v-else
              :final="state.data.issue.storyPoints.final"
              :planned="state.data.issue.storyPoints.planned"
            />
          </section>
        </div>

        <section v-if="state.data.children" class="card" aria-labelledby="children-title">
          <h2 id="children-title" class="card__title">{{ es.detail.stories }}</h2>
          <p v-if="state.data.children.length === 0" class="empty-state">
            {{ es.detail.noChildren }}
          </p>
          <EpicChildrenTable
            v-else
            :children="state.data.children"
            :caption="es.detail.stories"
            :tone-offset="tone + 1"
          />
        </section>

        <section v-else class="card" aria-labelledby="subtasks-title">
          <h2 id="subtasks-title" class="card__title">{{ es.detail.subtasks }}</h2>
          <p v-if="state.data.subtasks.length === 0" class="empty-state">
            {{ es.detail.noSubtasks }}
          </p>
          <IssueTable
            v-else
            :issues="state.data.subtasks"
            :caption="es.detail.subtasks"
            available-filter
          />
        </section>

        <div class="meta issue-foot">
          <LastFetched :fetched-at="state.data.metadata.fetchedAt" />
          <button
            type="button"
            class="button"
            :disabled="state.refreshing"
            @click="detail.refresh()"
          >
            {{ state.refreshing ? es.common.refreshing : es.common.refresh }}
          </button>
        </div>
      </template>
    </div>
  </section>
</template>
