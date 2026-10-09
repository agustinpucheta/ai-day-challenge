# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A single person (the owner) who uses the dashboard every day on their own machine to follow how their epics and stories are progressing in Jira Cloud, and to see which items are available to take. A team version may come later; it is not a design driver now.

## Product Purpose

A personal progress-tracking dashboard over Jira Cloud. The owner chooses which epics or stories to follow; the dashboard shows, for each one, how much is really done (percentage of progress with absolute counts), the stories or subtasks underneath, story points planned versus final, and which items are available to take. Success is opening the screen and knowing the real state of the work in seconds, without opening Jira.

## Positioning

Honest progress. Numbers come only from Jira or from documented deterministic rules: missing data is never shown as 0%, cancelled work is reported apart instead of inflating or deflating progress, a failed request is shown as an error and never as an empty list, and the age of the data is always visible.

## Operating Context

- Jira Cloud site `fpatronal.atlassian.net`, project MASIN (other projects such as MAADM, MAART and INC appear in search results).
- Local web app: Vue 3 front end and NestJS API on the owner's machine, reached at `localhost`; Jira is accessed with the owner's own API token (decision D-023).
- Hierarchy in this Jira: Epic, then stories and other level-0 issues, then subtasks. Story points are summed from subtasks only.
- Workflow statuses are many (DEV/TEST/UAT/PROD stages); progress relies on the status category, never on status names.
- "Esperar Recurso" (status id 10068) means an item is available to take.
- "Cancelado" counts as done in Jira's category but is treated as cancelled, not completed.

## Capabilities and Constraints

- Today: login with a local account; Jira connection status; issue search by key or text; issue detail with subtasks, epic stories and story points; progress per issue; followed issues ("My tracking") with per-item errors.
- In progress or planned: "available to take" differentiation, weekly consumed story points, blocking dependencies, status transitions, license-ticket flow.
- No chart libraries or UI kits are required; add a dependency only with a stated need.
- Data may be stale or fail: the interface must distinguish loading, empty, error, forbidden, stale and success states.
- Terminology to keep exactly as Jira shows it: Epic, Story points, Track (follow), plus the Spanish names of statuses and issue types.

## Brand Commitments

- Interface language: Spanish, keeping Jira terms in English (for example Epic, Story points, Track). Confirmed by the owner on 2026-10-09.
- No existing name, logo or brand assets. The product name is not decided (working title: Jira Dashboard).

## Evidence on Hand

- Live data from the owner's own Jira through the API; no stock content, testimonials or benchmarks exist and none may be invented.
- Real progress examples confirmed against Jira: an epic with 33 children (1 cancelled) showing 62.5%, and a story with 6 subtasks (1 cancelled) showing 60%.

## Product Principles

1. Progress at a glance comes first: the percentage and the counts behind it are the most prominent thing on the main screen.
2. Honest numbers: no invented zeros, no silent fallbacks, always show where a number comes from and how fresh it is.
3. Errors are errors: a failure, an empty result and a loading state each look different.
4. Built for daily repeat use by one person: fast to scan, calm, and quick to act on (follow, unfollow, open in Jira).
5. Available-to-take work and cancelled work are visible but never confused with progress.

## Accessibility & Inclusion

No formal standard was named by the owner. The existing interface already relies on text labels beside colour, `aria-live` status updates, `role="progressbar"` for progress, and visible focus states; future work must keep status and progress understandable without relying on colour alone.
