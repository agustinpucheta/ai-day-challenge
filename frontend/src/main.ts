import { createApp } from 'vue';
import { setUnauthenticatedHandler } from '@/api/client';
import { useSession } from '@/auth/session';
import App from './App.vue';
import { router } from './router';
import './styles/main.css';

// A protected call answered 401: the session expired or was revoked server-side.
setUnauthenticatedHandler(() => {
  useSession().clearSession();
  const current = router.currentRoute.value;
  if (current.meta.requiresAuth) {
    void router.replace({ name: 'login', query: { redirect: current.fullPath } });
  }
});

createApp(App).use(router).mount('#app');
