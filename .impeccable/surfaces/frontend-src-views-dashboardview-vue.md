---
version: 1
slug: "frontend-src-views-dashboardview-vue"
primary_target: "frontend/src/views/DashboardView.vue"
related_targets: ["frontend/src/views/IssueSearchView.vue","frontend/src/views/IssueDetailView.vue","frontend/src/views/LoginView.vue"]
---

# Surface brief: Jira Dashboard frontend (whole app)

## Scope and visitor mode

Operate. One surface family: the whole Vue frontend (login/register, "Mi seguimiento" home, issue search, issue detail with epic stories and subtasks, settings, Jira connection panel). Redesign: the current generic look is evidence of what to leave behind; product truth, copy meaning, behaviour and accessibility stay.

## Audience, job, constraints

Single daily user following epics and stories in Jira Cloud. Job: know the real progress at a glance, see what is available to take, open the issue in Jira. Light and dark themes following the system. Balanced density. Spanish UI with Jira terms kept in English (Epic, Story points, Track). The first warm/earthy (cream, ochre, brown) palette was built, seen rendered and REJECTED by the user on 2026-10-09; the user then chose direction "Subte de noche" from a rendered comparison (midnight-blue enamel, real subte line colours, porcelain white in light). No browns. Rejected: generic corporate panel, cold technical console, noisy, decorative or childish. Standard controls and layout (Operate): the world lends type, palette, density and one signature move only.

## Chosen direction

User-chosen challenger "midnight transit diagram" (wayfinding-cartography-signage-midnight-transit-diagram), carried through the Argentine reader's own experience of the Buenos Aires subte map, translated into the pinned warm earthy palette. Memorable moment: every followed epic reads as a transit line whose stations passed are the work done.

## Direction contract

THESIS: Progress is a journey along a line, not a bar filling up. Each epic or story owns one line; stations passed are finished items, the next stations ahead are the work left. The page refuses the category default of identical white cards with a thin blue progress bar and a grey number.

OWN-WORLD: Midnight enamel and porcelain in both themes: light ground is cool porcelain white with navy ink text; dark ground is midnight-blue enamel (not black) with porcelain text and a signal-yellow primary. Line inks are the subte line colours: celeste, rojo, verde and violeta, one per line, used only to colour a line and its stations; available-to-take is signal yellow (dark) or amber (light). Stations are porcelain-white circles with a heavy ring; passed stations are filled with the line ink, the line itself is drawn solid up to the current position and dashed beyond it. State is carried by form as well as hue: cancelled station is hollow with a strike, available station has a double ring with a short flag, unknown has a dotted ring. Type is a humanist transit-style sans (large tabular numerals for percentages, small tight labels for station and state names), 45/90 degree geometry only, 1px porcelain rules instead of shadows. Recognisable with all text removed: a bold coloured line with ringed stations on cream or umber.

STORY: The owner opens the app and, before reading anything, sees how far each followed line has travelled; the percentage is the largest figure on the card, the counts sit beside it, and amber-ringed "available" stations show what can be taken now. They believe the numbers because missing data, errors and cancelled work look different from progress. They act: open stories, open in Jira, stop tracking.

FIRST VIEWPORT: Standard Operate shell: top bar with product name, nav (Mi seguimiento, Issues), connection status as one quiet line, theme-aware. Below, a heading row (title, last updated, Refresh, search). Then a responsive grid of followed items, two columns on desktop, balanced density. Each card: line colour tab at the left, key and summary, status and type badges, the percentage as the biggest numeral on the card, and the transit line drawn full width beneath it with stations ordered done, in progress, pending, available, cancelled, exact counts in words under the line, story points planned versus final, and the card actions. Errors and unavailable data replace the line with a broken-line state, never a zero.

FORM: midnight transit diagram (user-chosen challenger; the dealt assignment was candidate 3 of 7, the tiled-wall direction; ordered list: 1 libro de obra, 2 avance de cosecha, 3 muro de azulejos, 4 cuaderno cuadriculado, 5 plano de mensura, 6 chapa enlozada, 7 almanaque de campo). Seed key 068055cb. Raises kept from declined challengers: always-visible coded legend of states (orienteering), state by form and not hue alone (emission-line rail), destructive actions isolated and calm (dark console). Only as type, palette, density and the one signature move (the progress line with stations); layout, navigation and controls stay standard.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved decisions

- Font: prefer a self-hosted humanist sans (Atkinson Hyperlegible Next via fontsource if available) or a system humanist stack; decide at build with a stated reason.
- How stations compress when an item has more than ~24 children (show proportional stations plus exact counts in words).
