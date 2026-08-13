# Mobile Design Audit — Agent Portal (end to end)

Audit basis: a pass over every portal route and shared portal component in code, plus a scripted 390px sweep of the app. The scripted sweep could not reach authenticated screens (no signed-in session is available to the tester right now), so the findings below come from the layout code itself; each fix names the file it lives in. Nothing about data, permissions, emails, or automation changes — this is presentation only.

Target widths: 320, 375, 390, 430, and 768px.

## What's already right

The shared kit (`src/components/portal/ui.tsx`) has a real mobile story: the drawer becomes a bottom sheet, the sidebar becomes an off-canvas panel with a backdrop, metric rows drop to two columns, tabs and toolbars scroll horizontally, and tables sit in an `overflow-x-auto` wrapper. The gaps are consistency and a handful of screens that were only designed for desktop.

## Findings and fixes

### 1. Tables squash instead of scrolling (high)
`Table` wraps in a horizontal scroller, but only Leaderboard and Admin > Users set a `min-w`. Everywhere else (Applicants list, Tasks, Admin > Stages, Admin > Audit, Admin > Emails log, Organization) columns compress to unreadable slivers on a phone.

Fix: give `Table` a default minimum width so every table scrolls rather than crushes, and for the two heaviest lists — Applicants and Admin > Users — render a stacked card row under `sm` (name + stage badge on line one, email/phone and the row action beneath) instead of a scrollable grid.

### 2. Calendar is desktop-only (high)
`calendar.tsx` renders a 7-column month grid at `min-w-[720px]`, so a phone gets a two-screen-wide sideways scroll; one wrapper also puts the min-width on the scroller itself rather than the grid, which breaks the scroll.

Fix: under `sm`, replace the month grid with a chronological agenda list (day heading, then event chips with time, title, applicant). The month grid stays for `sm` and up. One toolbar row that wraps.

### 3. Pipeline board (high)
Stage columns are fixed at 240px in a horizontal scroller with no affordance, so on a phone you see one and a half columns with no hint there are more.

Fix: add scroll-snap per column, widen columns to ~82vw so one stage reads cleanly, and add a stage selector chip row above the board so a stage can be jumped to directly. Cards get larger tap areas.

### 4. Tap targets and form controls below the minimum (high)
Many controls sit at `h-8` / 12.5–13px text: inline stage selects and row actions in the Applicants table, filter selects, Academy admin row buttons, Settings toggles, calendar arrows. Two problems: targets under 44px, and any input under 16px makes iOS zoom the page on focus.

Fix: in the shared kit, raise `Input`, `Select`, `Search`, and `sm` buttons to a 44px minimum height and 16px font below the `sm` breakpoint (visual size unchanged on desktop), and give every icon-only control a 44px box. Applies portal-wide from one place.

### 5. Viewport height and safe areas (medium)
Modal uses `calc(100vh - 2rem)` and the drawer/record sheet use `92vh`; on iOS Safari `vh` includes the collapsing toolbar, so footers with the primary action get pushed under the browser chrome. The sticky top bar and the off-canvas sidebar also ignore the notch and home-indicator insets.

Fix: switch these to `dvh`, and add `env(safe-area-inset-*)` padding to the top bar, sidebar drawer, bottom sheet footers, and any sticky action row.

### 6. Off-canvas sidebar behaviour (medium)
The mobile sidebar slides in with a backdrop, but body scroll isn't locked behind it, Escape doesn't close it, focus isn't moved into or trapped inside it, and it doesn't close automatically on route change in every case.

Fix: lock background scroll while open, close on Escape and on navigation, move focus to the panel and restore it on close, and label the toggle for screen readers.

### 7. Header actions disappear on phones (medium)
The top bar hides the invite action and the role badge below `sm`, so inviting an agent is unreachable on mobile.

Fix: keep invite reachable — icon-only button in the top bar at phone width, full label from `sm` up. Role badge moves into the sidebar user block where there's room.

### 8. Two-column forms too tight (medium)
`add-agent-modal` uses a hard `grid-cols-2` (first/last name), `date-time-picker` renders a 7-column month at fixed sizing, and several detail panels use `sm:grid-cols-2` correctly while others don't.

Fix: stack all form grids to one column below `sm`; make the date picker's day cells flexible with a 44px minimum and a scrollable time list; audit every panel grid to the same `grid gap-3 sm:grid-cols-2` pattern.

### 9. Long values overflow (medium)
Emails, applicant names, recruiting links, and course titles are truncated in some places and unconstrained in others — the recruiting-link field has a 160px minimum inside a flex row that can push past the viewport.

Fix: `min-w-0` + truncation on every flex/grid child that holds user data, and let the recruiting link wrap or shrink instead of forcing a minimum.

### 10. Screen-by-screen sweep (medium)
Dashboard (metric row, follow-up list, pipeline snapshot bars, activity feed), Onboarding checklist, Academy (index, speakers, presentations player + transcript, courses with its outline sidebar, library), Tasks, Leaderboard, Organization tree indentation, Settings section nav, and every Admin screen including the three-pane Emails console — each checked at the five widths for horizontal scroll, clipped content, wrapped-into-nonsense headers, and unreachable actions. Academy course outline and Admin Emails list collapse to a disclosure above the content on phones rather than a side column.

### 11. Accessibility carried along (low)
Icon-only buttons get `aria-label`s, filter selects get labels, the mobile agenda and card lists use semantic lists, and focus-visible rings survive the sizing changes.

## Technical notes

- Files touched: `src/components/portal/ui.tsx` and `src/styles.css` (shared sizing, `dvh`, safe-area tokens), `src/components/vantage/portal-shell.tsx`, `add-agent-modal.tsx`, `add-applicant-modal.tsx`, `date-time-picker.tsx`, `recruiting-link-card.tsx`, `applicant-record.tsx`, and the route files under `src/routes/_authenticated/portal/` — roughly 25 files.
- Changes are className/CSS and small presentational branches only. Queries, server functions, mutation handlers, filter state, and role gates are carried through untouched.
- Verification: `tsgo --noEmit`, then a scripted sweep of every portal route at 320/375/390/430/768 asserting no unintended horizontal scroll and no interactive element under 44px. Authenticated screens need a signed-in preview session to verify visually — if you sign in to the preview once, the check can cover the whole portal; otherwise verification is code-level plus the public routes.
