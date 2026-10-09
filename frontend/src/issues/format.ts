import { es } from '@/i18n/es';

const LOCALE = 'es-AR';

/** ISO timestamp -> machine and human labels ("9 oct 2026, 16:39"); null when not a valid date. */
export function formatDateTime(
  value: string,
  timeZone?: string,
): { iso: string; label: string } | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    iso: date.toISOString(),
    label: new Intl.DateTimeFormat(LOCALE, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone,
    }).format(date),
  };
}

/** Time of day only, 24h ("16:39"; cards are all from today); null when not a valid date. */
export function formatTime(value: string, timeZone?: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(date);
}

/** "+2 vs planificados" only when both estimates exist and differ; otherwise null. */
export function storyPointsDeviation(final: number | null, planned: number | null): string | null {
  if (final === null || planned === null) return null;
  const diff = Number((final - planned).toFixed(2));
  if (diff === 0) return null;
  return es.storyPoints.deviation(diff > 0 ? '+' : '-', Math.abs(diff));
}
