# Portal Visual Redesign — Compact Operational UI

A presentation-only refactor of the authenticated portal. No routes, queries, server functions, schema, permissions, or copy meaning change. Public marketing site (`/`, `/apply`, `/schedule`, `/evaluation`, login, emails) stays exactly as-is — the condensed display font and gold treatment remain there by design.

## Design tokens (src/styles.css)

New portal-scoped token layer (applied on the portal shell root, so marketing pages are untouched):

- Interface font: Inter loaded via `<link>` in `__root.tsx`; portal sets `--font-ui: Inter`. Bebas Neue stays available for the logo lockup only.
- Type scale: page title 24/600, section 16/600, card title 14/600, body 14, secondary 13, nav 14/500, label 12/500 uppercase (small labels only), table 13, metric 24–30/600.
- Surfaces: page `#0B0B0C`, sidebar `#080809`, panel `#141416`, raised `#1B1B1E`, border `rgba(255,255,255,0.08)`.
- Text: primary `#EDEDEF`, secondary `#A1A1A8`, muted `#71717A`.
- Semantic: gold accent (actions/selected/key numbers only), amber, green, red, blue.
- Radii 10/12, spacing scale 4/8/12/16/20/24/32, one flat shadow. Glow shadows and gradient card backgrounds removed from portal classes (`.apx-card`, `.apx-btn-*` get portal overrides; public variants preserved).

## Shared UI kit (new `src/components/portal/`)

`PageHeader`, `Toolbar`, `Panel`, `MetricCard`, `SegmentedControl`, `Tabs`, `Badge`/`StatusBadge`, `DataTable` (compact rows, header, hover, right-aligned actions), `EmptyState`, `SearchField`, `FilterSelect`, `Modal` (title, scrollable body, fixed footer, close, viewport-capped), `Avatar`, `NavItem`, `Button`, `Field`/`Input`/`Select`/`Textarea`. Built on existing shadcn primitives where they already exist.

## Shell

Rewrite `portal-shell.tsx` presentation only (same nav array, same role logic, same queries, same sign-out and theme behavior):

- Sidebar 240px, rows 38px, subtle gold-tinted active row (no thick outline), tight groups, user block + theme + sign out + collapse at bottom, icon rail at tablet, drawer at mobile.
- New 56px top bar: page context/greeting, role indicator, primary contextual action slot, avatar. Only controls the portal already supports — no fake search/notifications.
- Content area: 24px desktop / 16px mobile padding, full width, no giant outer container.

## Page migrations (all of them)

- **Dashboard** (`portal/index.tsx`): compact header, recruiting link as a utility panel (link + copy/open/share + applicant count), compact metric row, attention/recent/next-action ordering. Same data.
- **Applicants** (`applicants/index.tsx`, `$applicantId.tsx`): scope control (Mine/Direct/Downline/All) as one segmented control, separate List/Pipeline view control, single search+stage toolbar, compact table for list, tight pipeline columns; detail page as panels + compact tabs.
- **Calendar**: single toolbar (Mine, prev/next, Today), lighter grid borders, better date/event contrast, full-canvas grid.
- **Leaderboard**: filters in one toolbar, ranked compact table, polished low-data state.
- **Resources** (index, library, presentations, admin): title "Resources" + one-line summary, compact category rows/cards, search + filters on top, same player and admin actions.
- **Organization**: expandable tree/hierarchy rows with avatar, name, role, team, direct reports, status; real empty state for no downline.
- **Settings**: desktop settings nav column + content panel; tabs/selector on mobile. Sections preserved (Profile, Security, Notifications, Appearance, Recruiting). Add Agent becomes its own section rather than a nested modal-in-form.
- **Invitations**: compact table (invitee, role, status, sender, date, expiry, actions).
- **Admin** (index, users, stages, settings, audit), **Onboarding**, **Tasks**, **CRM/pipeline aliases**: same structure and spacing as above.
- Modals: `add-agent-modal`, `add-applicant-modal`, `date-time-picker`, resource player, combobox popovers → the shared `Modal`, viewport-safe with fixed footers, no overlap.

## Technical notes

- Every page edit is JSX/className-level. `useQuery`/`useServerFn` calls, query keys, mutation handlers, filter state, and role gates are copied through unchanged.
- Light theme (`.apx-theme-light`) tokens updated to match the new neutral system so the toggle keeps working.
- Verification: `tsgo --noEmit`, then Playwright passes at 1440px, 1024px and 390px on each portal route with an authenticated session, checking no clipping/overlap and that filters, tabs, forms and modals still operate.

Scope: ~30 files (styles, shell, new component kit, every portal route). Delivered as one pass across the whole portal, not screen-by-screen.
