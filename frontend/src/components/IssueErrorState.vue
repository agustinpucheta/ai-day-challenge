<script setup lang="ts">
import { computed } from 'vue';
import { isApiError } from '@/api/errors';
import ErrorAlert from './ErrorAlert.vue';

const props = defineProps<{ error: unknown }>();

defineEmits<{ retry: [] }>();

interface Presentation {
  title: string;
  text: string;
  /** Whether trying again can change the outcome. */
  retry: boolean;
  home?: boolean;
}

const presentation = computed<Presentation | null>(() => {
  const error = props.error;
  if (!isApiError(error)) return null;
  switch (error.code) {
    case 'ISSUE_NOT_FOUND_OR_INACCESSIBLE':
      return {
        title: "Issue not found or you don't have access",
        text: 'Check the key. If it is right, the configured Jira account cannot see that issue.',
        retry: false,
      };
    case 'JIRA_NOT_CONNECTED':
      return {
        title: 'Jira is not connected',
        text: 'The backend has no Jira credentials. Set JIRA_URL, JIRA_USERNAME and JIRA_API_TOKEN, then restart the backend.',
        retry: true,
        home: true,
      };
    case 'JIRA_REAUTH_REQUIRED':
      return {
        title: 'Jira rejected the API token',
        text: 'Create a new token at id.atlassian.com → Security → API tokens, update JIRA_API_TOKEN and restart the backend.',
        retry: true,
      };
    case 'JIRA_FORBIDDEN':
      return {
        title: 'Jira denied access',
        text: 'The configured account is not allowed to read this data. Check its permissions in Jira.',
        retry: true,
      };
    case 'JIRA_RATE_LIMITED':
      return {
        title: 'Jira is rate limiting requests',
        text:
          error.retryAfterSeconds === undefined
            ? 'Too many requests were sent to Jira. Try again in a moment.'
            : `Too many requests were sent to Jira. Retry in ${error.retryAfterSeconds} seconds.`,
        retry: true,
      };
    case 'JIRA_UNAVAILABLE':
      return {
        title: 'Jira is unavailable',
        text: 'Jira did not answer correctly. This is usually temporary.',
        retry: true,
      };
    case 'NETWORK_ERROR':
      return {
        title: 'Cannot reach the server',
        text: 'Check your connection and that the backend is running.',
        retry: true,
      };
    case 'UNAUTHENTICATED':
      return {
        title: 'Your session expired',
        text: 'Sign in again to continue.',
        retry: false,
      };
    default:
      return null;
  }
});

/** Validation errors need a corrected input, not a retry; unknown failures may be transient. */
const retryGeneric = computed(() => !isApiError(props.error, 'VALIDATION_ERROR'));
</script>

<template>
  <div class="stack">
    <div v-if="presentation" class="alert alert--error" role="alert">
      <strong>{{ presentation.title }}</strong>
      <p>{{ presentation.text }}</p>
      <p v-if="presentation.home">
        <RouterLink :to="{ name: 'home' }">Go to the Jira connection panel</RouterLink>
      </p>
    </div>
    <ErrorAlert v-else :error="error" />
    <div v-if="presentation ? presentation.retry : retryGeneric">
      <button type="button" class="button" @click="$emit('retry')">Try again</button>
    </div>
  </div>
</template>
