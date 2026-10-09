<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api, type Preferences } from '@/api/client';
import ErrorAlert from '@/components/ErrorAlert.vue';
import { es } from '@/i18n/es';
import { diffPreferences, toForm, type PreferencesForm } from '@/preferences/diff';

const WEEK_START_OPTIONS: { value: Preferences['weekStartsOn']; label: string }[] = [
  { value: 'monday', label: es.settings.monday },
  { value: 'sunday', label: es.settings.sunday },
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
    <header class="page-header">
      <h1 id="settings-title">{{ es.settings.title }}</h1>
    </header>

    <div v-if="loading" class="card form-card stack" aria-busy="true">
      <p class="muted">{{ es.settings.loading }}</p>
      <div aria-hidden="true" class="stack">
        <span class="skeleton skeleton--title"></span>
        <span class="skeleton skeleton--field"></span>
        <span class="skeleton skeleton--field"></span>
      </div>
    </div>

    <div v-else-if="loadError" class="card form-card stack">
      <ErrorAlert :error="loadError" />
      <div>
        <button type="button" class="button" @click="load">{{ es.common.retry }}</button>
      </div>
    </div>

    <form v-else-if="form" class="card form-card stack" novalidate @submit.prevent="onSubmit">
      <h2 class="card__title">{{ es.settings.heading }}</h2>

      <div class="field">
        <label for="pref-week-start">{{ es.settings.weekStart }}</label>
        <select id="pref-week-start" v-model="form.weekStartsOn">
          <option v-for="option in WEEK_START_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>

      <div class="field">
        <label for="pref-timezone">{{ es.settings.timezone }}</label>
        <input
          id="pref-timezone"
          v-model="form.timezone"
          type="text"
          list="pref-timezone-options"
          autocomplete="off"
          :placeholder="es.settings.timezonePlaceholder"
          aria-describedby="pref-timezone-hint"
        />
        <datalist id="pref-timezone-options">
          <option v-for="zone in timezones" :key="zone" :value="zone" />
        </datalist>
        <p id="pref-timezone-hint" class="hint">
          {{ es.settings.timezoneHint }}
        </p>
      </div>

      <fieldset class="field">
        <legend>{{ es.settings.show }}</legend>
        <label class="checkbox" for="pref-show-weekly-sp">
          <input id="pref-show-weekly-sp" v-model="form.showWeeklySp" type="checkbox" />
          {{ es.settings.weeklySp }}
        </label>
        <label class="checkbox" for="pref-show-subtasks">
          <input id="pref-show-subtasks" v-model="form.showSubtasks" type="checkbox" />
          {{ es.settings.subtasks }}
        </label>
        <label class="checkbox" for="pref-show-dependencies">
          <input id="pref-show-dependencies" v-model="form.showDependencies" type="checkbox" />
          {{ es.settings.dependencies }}
        </label>
      </fieldset>

      <ErrorAlert v-if="saveError" :error="saveError" />
      <p v-if="saved && !hasChanges" class="alert alert--success" role="status">
        {{ es.settings.saved }}
      </p>

      <div class="form-actions">
        <button type="submit" class="button button--primary" :disabled="!hasChanges || saving">
          {{ saving ? es.settings.saving : es.settings.save }}
        </button>
      </div>
    </form>
  </section>
</template>
