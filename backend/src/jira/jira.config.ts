/**
 * Typed configuration of the Jira instance. Every id below comes from the read-only discovery
 * recorded in `docs/JIRA_DISCOVERY.md` (2026-10-09). Names are never used to classify anything.
 */
export const JIRA_CONFIG = {
  fields: {
    /**
     * "StoryPoint Finales" (number): the consumed/completed SP metric (D-012). Differs from the
     * planned value in MASIN-13347, MASIN-13160 and MASIN-3005; null in MASIN-13346.
     * Discovery: "Story points".
     */
    storyPointsFinal: 'customfield_10204',
    /**
     * "Story Points" (number): planning estimate, used only to show the planning deviation
     * (D-012). Populated in MASIN-12238, MASIN-8181, MASIN-10730 and MASIN-12235.
     */
    storyPointsPlanned: 'customfield_10023',
    /**
     * "Enlace de epic" (legacy Epic Link): informational only; hierarchy is read from `parent`
     * (modern hierarchy confirmed with `parent = MASIN-10713`). Discovery: "Jerarquía".
     */
    epicLink: 'customfield_10013',
  },
  /** Status categories exposed by Jira (`statusCategory.key`). Discovery: "Estados y categorías". */
  statusCategoryKeys: ['new', 'indeterminate', 'done'],
  /** Category that means finished. A cancelled status is `done` too but is not completed. */
  doneCategoryKey: 'done',
  /** "Cancelado" status id (D-014; category `done`). Configured, never inferred from names. */
  cancelledStatusId: '10000',
  /**
   * D-025: statuses that mean "available to take". "Esperar Recurso" (id 10068, category `new`
   * "Por hacer"), see `docs/JIRA_DISCOVERY.md` ("Estados y categorías"). Configured by id, never
   * inferred from names; re-verify the id against the real site.
   */
  availableStatusIds: ['10068'] as readonly string[],
  /** Page size bounds for the enhanced search (the MCP limit observed was 1..50). */
  search: { defaultPageSize: 20, maxPageSize: 50 },
  /** Issue types at this hierarchy level or above (epics) have children resolved via `parent`. */
  childrenMinHierarchyLevel: 1,
  /**
   * Hard cap for the children of one epic: `pageSize * maxPages` (= 300). Hitting it marks the
   * progress as approximate and adds a warning (never a silent truncation).
   */
  children: { pageSize: 50, maxPages: 6 },
  /**
   * D-024: cancelled issues are excluded from the progress denominator by default and reported
   * separately. Set to true to count them as not completed instead.
   */
  cancelledCountsInDenominator: false,
} as const;

export type JiraStatusCategoryKey = (typeof JIRA_CONFIG.statusCategoryKeys)[number];

/** Fields requested from Jira on every search and issue read. */
export const JIRA_ISSUE_FIELDS: readonly string[] = [
  'summary',
  'issuetype',
  'status',
  'parent',
  'subtasks',
  'issuelinks',
  JIRA_CONFIG.fields.storyPointsFinal,
  JIRA_CONFIG.fields.storyPointsPlanned,
  'resolution',
  'updated',
  'created',
  'project',
];
