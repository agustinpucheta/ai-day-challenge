<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { isApiError } from '@/api/errors';
import { useSession } from '@/auth/session';
import AuthShell from '@/components/AuthShell.vue';
import ErrorAlert from '@/components/ErrorAlert.vue';

/** Mirrors the backend password policy (PASSWORD_MIN_LENGTH); the backend stays authoritative. */
const PASSWORD_MIN_LENGTH = 12;

const router = useRouter();
const session = useSession();

const email = ref('');
const displayName = ref('');
const password = ref('');
const submitting = ref(false);
const error = ref<unknown>(null);

const registrationDisabled = computed(() => isApiError(error.value, 'REGISTRATION_DISABLED'));

async function onSubmit(): Promise<void> {
  if (submitting.value) return;
  submitting.value = true;
  error.value = null;
  try {
    const name = displayName.value.trim();
    await session.register({
      email: email.value,
      password: password.value,
      ...(name ? { displayName: name } : {}),
    });
    password.value = '';
    await router.push({ name: 'login', query: { registered: '1' } });
  } catch (e) {
    error.value = e;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <AuthShell title-id="register-title">
    <h1 id="register-title">Create account</h1>

    <div v-if="registrationDisabled" class="alert alert--warning" role="alert">
      <p><strong>Registration is disabled on this server.</strong></p>
      <p>Ask an administrator for an account, then sign in.</p>
    </div>

    <form v-else class="stack" novalidate @submit.prevent="onSubmit">
      <div class="field">
        <label for="register-email">Email</label>
        <input
          id="register-email"
          v-model="email"
          type="email"
          autocomplete="email"
          required
          maxlength="320"
        />
      </div>
      <div class="field">
        <label for="register-name">Display name <span class="muted">(optional)</span></label>
        <input
          id="register-name"
          v-model="displayName"
          type="text"
          autocomplete="name"
          maxlength="100"
        />
      </div>
      <div class="field">
        <label for="register-password">Password</label>
        <input
          id="register-password"
          v-model="password"
          type="password"
          autocomplete="new-password"
          required
          :minlength="PASSWORD_MIN_LENGTH"
          maxlength="256"
          aria-describedby="register-password-hint"
        />
        <p id="register-password-hint" class="hint">
          At least {{ PASSWORD_MIN_LENGTH }} characters.
        </p>
      </div>

      <ErrorAlert v-if="error" :error="error" />

      <button type="submit" class="button button--primary" :disabled="submitting">
        {{ submitting ? 'Creating account…' : 'Create account' }}
      </button>
    </form>

    <p class="muted">
      Already have an account? <RouterLink :to="{ name: 'login' }">Sign in</RouterLink>
    </p>
  </AuthShell>
</template>
