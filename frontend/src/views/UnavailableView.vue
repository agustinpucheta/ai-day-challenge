<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { sanitizeRedirect } from '@/router/redirect';

const route = useRoute();
const router = useRouter();

function retry(): void {
  // The auth guard re-checks the session on this navigation.
  void router.replace(sanitizeRedirect(route.query.redirect));
}
</script>

<template>
  <main class="auth-page">
    <section class="card auth-card stack" aria-labelledby="unavailable-title">
      <h1 id="unavailable-title">Service unavailable</h1>
      <p class="alert alert--error" role="alert">
        Your session could not be checked because the server is unreachable or returned an error.
      </p>
      <div>
        <button type="button" class="button button--primary" @click="retry">Try again</button>
      </div>
    </section>
  </main>
</template>
