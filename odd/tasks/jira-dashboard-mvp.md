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

- [x] **F0** — Phase 0: discovery, repository and Jira contract. Gate: no field ID, status name or issue type hardcoded without evidence.
  - [x] F0.1 Read-only Jira discovery done (`docs/JIRA_DISCOVERY.md`).
  - [x] F0.2 Kit moved to repository root (D-011).
  - [x] F0.3 `.env` / `.env.example` created (no secrets versioned).
  - [x] F0.4 Docs updated (JIRA_DISCOVERY, DECISIONS D-011..D-015, PRODUCT_SPEC §4, PIPELINES D/E, IMPLEMENTATION_PLAN).
  - [x] F0.5 Work-unit commit `34487ba`, pushed to `origin/feat/jira-dashboard-mvp`. Review: passive docs-only, no review needed.
- [x] **F1** — Foundation and local login. Gate: two local users cannot read/modify each other's preferences; session/authorization tests pass.
  - [x] F1.1 D-016 recorded: independent `frontend/` and `backend/` projects (no workspace) + root orchestrator `package.json` (dev:frontend, dev:backend, dev both). ARCHITECTURE structure updated.
  - [x] F1.2 Root: orchestrator scripts, `infrastructure/docker-compose.yml` (PostgreSQL from `.env`).
  - [x] F1.3 Backend: NestJS strict TS, lint/format/typecheck/test, Prisma schema + initial migration (users, external_identities, sessions, user_preferences, audit_events).
  - [x] F1.4 Backend: register/login/logout/me, Argon2id, PostgreSQL-backed server session, session guard, global DTO validation, login rate limit, GET/PATCH own preferences; isolation tests.
  - [x] F1.4b Swagger/OpenAPI at /api/docs + openapi:export (user request, pulled from Phase 3).
  - [x] F1.5 Frontend: Vue 3 + Vite + TS + Router, lint/format/typecheck/test, base layout, login/register views, auth state, Jira connection placeholder states.
  - [x] F1.6 Phase close: commits 8807b3f (backend) and 907339d (frontend), pushed. Native review: declined by context budget (lens_context_budget_exceeded, 137 files / ~18k lines); user chose to skip. Lesson: keep commits small so each is reviewable.
- [ ] **F2** — Individual Jira Cloud OAuth. Gate: user B cannot use user A's connection or inspect tokens; tests cover invalid callback, state replay, expiry, refresh rotation, revocation. Small commits, one slice each (review-sized):
  - [x] F2.1 Token encryption (AES-256-GCM, key version) + env schema (Atlassian vars optional: unset = feature disabled) + migration for `jira_connections` and `oauth_states`.
  - [x] F2.2 OAuth state service (one-time, session-bound, short expiry) + Atlassian OAuth client (authorize URL, code exchange, accessible-resources, refresh) behind an injectable HTTP port; tests with a fake Atlassian.
  - [ ] F2.3 Connections service: persist encrypted tokens per user+cloudId, serialized rotating refresh, `reauthorization_required` status, disconnect with revoke.
  - [ ] F2.4 HTTP layer: oauth start/callback, GET/DELETE connections, `/auth/me` jira status, OpenAPI regenerated; e2e with fake Atlassian (invalid callback, state replay, expiry, rotation, revocation, user isolation).
  - [ ] F2.5 Frontend: Connect Jira button, connected/reauth/not-configured states, disconnect; regenerate API types.
  - [ ] F2.6 Docs: setup of Atlassian app + scope justification; real login manual check by user (pending credentials).
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

### F1 backend evidence (2026-10-09)

- db:up healthy; migration 20261009153725_init applied; backend lint 0 problems; typecheck ok; unit 35/35 (parent re-ran: 35/35); e2e 17/17 on jira_dashboard_test; health 200, me 401, foreign Origin 403.
- Stack: NestJS 11, TS 5.9.3, Prisma 7.10.0 + adapter-pg, Jest 30, express-session + connect-pg-simple.
- .env.example could not be updated (user permission deny on .env*); pending manual: LOCAL_REGISTRATION_ENABLED, AUTH_RATE_LIMIT_PER_MINUTE, SESSION_SECRET >= 32 chars note.

### Route declaration

- **F0 exploration:** delegated to one read-only explorer (trigger: more than 5 sequential MCP lookups).
- **F0 docs:** delegated to one writer (trigger: 5 non-trivial files edited).
- **F1 backend+infra:** delegated to one writer (trigger: many non-trivial files). Frontend: separate sequential writer.

## Next step

F2.1 token encryption + schema. User creates the Atlassian OAuth app and fills ATLASSIAN_CLIENT_ID/SECRET in .env meanwhile; code and tests use a fake Atlassian.

## Open questions

1. Do cancelled issues stay in the progress denominator? (resolve before F4)
2. Does REST `/rest/api/3/issue/{key}/changelog` paginate beyond 100 entries as expected? (verify in F3)
3. How does Jira respond when a linked issue is not readable by the user? (needs a second account; F5)
4. `docs/API_CONTRACTS.md` lacks fields for the cancelled metric and planning deviation (update before F4).
