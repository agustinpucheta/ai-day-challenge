import { createMemoryHistory, createRouter } from 'vue-router';

const Stub = { render: () => null };

/** Memory router with the named routes the issue views link to. */
export function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: Stub },
      { path: '/issues', name: 'issues', component: Stub },
      { path: '/issues/:key', name: 'issue', component: Stub },
      { path: '/settings', name: 'settings', component: Stub },
    ],
  });
}
