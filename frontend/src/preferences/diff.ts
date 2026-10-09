import type { Preferences, PreferencesUpdate } from '@/api/client';

/** Editable form model. The timezone is free text; blank means "not set". */
export interface PreferencesForm {
  weekStartsOn: Preferences['weekStartsOn'];
  timezone: string;
  showWeeklySp: boolean;
  showSubtasks: boolean;
  showDependencies: boolean;
}

const BOOLEAN_FIELDS = ['showWeeklySp', 'showSubtasks', 'showDependencies'] as const;

export function toForm(preferences: Preferences): PreferencesForm {
  return {
    weekStartsOn: preferences.weekStartsOn,
    timezone: preferences.timezone ?? '',
    showWeeklySp: preferences.showWeeklySp,
    showSubtasks: preferences.showSubtasks,
    showDependencies: preferences.showDependencies,
  };
}

/**
 * Builds the PATCH body with only the whitelisted fields that differ from what is stored.
 * Anything else on the form object (read-only or unknown keys) is ignored.
 */
export function diffPreferences(stored: Preferences, form: PreferencesForm): PreferencesUpdate {
  const update: PreferencesUpdate = {};
  if (form.weekStartsOn !== stored.weekStartsOn) {
    update.weekStartsOn = form.weekStartsOn;
  }
  const timezone = form.timezone.trim() || null;
  if (timezone !== stored.timezone) {
    update.timezone = timezone;
  }
  for (const field of BOOLEAN_FIELDS) {
    if (form[field] !== stored[field]) {
      update[field] = form[field];
    }
  }
  return update;
}
