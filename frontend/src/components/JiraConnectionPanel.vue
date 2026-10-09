<script setup lang="ts">
import { computed } from 'vue';
import { es } from '@/i18n/es';
import { formatDateTime } from '@/issues/format';
import type { JiraConnectionState } from '@/jira/useJiraConnection';

const props = defineProps<{
  state: JiraConnectionState;
  /** Connected collapses to a single status line; every other state keeps the full panel. */
  compact?: boolean;
}>();

defineEmits<{ verify: []; reload: [] }>();

const error = computed(() => {
  const state = props.state;
  return state.kind === 'error' ? { ...state, ...es.jira.errors[state.reason] } : null;
});

const oneLine = computed(() => props.compact && props.state.kind === 'connected');

const busy = computed(() => props.state.kind === 'loading' || props.state.kind === 'verifying');

const checkedAt = computed(() =>
  props.state.kind === 'connected' ? formatDateTime(props.state.checkedAt) : null,
);
</script>

<template>
  <section
    :class="['card', { 'card--compact': oneLine }]"
    aria-labelledby="jira-panel-title"
    :aria-busy="busy"
  >
    <h2 id="jira-panel-title" :class="oneLine ? 'sr-only' : 'card__title'">
      {{ es.jira.panelTitle }}
    </h2>

    <div class="stack" aria-live="polite">
      <p v-if="state.kind === 'loading'" class="muted">{{ es.jira.loading }}</p>

      <template v-else-if="state.kind === 'not_configured'">
        <p>
          <span class="badge badge--neutral">{{ es.jira.notConfigured }}</span>
        </p>
        <p class="muted">
          {{ es.jira.notConfiguredBefore }} <code>JIRA_URL</code>, <code>JIRA_USERNAME</code>
          {{ es.jira.notConfiguredAnd }} <code>JIRA_API_TOKEN</code>
          {{ es.jira.notConfiguredMiddle }} <code>.env</code> {{ es.jira.notConfiguredAfter }}
        </p>
        <div>
          <button type="button" class="button" @click="$emit('reload')">
            {{ es.jira.checkAgain }}
          </button>
        </div>
      </template>

      <template v-else-if="state.kind === 'configured'">
        <p>
          <span class="badge badge--neutral">{{ es.jira.configured }}</span>
        </p>
        <p v-if="state.siteUrl" class="muted">
          {{ es.jira.site }} <span>{{ state.siteUrl }}</span>
        </p>
        <div>
          <button type="button" class="button button--primary" @click="$emit('verify')">
            {{ es.jira.verify }}
          </button>
        </div>
      </template>

      <p v-else-if="state.kind === 'verifying'" class="muted">
        <span class="badge badge--neutral">{{ es.jira.verifying }}</span>
        {{ es.jira.contacting }}
        <template v-if="state.siteUrl"
          >{{ es.jira.contactingAt }} <span>{{ state.siteUrl }}</span></template
        >.
      </p>

      <div v-else-if="state.kind === 'connected' && compact" class="connection-line">
        <span class="badge badge--success">{{ es.jira.connected }}</span>
        <span>
          <span>{{ state.displayName }}</span> {{ es.jira.connectedAt }}
          <span>{{ state.siteUrl }}</span>
        </span>
        <span v-if="checkedAt" class="hint">
          {{ es.dates.lastChecked }} <time :datetime="checkedAt.iso">{{ checkedAt.label }}</time>
        </span>
        <button type="button" class="button" @click="$emit('verify')">
          {{ es.jira.verifyAgain }}
        </button>
      </div>

      <template v-else-if="state.kind === 'connected'">
        <p>
          <span class="badge badge--success">{{ es.jira.connected }}</span>
        </p>
        <p>
          <span>{{ state.displayName }}</span> {{ es.jira.connectedAt }}
          <span>{{ state.siteUrl }}</span>
        </p>
        <p v-if="checkedAt" class="hint">
          {{ es.dates.lastChecked }} <time :datetime="checkedAt.iso">{{ checkedAt.label }}</time>
        </p>
        <div>
          <button type="button" class="button" @click="$emit('verify')">
            {{ es.jira.verifyAgain }}
          </button>
        </div>
      </template>

      <template v-else-if="error">
        <div class="alert alert--error" role="alert">
          <strong>{{ error.title }}</strong>
          <p>{{ error.text }}</p>
          <p v-if="error.reason === 'rate_limited' && error.retryAfterSeconds !== undefined">
            {{ es.jira.retryIn(error.retryAfterSeconds) }}
          </p>
        </div>
        <div>
          <button
            type="button"
            class="button"
            @click="error.retry === 'reload' ? $emit('reload') : $emit('verify')"
          >
            {{ es.common.retry }}
          </button>
        </div>
      </template>
    </div>
  </section>
</template>
