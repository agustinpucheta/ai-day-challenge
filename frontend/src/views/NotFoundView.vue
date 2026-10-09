<template>
  <main class="auth-page">
    <section class="card auth-card stack" aria-labelledby="not-found-title">
      <h1 id="not-found-title">Page not found</h1>
      <p class="muted">The page you are looking for does not exist.</p>
      <p><RouterLink :to="{ name: 'home' }">Go to the dashboard</RouterLink></p>
    </section>
  </main>
</template>
