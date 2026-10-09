<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import AuthShell from '@/components/AuthShell.vue';
import { es } from '@/i18n/es';
import { sanitizeRedirect } from '@/router/redirect';

const route = useRoute();
const router = useRouter();

function retry(): void {
  // The auth guard re-checks the session on this navigation.
  void router.replace(sanitizeRedirect(route.query.redirect));
}
</script>

<template>
  <AuthShell title-id="unavailable-title">
    <h1 id="unavailable-title">{{ es.pages.unavailable }}</h1>
    <p class="alert alert--error" role="alert">{{ es.pages.unavailableText }}</p>
    <div>
      <button type="button" class="button button--primary" @click="retry">
        {{ es.common.retry }}
      </button>
    </div>
  </AuthShell>
</template>
