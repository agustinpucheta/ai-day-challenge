<script setup lang="ts">
import { computed } from 'vue';
import type { JiraConnectionState, JiraErrorReason } from '@/jira/useJiraConnection';

const props = defineProps<{
  state: JiraConnectionState;
  /** Connected collapses to a single status line; every other state keeps the full panel. */
  compact?: boolean;
}>();

defineEmits<{ verify: []; reload: [] }>();

const ERROR_MESSAGES: Record<JiraErrorReason, { title: string; text: string }> = {
  reauth_required: {
    title: 'Jira rejected the API token',
    text: 'Create a new token at id.atlassian.com → Security → API tokens, update JIRA_API_TOKEN and restart the backend.',
  },
  forbidden: {
    title: 'Jira denied access',
    text: 'The configured account is not allowed to read this Jira site. Check its permissions in Jira.',
  },
  rate_limited: {
    title: 'Jira is rate limiting requests',
    text: 'Too many requests were sent to Jira.',
  },
  unavailable: {
    title: 'Jira is unavailable',
    text: 'Jira did not answer correctly. This is usually temporary.',
  },
  network: {
    title: 'Cannot reach the server',
    text: 'Check your connection and that the backend is running.',
  },
  unknown: {
    title: 'Something went wrong',
    text: 'The Jira connection could not be checked.',
  },
};

const error = computed(() => {
  const state = props.state;
  return state.kind === 'error' ? { ...state, ...ERROR_MESSAGES[state.reason] } : null;
});

const oneLine = computed(() => props.compact && props.state.kind === 'connected');

const busy = computed(() => props.state.kind === 'loading' || props.state.kind === 'verifying');

const checkedAt = computed(() => {
  if (props.state.kind !== 'connected') return null;
  const date = new Date(props.state.checkedAt);
  if (Number.isNaN(date.getTime())) return null;
  return {
    iso: date.toISOString(),
    label: new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' }).format(
      date,
    ),
  };
});
</script>

<template>
  <section
    :class="['card', { 'card--compact': oneLine }]"
    aria-labelledby="jira-panel-title"
    :aria-busy="busy"
  >
    <h2 id="jira-panel-title" :class="oneLine ? 'sr-only' : 'card__title'">Jira connection</h2>

    <div class="stack" aria-live="polite">
      <p v-if="state.kind === 'loading'" class="muted">Loading connection status…</p>

      <template v-else-if="state.kind === 'not_configured'">
        <p><span class="badge badge--neutral">Not configured</span></p>
        <p class="muted">
          The backend has no Jira credentials. Set <code>JIRA_URL</code>,
          <code>JIRA_USERNAME</code> and <code>JIRA_API_TOKEN</code> in the environment or the
          <code>.env</code> file, then restart the backend.
        </p>
        <div>
          <button type="button" class="button" @click="$emit('reload')">Check again</button>
        </div>
      </template>

      <template v-else-if="state.kind === 'configured'">
        <p><span class="badge badge--neutral">Configured, not verified</span></p>
        <p v-if="state.siteUrl" class="muted">
          Site: <span>{{ state.siteUrl }}</span>
        </p>
        <div>
          <button type="button" class="button button--primary" @click="$emit('verify')">
            Verify connection
          </button>
        </div>
      </template>

      <p v-else-if="state.kind === 'verifying'" class="muted">
        <span class="badge badge--neutral">Verifying…</span> Contacting Jira
        <template v-if="state.siteUrl"
          >at <span>{{ state.siteUrl }}</span></template
        >.
      </p>

      <div v-else-if="state.kind === 'connected' && compact" class="connection-line">
        <span class="badge badge--success">Connected</span>
        <span>
          <span>{{ state.displayName }}</span> at <span>{{ state.siteUrl }}</span>
        </span>
        <span v-if="checkedAt" class="hint">
          Last checked <time :datetime="checkedAt.iso">{{ checkedAt.label }}</time>
        </span>
        <button type="button" class="button" @click="$emit('verify')">Verify again</button>
      </div>

      <template v-else-if="state.kind === 'connected'">
        <p><span class="badge badge--success">Connected</span></p>
        <p>
          <span>{{ state.displayName }}</span> at <span>{{ state.siteUrl }}</span>
        </p>
        <p v-if="checkedAt" class="hint">
          Last checked <time :datetime="checkedAt.iso">{{ checkedAt.label }}</time>
        </p>
        <div>
          <button type="button" class="button" @click="$emit('verify')">Verify again</button>
        </div>
      </template>

      <template v-else-if="error">
        <div class="alert alert--error" role="alert">
          <strong>{{ error.title }}</strong>
          <p>{{ error.text }}</p>
          <p v-if="error.reason === 'rate_limited' && error.retryAfterSeconds !== undefined">
            Retry in {{ error.retryAfterSeconds }} seconds.
          </p>
        </div>
        <div>
          <button
            type="button"
            class="button"
            @click="error.retry === 'reload' ? $emit('reload') : $emit('verify')"
          >
            Try again
          </button>
        </div>
      </template>
    </div>
  </section>
</template>
