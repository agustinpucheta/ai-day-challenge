import { z } from 'zod';
import { JiraProtocolError } from '../errors';
import { JIRA_CONFIG, type JiraStatusCategoryKey } from '../jira.config';
import type { JiraIssue, JiraIssueType, JiraStatus } from './jira-issue';

const issueTypeSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  hierarchyLevel: z.number().int(),
  subtask: z.boolean(),
});

const statusSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  statusCategory: z.object({ key: z.string() }).optional(),
});

const storyPointsSchema = z.number().finite().nullish();

/** Strict on the parts we consume; unknown keys are tolerated (stripped or caught). */
const issueSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  fields: z
    .object({
      summary: z.string(),
      issuetype: issueTypeSchema,
      status: statusSchema,
      project: z.object({ key: z.string().min(1) }),
      parent: z
        .object({
          key: z.string().min(1),
          fields: z
            .object({
              summary: z.string().optional(),
              issuetype: z.unknown().optional(),
            })
            .optional(),
        })
        .nullish(),
      subtasks: z
        .array(
          z.object({
            key: z.string().min(1),
            fields: z.object({ summary: z.string(), status: statusSchema }),
          }),
        )
        .nullish(),
    })
    .catchall(z.unknown()),
});

const CATEGORY_KEYS: readonly string[] = JIRA_CONFIG.statusCategoryKeys;

function mapStatus(raw: z.infer<typeof statusSchema>): JiraStatus {
  const key = raw.statusCategory?.key;
  return {
    id: raw.id,
    name: raw.name,
    categoryKey:
      key !== undefined && CATEGORY_KEYS.includes(key) ? (key as JiraStatusCategoryKey) : 'unknown',
    isCancelled: raw.id === JIRA_CONFIG.cancelledStatusId,
  };
}

function mapIssueType(raw: z.infer<typeof issueTypeSchema>): JiraIssueType {
  return {
    id: raw.id,
    name: raw.name,
    hierarchyLevel: raw.hierarchyLevel,
    isSubtask: raw.subtask,
  };
}

/** Absent/null stays null; anything that is not a finite number is a contract violation. */
function readStoryPoints(fields: Record<string, unknown>, fieldId: string): number | null {
  const parsed = storyPointsSchema.safeParse(fields[fieldId]);
  if (!parsed.success) throw new JiraProtocolError();
  return parsed.data ?? null;
}

/** Normalizes one REST v3 issue payload. Throws `JiraProtocolError` on unexpected shapes. */
export function mapJiraIssue(payload: unknown, siteUrl: string): JiraIssue {
  const parsed = issueSchema.safeParse(payload);
  if (!parsed.success) throw new JiraProtocolError();
  const { id, key, fields } = parsed.data;
  const parentSummary = fields.parent?.fields?.summary;
  const parentType = issueTypeSchema.safeParse(fields.parent?.fields?.issuetype);
  return {
    id,
    key,
    summary: fields.summary,
    issueType: mapIssueType(fields.issuetype),
    status: mapStatus(fields.status),
    storyPoints: {
      final: readStoryPoints(fields, JIRA_CONFIG.fields.storyPointsFinal),
      planned: readStoryPoints(fields, JIRA_CONFIG.fields.storyPointsPlanned),
    },
    parent: fields.parent
      ? {
          key: fields.parent.key,
          ...(parentSummary !== undefined && { summary: parentSummary }),
          ...(parentType.success && { issueType: mapIssueType(parentType.data) }),
        }
      : null,
    subtasks: (fields.subtasks ?? []).map((subtask) => ({
      key: subtask.key,
      summary: subtask.fields.summary,
      status: mapStatus(subtask.fields.status),
    })),
    url: `${siteUrl.replace(/\/+$/, '')}/browse/${key}`,
    projectKey: fields.project.key,
  };
}
