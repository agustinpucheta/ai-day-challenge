<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSession } from '@/auth/session';
import ErrorAlert from '@/components/ErrorAlert.vue';
import { es } from '@/i18n/es';

const router = useRouter();
const route = useRoute();
/** The issue detail route keeps the "Issues" entry highlighted. */
const isIssueDetail = computed(() => route.name === 'issue');
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
      <div class="app-header__inner">
        <RouterLink :to="{ name: 'home' }" class="app-header__brand">
          <svg class="app-header__mark" viewBox="0 0 32 12" aria-hidden="true" focusable="false">
            <path d="M3 6H29" />
            <circle cx="4" cy="6" r="3" />
            <circle cx="16" cy="6" r="3" />
            <circle cx="28" cy="6" r="3" />
          </svg>
          <span>{{ es.app.name }}</span>
        </RouterLink>
        <nav :aria-label="es.nav.label" class="app-header__nav">
          <RouterLink :to="{ name: 'home' }">{{ es.nav.tracking }}</RouterLink>
          <RouterLink
            :to="{ name: 'issues' }"
            :class="{ 'router-link-exact-active': isIssueDetail }"
            >{{ es.nav.issues }}</RouterLink
          >
          <RouterLink :to="{ name: 'settings' }">{{ es.nav.settings }}</RouterLink>
        </nav>
        <div v-if="user" class="app-header__user">
          <span class="app-header__identity">
            <span class="app-header__name">{{ name }}</span>
            <span v-if="user.displayName" class="app-header__email muted">{{ user.email }}</span>
          </span>
          <button
            type="button"
            class="button button--quiet"
            :disabled="loggingOut"
            @click="onLogout"
          >
            {{ loggingOut ? es.nav.signingOut : es.nav.signOut }}
          </button>
        </div>
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
