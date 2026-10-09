/** ISO timestamp -> machine and human labels; null when the value is not a valid date. */
export function formatDateTime(value: string): { iso: string; label: string } | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    iso: date.toISOString(),
    label: new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' }).format(
      date,
    ),
  };
}

/** Time of day only (cards are all from today); null when the value is not a valid date. */
export function formatTime(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' }).format(date);
}

/** "+2 vs planned" only when both estimates exist and differ; otherwise null. */
export function storyPointsDeviation(final: number | null, planned: number | null): string | null {
  if (final === null || planned === null) return null;
  const diff = Number((final - planned).toFixed(2));
  if (diff === 0) return null;
  return `${diff > 0 ? '+' : '-'}${Math.abs(diff)} vs planned`;
}
