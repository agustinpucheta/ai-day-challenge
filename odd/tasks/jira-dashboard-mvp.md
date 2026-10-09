# Feature: jira-dashboard-mvp

- **Locator:** `odd/tasks/jira-dashboard-mvp.md`
- **Engram mirror:** `odd/jira-dashboard-mvp/tasks`
- **Branch:** `feat/jira-dashboard-mvp` (D-015)
- **Last updated:** 2026-10-09

## Objective

Deliver a local, per-user Jira Cloud dashboard (Vue 3 + Vite, NestJS, PostgreSQL/Prisma) that shows real epic/story progress, weekly consumed story points, subtasks, blocking dependencies and valid state transitions, using each user's own Atlassian OAuth 3LO connection.

## Problem

Progress, weekly SP and blockers are hard to read directly in Jira, and the instance has non-obvious configuration (two SP fields, localized issue types, many workflow statuses, automation noise in the changelog).

## Why

Give each user an explainable, deterministic view of real progress sourced from Jira, without shared credentials and without guessing the Jira configuration.

## Scope

MVP phases 0–8 from `docs/IMPLEMENTATION_PLAN.md`. Out of scope: Microsoft SSO, Railway deploy, bulk/arbitrary edits, license ticket Skill, runtime LLM for metrics.

## Constraints

- Jira is the source of truth; never invent field IDs, issue types or statuses without evidence.
- Per-user isolation: every Jira call uses the authenticated user's own OAuth connection; never trust a client-sent `userId`.
- No secrets in frontend, logs, versioned tests or API responses; tokens encrypted at rest.
- No writes to real Jira during discovery or tests; MCP is read-only and development-only.
- Metrics are deterministic, tested TypeScript; no LLM at runtime.
- Transitions only if Jira offered them for that issue in that request.
- Strict TypeScript, validated DTOs, versioned migrations, unit + integration tests; modular monolith.
- Do not present stale data as current; expose fetch timestamps and distinguish error/empty/stale.

## Delivery strategy

- Strategy: `ask-on-risk`.
- Chain strategy: not chosen yet (ask when forecast or running count exceeds ~400 authored changed lines).
- Push, PR and merge remain user decisions. Nothing merges to `main` until phases are verified.

## Checklist

- [ ] **F0** — Phase 0: discovery, repository and Jira contract. Gate: no field ID, status name or issue type hardcoded without evidence.
  - [x] F0.1 Read-only Jira discovery done (`docs/JIRA_DISCOVERY.md`).
  - [x] F0.2 Kit moved to repository root (D-011).
  - [x] F0.3 `.env` / `.env.example` created (no secrets versioned).
  - [x] F0.4 Docs updated (JIRA_DISCOVERY, DECISIONS D-011..D-015, PRODUCT_SPEC §4, PIPELINES D/E, IMPLEMENTATION_PLAN).
  - [ ] F0.5 Work-unit commit (pending user approval).
- [ ] **F1** — Foundation and local login. Gate: two local users cannot read/modify each other's preferences; session/authorization tests pass.
- [ ] **F2** — Individual Jira Cloud OAuth. Gate: user B cannot use user A's connection or inspect tokens; tests cover invalid callback, state replay, expiry, refresh rotation, revocation.
- [ ] **F3** — Jira Gateway and search/read. Gate: user sees a permitted real issue; inaccessible issues leak nothing; errors never become empty lists/0%.
- [ ] **F4** — Metrics, subtasks and weekly SP. Gate: tests for story without subtasks, empty epic, null fields, estimate changes, in/out of period, reopen, pagination, duplicates.
- [ ] **F5** — Blocking dependencies. Gate: fixtures for both link directions and an external blocker; direction not inverted.
- [ ] **F6** — Per-user preferences and tracking. Gate: two users have different tracked lists; data never crosses.
- [ ] **F7** — State transitions with user permissions. Gate: unauthorized user cannot transition; arbitrary transition IDs rejected; operation audited.
- [ ] **F8** — End-to-end and MVP closure. Gate: fresh setup from README; typecheck/lint/tests pass; no secrets; metrics verified against Jira.

## Progress and evidence

### F0 discovery evidence (2026-10-09, read-only MCP, no writes)

- Jira Cloud site with main project MASIN; issue types must be mapped by id/hierarchyLevel (`issuetype = Historia` silently returns empty; `Story` works).
- SP fields: `customfield_10023` "Story Points" (planned) and `customfield_10204` "StoryPoint Finales" (final, used for consumed SP); SP summed only from subtasks.
- Completed = `statusCategory.key = done` and not Cancelado (status 10000); `resolution` is rarely set and not used.
- Changelog carries status/SP from/to; automation writes `from == to` entries that must be filtered; MCP changelog appears capped at 100 entries.
- `Blocks` link type id 10000: outward on X means X blocks Y; cross-epic and cross-project blockers exist; transition IDs depend on source status.

### Route declaration

- **F0 exploration:** delegated to one read-only explorer (trigger: more than 5 sequential MCP lookups).
- **F0 docs:** delegated to one writer (trigger: 5 non-trivial files edited).

## Next step

Commit F0 after explicit user approval of the commit message, then start Phase 1 (F1).

## Open questions

1. Do cancelled issues stay in the progress denominator? (resolve before F4)
2. Does REST `/rest/api/3/issue/{key}/changelog` paginate beyond 100 entries as expected? (verify in F3)
3. How does Jira respond when a linked issue is not readable by the user? (needs a second account; F5)
4. `docs/API_CONTRACTS.md` lacks fields for the cancelled metric and planning deviation (update before F4).
