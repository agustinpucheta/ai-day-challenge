<script setup lang="ts">
export type JiraConnectionStatus = 'loading' | 'error' | 'disconnected' | 'connected';

defineProps<{
  status: JiraConnectionStatus;
  errorMessage?: string;
}>();

defineEmits<{ retry: [] }>();
</script>

<template>
  <section class="card" aria-labelledby="jira-panel-title">
    <h2 id="jira-panel-title" class="card__title">Jira connection</h2>

    <p v-if="status === 'loading'" class="muted" aria-busy="true">Checking connection status…</p>

    <div v-else-if="status === 'error'">
      <p class="alert alert--error" role="alert">
        {{ errorMessage ?? 'The connection status could not be loaded.' }}
      </p>
      <button type="button" class="button" @click="$emit('retry')">Try again</button>
    </div>

    <div v-else-if="status === 'disconnected'" class="stack">
      <p><span class="badge badge--neutral">Not connected</span></p>
      <p class="muted">
        Connect your Atlassian account to see your Jira issues and metrics. Nothing is shown until a
        connection exists.
      </p>
      <div>
        <button type="button" class="button button--primary" disabled aria-describedby="jira-note">
          Connect Jira
        </button>
        <p id="jira-note" class="hint">Jira OAuth is available in Phase 2.</p>
      </div>
    </div>

    <p v-else><span class="badge badge--success">Connected</span></p>
  </section>
</template>
