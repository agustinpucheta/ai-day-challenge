import { JIRA_CONFIG } from '../jira/jira.config';

/** What the calculation needs from an issue. Names and ids never matter here. */
export interface ProgressItem {
  key: string;
  status: { categoryKey: 'new' | 'indeterminate' | 'done' | 'unknown'; isCancelled: boolean };
}

export type ProgressBasis = 'subtasks' | 'children';

/** `none`: nothing to measure (no data is not 0%). `all_cancelled`: every item was cancelled. */
export type ProgressState = 'ok' | 'none' | 'all_cancelled';

export interface ProgressOptions {
  basis: ProgressBasis;
  /** D-024. Defaults to the typed config (false: cancelled items leave the denominator). */
  cancelledCountsInDenominator?: boolean;
}

export interface ProgressResult {
  basis: ProgressBasis;
  /**
   * Denominator: completed + inProgress + pending + unknown, plus `cancelled` only when
   * `cancelledCountsInDenominator` is true.
   */
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  /** Always reported, in or out of the denominator. */
  cancelled: number;
  /** Items whose status category is not recognized: never completed, always counted here. */
  unknown: number;
  /** 0-100 with one decimal; `null` when there is nothing to divide by (never 0 for no data). */
  percent: number | null;
  state: ProgressState;
}

/**
 * Count-based progress (D-014, D-024). Duplicated keys count once (the first one wins). Completed
 * means category `done` and not cancelled; a cancelled item is never completed.
 */
export function computeProgress(
  items: readonly ProgressItem[],
  options: ProgressOptions,
): ProgressResult {
  const countCancelled =
    options.cancelledCountsInDenominator ?? JIRA_CONFIG.cancelledCountsInDenominator;
  const seen = new Set<string>();
  let completed = 0;
  let inProgress = 0;
  let pending = 0;
  let cancelled = 0;
  let unknown = 0;
  for (const item of items) {
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    const { categoryKey, isCancelled } = item.status;
    if (isCancelled) cancelled += 1;
    else if (categoryKey === JIRA_CONFIG.doneCategoryKey) completed += 1;
    else if (categoryKey === 'indeterminate') inProgress += 1;
    else if (categoryKey === 'new') pending += 1;
    else unknown += 1;
  }
  const total = completed + inProgress + pending + unknown + (countCancelled ? cancelled : 0);
  const state: ProgressState = total > 0 ? 'ok' : cancelled > 0 ? 'all_cancelled' : 'none';
  return {
    basis: options.basis,
    total,
    completed,
    inProgress,
    pending,
    cancelled,
    unknown,
    percent: total > 0 ? Math.round((completed / total) * 1000) / 10 : null,
    state,
  };
}
