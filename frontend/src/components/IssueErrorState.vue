<script setup lang="ts">
import { computed } from 'vue';
import { isApiError } from '@/api/errors';
import { es } from '@/i18n/es';
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
  const f = es.failure;
  switch (error.code) {
    case 'ISSUE_NOT_FOUND_OR_INACCESSIBLE':
      return { ...f.issueNotFoundDetail, retry: false };
    case 'JIRA_NOT_CONNECTED':
      return { ...f.notConnected, retry: true, home: true };
    case 'JIRA_REAUTH_REQUIRED':
      return { ...f.reauth, retry: true };
    case 'JIRA_FORBIDDEN':
      return { ...f.forbidden, retry: true };
    case 'JIRA_RATE_LIMITED':
      return {
        title: f.rateLimitedTitle,
        text:
          error.retryAfterSeconds === undefined
            ? f.rateLimitedNoWait
            : f.rateLimitedIn(error.retryAfterSeconds),
        retry: true,
      };
    case 'JIRA_UNAVAILABLE':
      return { ...f.unavailable, retry: true };
    case 'NETWORK_ERROR':
      return { ...f.network, retry: true };
    case 'UNAUTHENTICATED':
      return { ...f.sessionExpired, retry: false };
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
        <RouterLink :to="{ name: 'home' }">{{ es.failure.goToConnection }}</RouterLink>
      </p>
    </div>
    <ErrorAlert v-else :error="error" />
    <div v-if="presentation ? presentation.retry : retryGeneric">
      <button type="button" class="button" @click="$emit('retry')">{{ es.common.retry }}</button>
    </div>
  </div>
</template>
