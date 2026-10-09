import type { Progress } from '@/api/client';

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
