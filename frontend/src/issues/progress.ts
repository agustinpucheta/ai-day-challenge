import type { IssueStatus, Progress } from '@/api/client';

/** "33.3%" / "100%": one decimal only when the value needs it. */
export function formatPercent(percent: number): string {
  return `${Math.round(percent * 10) / 10}%`;
}

/** The percent to draw, or null when there is nothing honest to draw (never a fake 0%). */
export function displayPercent(progress: Progress): number | null {
  if (progress.state !== 'ok' || progress.percent === null) return null;
  return Math.min(100, Math.max(0, progress.percent));
}

/** "7 of 12 done · 3 in progress · 2 pending · 1 cancelled": zero segments are omitted. */
export function countsText(progress: Progress): string {
  const parts = [`${progress.completed} of ${progress.total} done`];
  if (progress.inProgress > 0) parts.push(`${progress.inProgress} in progress`);
  if (progress.pending > 0) parts.push(`${progress.pending} pending`);
  if (progress.cancelled > 0) parts.push(`${progress.cancelled} cancelled`);
  return parts.join(' · ');
}

/** Available items are a subset of pending (D-025), shown as their own line. */
export function availableText(count: number): string {
  return `${count} available to take`;
}

export function unknownText(count: number): string {
  return `${count} ${count === 1 ? 'item' : 'items'} with unknown status`;
}

/** Copy for a progress that has no percentage. Never a number. */
export function noProgressText(progress: Progress): string {
  if (progress.state === 'all_cancelled') return 'All items cancelled';
  if (progress.basis === 'children') return 'No children yet';
  if (progress.basis === 'subtasks') return 'No subtasks yet';
  return 'Progress does not apply';
}

/** The six forms a station can take, in the order they are drawn along a line. */
export type StationKind = 'done' | 'inProgress' | 'pending' | 'available' | 'cancelled' | 'unknown';

export const STATION_ORDER: readonly StationKind[] = [
  'done',
  'inProgress',
  'pending',
  'available',
  'cancelled',
  'unknown',
];

/** Most stations a line ever draws; larger items are compressed and the words keep the counts. */
export const MAX_STATIONS = 24;

/** `count` is the exact number of items, `stations` how many are drawn for them. */
export interface StationRun {
  kind: StationKind;
  count: number;
  stations: number;
}

/**
 * The runs of stations for a line, in drawing order, skipping empty kinds. Available items are a
 * subset of pending (D-025), so they are drawn as their own run taken out of the pending one.
 * Above `max` the stations are shared out in proportion to the counts (largest remainder), but
 * every kind that has items keeps at least one station so nothing disappears from the line.
 */
export function stationPlan(progress: Progress, max: number = MAX_STATIONS): StationRun[] {
  const counts: Record<StationKind, number> = {
    done: progress.completed,
    inProgress: progress.inProgress,
    pending: Math.max(0, progress.pending - progress.available),
    available: progress.available,
    cancelled: progress.cancelled,
    unknown: progress.unknown,
  };
  const runs: StationRun[] = STATION_ORDER.filter((kind) => counts[kind] > 0).map((kind) => ({
    kind,
    count: counts[kind],
    stations: counts[kind],
  }));
  const total = runs.reduce((sum, run) => sum + run.count, 0);
  if (total <= max || runs.length === 0) return runs;

  const spare = Math.max(0, max - runs.length);
  const weight = total - runs.length;
  const shares = runs.map((run) => ((run.count - 1) * spare) / (weight || 1));
  runs.forEach((run, i) => {
    run.stations = 1 + Math.floor(shares[i]!);
  });
  let left = max - runs.reduce((sum, run) => sum + run.stations, 0);
  const byRemainder = runs
    .map((_, i) => i)
    .sort((a, b) => shares[b]! - Math.floor(shares[b]!) - (shares[a]! - Math.floor(shares[a]!)));
  for (const i of byRemainder) {
    if (left <= 0) break;
    runs[i]!.stations += 1;
    left -= 1;
  }
  return runs;
}

/** One of the four line inks for an issue, stable for a key so a line keeps its colour. */
export function lineTone(key: string): 0 | 1 | 2 | 3 {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (hash % 4) as 0 | 1 | 2 | 3;
}

/**
 * The station form that stands for one issue's status, so a list of issues speaks the same
 * language as a line: cancelled and available win over the category, as they do in the badge.
 */
export function statusStation(status: Readonly<IssueStatus>): StationKind {
  if (status.isCancelled) return 'cancelled';
  if (status.isAvailable) return 'available';
  switch (status.categoryKey) {
    case 'done':
      return 'done';
    case 'indeterminate':
      return 'inProgress';
    case 'new':
      return 'pending';
    default:
      return 'unknown';
  }
}

/** Ink index for the item at `position` in a list: cycles the four inks so neighbours differ. */
export function toneAt(position: number): 0 | 1 | 2 | 3 {
  return (((Math.trunc(position) % 4) + 4) % 4) as 0 | 1 | 2 | 3;
}
