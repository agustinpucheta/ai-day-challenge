# Feature: jira-dashboard-mvp

- **Locator:** `odd/tasks/jira-dashboard-mvp.md`
- **Engram mirror:** `odd/jira-dashboard-mvp/tasks`
- **Branch:** `feat/jira-dashboard-mvp` (D-015)
- **Last updated:** 2026-10-09

## Objective

Deliver a local, per-user Jira Cloud dashboard (Vue 3 + Vite, NestJS, PostgreSQL/Prisma) that shows real epic/story progress, weekly consumed story points, subtasks, blocking dependencies and valid state transitions, using the owner's Jira API token (single-user local app, D-023; Atlassian OAuth 3LO kept as an optional mode for later multi-user adaptation).

## Problem

Progress, weekly SP and blockers are hard to read directly in Jira, and the instance has non-obvious configuration (two SP fields, localized issue types, many workflow statuses, automation noise in the changelog).

## Why

Give each user an explainable, deterministic view of real progress sourced from Jira, without shared credentials and without guessing the Jira configuration.

## Scope

MVP phases 0–9 from `docs/IMPLEMENTATION_PLAN.md`. The license flow is now in scope as F9 (D-020, D-021): manual form, optional AI-assisted draft, `.ics`. Out of scope: Microsoft SSO, Railway deploy, bulk/arbitrary edits, writing Outlook events via Microsoft Graph (optional post-MVP, F9.5), runtime LLM for metrics (LLM only drafts license requests).

## Constraints

- Jira is the source of truth; never invent field IDs, issue types or statuses without evidence.
- Decision D-023 (2026-10-09): the app is local and single-user; the Jira connection uses the owner's Jira Cloud API token (Basic auth) from `JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN` (same as the local Jira MCP), filled manually in `.env`. Credentials are resolved via `JiraCredentialProvider` (default `ApiTokenCredentialProvider`); OAuth stays as a dormant optional mode and per-user Jira isolation returns with the multi-user adaptation. Never trust a client-sent `userId`.
- No secrets in frontend, logs, versioned tests or API responses; tokens encrypted at rest.
- No writes to real Jira during discovery or tests; MCP is read-only and development-only.
- Metrics are deterministic, tested TypeScript; no LLM in metrics. Runtime LLM is allowed only to draft license requests (F9.4, D-021): it never writes to Jira; calendar-event creation via Outlook MCP is allowed only with user confirmation and only if the F9.0b spike passes (D-022 amends D-021).
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
- [x] **F2** — Jira connection (local API token; optional OAuth, D-023). Gate: with a fake Jira (HttpPort) the token never appears in logs/errors/responses; wrong/expired token yields a normalized `JIRA_REAUTH_REQUIRED`-style error distinct from empty data; unconfigured is a distinct state; 401/403/429 mapped. Small commits, one slice each (review-sized):
  - OAuth building blocks (kept as optional, dormant "OAuth mode"):
    - [x] F2.1 Token encryption (AES-256-GCM, key version) + env schema (Atlassian vars optional: unset = feature disabled) + migration for `jira_connections` and `oauth_states`.
    - [x] F2.2 OAuth state service (one-time, session-bound, short expiry) + Atlassian OAuth client (authorize URL, code exchange, accessible-resources, refresh) behind an injectable HTTP port; tests with a fake Atlassian.
    - [x] F2.3 Connections service: persist encrypted tokens per user+cloudId, serialized rotating refresh, `reauthorization_required` status, disconnect with revoke.
  - API token mode (default):
    - [x] F2.4 `JiraCredentialProvider.resolve(userId)` interface + `ApiTokenCredentialProvider` + env validation (`JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN` optional: unset = "not configured") + `GET /jira/connection` and a read-only "verify" action calling Jira `GET /rest/api/3/myself` returning only connected/siteUrl/displayName (never the token) + OpenAPI regenerated.
    - [x] F2.5 Frontend connection panel (not configured / verifying / connected / error / unauthorized token); regenerate API types.
    - [x] F2.6 Docs: create/rotate the token at id.atlassian.com (Security, API tokens), `.env` setup, troubleshooting.
  - Note: OAuth HTTP layer (start/callback/connections/disconnect) + OAuth frontend + multi-user isolation tests moved to the post-MVP backlog ("Backlog post-MVP: modo multiusuario con OAuth" in `docs/IMPLEMENTATION_PLAN.md`).
- [ ] **F3** — Jira Gateway and search/read. Gate: user sees a permitted real issue; inaccessible issues leak nothing; errors never become empty lists/0%. Small commits, one slice each:
  - [x] F3.1 Gateway read core: typed Jira field config (evidence-backed IDs), REST v3 normalizers (issue type by id/hierarchyLevel/subtask, status + statusCategory.key, both SP fields, parent, subtasks), safe JQL builder (key vs text, escaping), `searchIssues` (`nextPageToken`) and `getIssue`; REST v3 fixtures + contract tests.
  - [ ] F3.2 HTTP layer: `GET /jira/issues/search` and `GET /dashboard/issues/:issueKey` (normalized issue, subtasks, `fetchedAt`), inaccessible/not-found indistinguishable, OpenAPI regenerated; e2e with fake Jira.
  - [ ] F3.3 Frontend: search + issue detail with loading/error/empty/forbidden/stale states; regenerate API types.
  - [ ] F3.4 Docs + real read-only check against the owner's Jira.
- [ ] **F4** — Metrics, subtasks and weekly SP. Gate: tests for story without subtasks, empty epic, null fields, estimate changes, in/out of period, reopen, pagination, duplicates.
- [ ] **F5** — Blocking dependencies. Gate: fixtures for both link directions and an external blocker; direction not inverted.
- [ ] **F6** — Per-user preferences and tracking. Gate: two users have different tracked lists; data never crosses.
- [ ] **F7** — State transitions with user permissions. Gate: unauthorized user cannot transition; arbitrary transition IDs rejected; operation audited.
- [ ] **F8** — Base end-to-end hardening of phases 1–7 (MVP closure happens at F9). Gate: fresh setup from README; typecheck/lint/tests pass; no secrets; metrics verified against Jira.
- [ ] **F9** — License tickets from the dashboard (last MVP phase; closes the MVP, D-020/D-021). Gate: Jira-mock tests prove no ticket without confirmation, no duplicates, user isolation, invalid/inaccessible epic rejected without leaks, deterministic drafts, AI off/failing keeps manual flow, no real Jira writes in tests; one real ticket created once, manually, in an environment the user explicitly authorizes.
  - [ ] F9.0 Discovery (read-only): `Licencias` issue type (hierarchy level 0 in MASIN, evidence only), createmeta required fields/allowed values/epic `parent` relation; record in `docs/JIRA_DISCOVERY.md` + typed config; template marked "verificada" only after user review.
  - [ ] F9.0b Feasibility spike (D-022): headless Agent SDK `query()` run, inspect `system/init` (`mcp_servers`, `tools`) with subscription login and with `ANTHROPIC_API_KEY`; confirm (a) Microsoft 365 connector loads, (b) event-creation tools exist (admin write tools), (c) exact tool names, (d) `mcp-atlassian` tool names, (e) `~/.claude.json` entries load. No writes to Jira/Outlook.
  - [ ] F9.1 Backend: `POST /licenses/drafts` (deterministic, validated) and `POST /licenses` (explicit confirmation bound to draft id + content hash, idempotent, audited, Jira error mapping 403/400/429; scope `write:jira-work`).
  - [ ] F9.2 `.ics` generation (RFC 5545, all-day "Vacaciones", stable UID); document that it does not create the event inside Outlook.
  - [ ] F9.2b Agent creates the Outlook event via the Outlook MCP (chosen option, D-022; depends on F9.0b): agent proposes, UI shows event preview, user confirms before any write (`canUseTool`/hook), exact-tool allowlist, no Jira write tools reachable, runs reading Jira content cannot call calendar-write tools without the confirmation UI; `.ics` (F9.2) stays default and automatic fallback. Decision point after spike: keep F9.2b, switch to Graph (F9.5) or stay with `.ics`.
  - [ ] F9.3 Frontend "Licencias" view: form, epic search, draft preview, confirm, result with Jira link and "Descargar .ics"; loading/error/empty/forbidden/duplicate states.
  - [ ] F9.4 AI agent (feature flag, off without `ANTHROPIC_API_KEY`): free text to structured draft only; key in backend env; size/rate limits; content-free logs; fallback to manual form; prompt-injection handling; tests with a fake model client only.
  - [ ] F9.5 (optional, post-MVP) Read Outlook events via Microsoft Graph (`Calendars.Read`, Entra app, possible admin consent) with a "Generar ticket de licencia" button.

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

F2 is closed (commits 4bb7080, dcc89c0, 3ae7f9a, 6c2a6b9, ccaa4ff + docs). Real check on 2026-10-09: backend with the owner's env credentials, `POST /jira/connection/verify` returned `connected` for the fpatronal site (read-only `/myself`, temp local user deleted afterwards). Next: F3 Jira Gateway search/read (REST v3 fixtures, `nextPageToken` pagination, issue-type mapping by id/hierarchyLevel, no false zeros on errors).

## Open questions

1. Do cancelled issues stay in the progress denominator? (resolve before F4)
2. Does REST `/rest/api/3/issue/{key}/changelog` paginate beyond 100 entries as expected? (verify in F3)
3. How does Jira respond when a linked issue is not readable by the user? (needs a second account; F5)
4. `docs/API_CONTRACTS.md` lacks fields for the cancelled metric and planning deviation (update before F4).
5. License ticket template (issue type, required fields, epic relation) is PENDING until F9.0 discovery and user review.
6. Is a Microsoft Entra app registration available (possibly admin consent)? PENDING; only needed for optional F9.5.
7. F9.4 needs an `ANTHROPIC_API_KEY`; decide cost and rate/size limits before implementing.
8. Does the subscription-login policy for third-party Agent SDK apps cover a personal, single-user local app? UNVERIFIED (check Terms / ask Anthropic); gates F9.2b.
9. Did the org admin enable the Microsoft 365 connector write tools (calendar create/update/delete)? UNVERIFIED, likely off (only read tools were listed); resolved by F9.0b.
10. Do `~/.claude.json` local-scope MCP entries load in Agent SDK sessions? UNVERIFIED; until F9.0b the Jira MCP is declared explicitly in `mcpServers`.
11. ApiToken single identity: should registration be disabled after the owner account exists (`LOCAL_REGISTRATION_ENABLED=false`)?
