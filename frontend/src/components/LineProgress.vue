<script setup lang="ts">
import { computed } from 'vue';
import type { Progress } from '@/api/client';
import { countsText, displayPercent, formatPercent, stationPlan, toneAt } from '@/issues/progress';
import StationMark from './StationMark.vue';

/**
 * Progress drawn as a transit line: stations passed are the work done, the line is solid up to the
 * current position and dashed beyond it. Counts-based, never item-based, so a long epic is
 * compressed to a few stations while the words next to the line keep the exact counts.
 * Without an honest percentage (no items, all cancelled, a failed read) it never draws a number:
 * an empty dotted line, a struck line or a broken line says so by form.
 */
const props = withDefaults(
  defineProps<{
    /** Omit (or pass `broken`) when the read failed: there is nothing to measure. */
    progress?: Progress | null;
    /** Index of the line ink, 0 to 3; wraps around. Assigned by position in the list. */
    toneIndex?: number;
    /** `sm` for a row of a table, `lg` for the head of a detail page. */
    size?: 'sm' | 'md' | 'lg';
    /** Accessible name of the progressbar, e.g. "MASIN-1 progress". */
    label: string;
    broken?: boolean;
  }>(),
  { progress: null, toneIndex: 0, size: 'md', broken: false },
);

const percent = computed(() =>
  props.broken || !props.progress ? null : displayPercent(props.progress),
);
const percentText = computed(() => (percent.value === null ? null : formatPercent(percent.value)));
/** The number without its unit so the unit can be set smaller; the unit stays in the DOM text. */
const figure = computed(() => percentText.value?.replace('%', '') ?? '');

const variant = computed<'ok' | 'none' | 'all_cancelled' | 'broken'>(() => {
  if (props.broken || !props.progress) return 'broken';
  if (percent.value !== null) return 'ok';
  return props.progress.state === 'all_cancelled' ? 'all_cancelled' : 'none';
});

const runs = computed(() =>
  variant.value === 'ok' && props.progress ? stationPlan(props.progress) : [],
);

/** Flat list of stations: each knows whether the line leading to it has been travelled. */
const stations = computed(() => {
  let index = 0;
  return runs.value.flatMap((run) =>
    Array.from({ length: run.stations }, () => ({
      key: index++,
      kind: run.kind,
      reached: run.kind === 'done' || run.kind === 'inProgress',
    })),
  );
});
const compressed = computed(() => {
  const total = runs.value.reduce((sum, run) => sum + run.count, 0);
  return total > stations.value.length;
});

const valueText = computed(() =>
  percentText.value && props.progress
    ? `${percentText.value}, ${countsText(props.progress)}`
    : undefined,
);
const tone = computed(() => toneAt(props.toneIndex));
</script>

<template>
  <div
    class="line-progress"
    :data-tone="tone"
    :data-size="size"
    :data-state="variant"
    :data-compressed="compressed || undefined"
    :style="{ '--stations': stations.length || undefined }"
  >
    <p v-if="variant !== 'broken'" class="line-progress__figure">
      <span v-if="percentText" class="line-progress__percent"
        >{{ figure }}<span class="line-progress__unit">%</span></span
      >
      <span v-else class="line-progress__percent line-progress__percent--none" aria-hidden="true"
        >&ndash;</span
      >
    </p>

    <div
      v-if="variant === 'ok'"
      class="line-progress__line"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="percent ?? undefined"
      :aria-valuetext="valueText"
      :aria-label="label"
    >
      <div class="line-progress__rail" aria-hidden="true">
        <template v-for="(station, i) in stations" :key="station.key">
          <span
            v-if="i > 0"
            class="line-progress__segment"
            :data-travelled="station.reached || undefined"
          ></span>
          <StationMark :kind="station.kind" />
        </template>
      </div>
    </div>

    <div v-else class="line-progress__line" aria-hidden="true">
      <div class="line-progress__rail">
        <span class="line-progress__segment line-progress__segment--empty"></span>
        <template v-if="variant !== 'none'">
          <svg
            :class="['line-progress__mark', `line-progress__mark--${variant}`]"
            viewBox="0 0 24 24"
            focusable="false"
          >
            <path v-if="variant === 'all_cancelled'" d="M4 20L20 4" />
            <path v-else d="M3 12H8L10.5 6L13.5 18L16 12H21" />
          </svg>
          <span class="line-progress__segment line-progress__segment--empty"></span>
        </template>
      </div>
    </div>
  </div>
</template>
