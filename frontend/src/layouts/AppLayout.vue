<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useSession } from '@/auth/session';
import ErrorAlert from '@/components/ErrorAlert.vue';

const router = useRouter();
const session = useSession();

const loggingOut = ref(false);
const logoutError = ref<unknown>(null);

const user = session.user;
const name = computed(() => user.value?.displayName || user.value?.email || '');

async function onLogout(): Promise<void> {
  if (loggingOut.value) return;
  loggingOut.value = true;
  logoutError.value = null;
  try {
    await session.logout();
    await router.replace({ name: 'login' });
  } catch (e) {
    logoutError.value = e;
  } finally {
    loggingOut.value = false;
  }
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <RouterLink :to="{ name: 'home' }" class="app-header__brand">Jira Dashboard</RouterLink>
      <nav aria-label="Main" class="app-header__nav">
        <RouterLink :to="{ name: 'home' }">Dashboard</RouterLink>
        <RouterLink :to="{ name: 'settings' }">Settings</RouterLink>
      </nav>
      <div v-if="user" class="app-header__user">
        <span class="app-header__identity">
          <span class="app-header__name">{{ name }}</span>
          <span v-if="user.displayName" class="app-header__email muted">{{ user.email }}</span>
        </span>
        <button type="button" class="button" :disabled="loggingOut" @click="onLogout">
          {{ loggingOut ? 'Signing out…' : 'Sign out' }}
        </button>
      </div>
    </header>

    <div v-if="logoutError" class="app-shell__notice">
      <ErrorAlert :error="logoutError" />
    </div>

    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>
