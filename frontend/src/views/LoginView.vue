<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSession } from '@/auth/session';
import AuthShell from '@/components/AuthShell.vue';
import ErrorAlert from '@/components/ErrorAlert.vue';
import { es } from '@/i18n/es';
import { sanitizeRedirect } from '@/router/redirect';

const route = useRoute();
const router = useRouter();
const session = useSession();

const email = ref('');
const password = ref('');
const submitting = ref(false);
const error = ref<unknown>(null);

const justRegistered = computed(() => route.query.registered === '1');

async function onSubmit(): Promise<void> {
  if (submitting.value) return;
  submitting.value = true;
  error.value = null;
  try {
    await session.login({ email: email.value, password: password.value });
    password.value = '';
    await router.replace(sanitizeRedirect(route.query.redirect));
  } catch (e) {
    error.value = e;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <AuthShell title-id="login-title">
    <h1 id="login-title">{{ es.auth.signIn }}</h1>
    <p v-if="justRegistered" class="alert alert--success" role="status">
      {{ es.auth.accountCreated }}
    </p>

    <form class="stack" novalidate @submit.prevent="onSubmit">
      <div class="field">
        <label for="login-email">{{ es.auth.email }}</label>
        <input
          id="login-email"
          v-model="email"
          type="email"
          autocomplete="username"
          required
          maxlength="320"
        />
      </div>
      <div class="field">
        <label for="login-password">{{ es.auth.password }}</label>
        <input
          id="login-password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
          maxlength="256"
        />
      </div>

      <ErrorAlert v-if="error" :error="error" />

      <button type="submit" class="button button--primary" :disabled="submitting">
        {{ submitting ? es.auth.signingIn : es.auth.signIn }}
      </button>
    </form>

    <p class="muted">
      {{ es.auth.noAccount }}
      <RouterLink :to="{ name: 'register' }">{{ es.auth.createOne }}</RouterLink>
    </p>
  </AuthShell>
</template>
