<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api, type Preferences } from '@/api/client';
import ErrorAlert from '@/components/ErrorAlert.vue';
import { diffPreferences, toForm, type PreferencesForm } from '@/preferences/diff';

const WEEK_START_OPTIONS: { value: Preferences['weekStartsOn']; label: string }[] = [
  { value: 'monday', label: 'Monday' },
  { value: 'sunday', label: 'Sunday' },
];

const timezones: string[] =
  typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];

const stored = ref<Preferences | null>(null);
const form = ref<PreferencesForm | null>(null);
const loading = ref(true);
const loadError = ref<unknown>(null);
const saving = ref(false);
const saveError = ref<unknown>(null);
const saved = ref(false);

const changes = computed(() =>
  stored.value && form.value ? diffPreferences(stored.value, form.value) : {},
);
const hasChanges = computed(() => Object.keys(changes.value).length > 0);

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    const preferences = await api.getPreferences();
    stored.value = preferences;
    form.value = toForm(preferences);
  } catch (e) {
    loadError.value = e;
  } finally {
    loading.value = false;
  }
}

async function onSubmit(): Promise<void> {
  if (!hasChanges.value || saving.value) return;
  saving.value = true;
  saveError.value = null;
  saved.value = false;
  try {
    const updated = await api.updatePreferences(changes.value);
    stored.value = updated;
    form.value = toForm(updated);
    saved.value = true;
  } catch (e) {
    saveError.value = e;
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="page" aria-labelledby="settings-title">
    <h1 id="settings-title">Settings</h1>

    <div v-if="loading" class="card" aria-busy="true">
      <p class="muted">Loading preferences…</p>
    </div>

    <div v-else-if="loadError" class="card stack">
      <ErrorAlert :error="loadError" />
      <div><button type="button" class="button" @click="load">Try again</button></div>
    </div>

    <form v-else-if="form" class="card stack" novalidate @submit.prevent="onSubmit">
      <h2 class="card__title">Dashboard preferences</h2>

      <div class="field">
        <label for="pref-week-start">Week starts on</label>
        <select id="pref-week-start" v-model="form.weekStartsOn">
          <option v-for="option in WEEK_START_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>

      <div class="field">
        <label for="pref-timezone">Time zone</label>
        <input
          id="pref-timezone"
          v-model="form.timezone"
          type="text"
          list="pref-timezone-options"
          autocomplete="off"
          placeholder="e.g. America/Argentina/Buenos_Aires"
          aria-describedby="pref-timezone-hint"
        />
        <datalist id="pref-timezone-options">
          <option v-for="zone in timezones" :key="zone" :value="zone" />
        </datalist>
        <p id="pref-timezone-hint" class="hint">IANA time zone. Leave empty to clear it.</p>
      </div>

      <fieldset class="field">
        <legend>Show on the dashboard</legend>
        <label class="checkbox" for="pref-show-weekly-sp">
          <input id="pref-show-weekly-sp" v-model="form.showWeeklySp" type="checkbox" />
          Weekly story points
        </label>
        <label class="checkbox" for="pref-show-subtasks">
          <input id="pref-show-subtasks" v-model="form.showSubtasks" type="checkbox" />
          Subtasks
        </label>
        <label class="checkbox" for="pref-show-dependencies">
          <input id="pref-show-dependencies" v-model="form.showDependencies" type="checkbox" />
          Dependencies
        </label>
      </fieldset>

      <ErrorAlert v-if="saveError" :error="saveError" />
      <p v-if="saved && !hasChanges" class="alert alert--success" role="status">
        Preferences saved.
      </p>

      <div>
        <button type="submit" class="button button--primary" :disabled="!hasChanges || saving">
          {{ saving ? 'Saving…' : 'Save changes' }}
        </button>
      </div>
    </form>
  </section>
</template>
