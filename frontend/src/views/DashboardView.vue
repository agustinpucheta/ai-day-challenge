<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { errorMessage } from '@/api/errors';
import { useSession } from '@/auth/session';
import JiraConnectionPanel, {
  type JiraConnectionStatus,
} from '@/components/JiraConnectionPanel.vue';

const router = useRouter();
const session = useSession();

const refreshing = ref(false);
const refreshError = ref<unknown>(null);

const jiraStatus = computed<JiraConnectionStatus>(() => {
  if (refreshing.value) return 'loading';
  if (refreshError.value) return 'error';
  return session.user.value?.jira.connected ? 'connected' : 'disconnected';
});

async function refreshStatus(): Promise<void> {
  refreshing.value = true;
  refreshError.value = null;
  try {
    const me = await session.loadSession(true);
    if (!me) {
      await router.replace({
        name: 'login',
        query: { redirect: router.currentRoute.value.fullPath },
      });
    }
  } catch (e) {
    refreshError.value = e;
  } finally {
    refreshing.value = false;
  }
}
</script>

<template>
  <section class="page" aria-labelledby="dashboard-title">
    <h1 id="dashboard-title">Dashboard</h1>

    <div class="grid">
      <JiraConnectionPanel
        :status="jiraStatus"
        :error-message="refreshError ? errorMessage(refreshError) : undefined"
        @retry="refreshStatus"
      />

      <section class="card" aria-labelledby="issues-title">
        <h2 id="issues-title" class="card__title">Tracked issues</h2>
        <p class="empty-state">
          No Jira data yet. Issues and metrics appear here once a Jira connection exists.
        </p>
      </section>
    </div>
  </section>
</template>
