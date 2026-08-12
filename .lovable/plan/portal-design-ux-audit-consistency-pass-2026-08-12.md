# Portal Design & UX Audit — Consistency Pass

Presentation-only pass across the whole authenticated portal. No features added or removed, no queries, server functions, schema, permissions, or copy meaning changed. The public site and emails are untouched. The dark black/charcoal/ivory identity with intentional gold accents stays exactly as-is.

## What the audit found

The shared kit in `src/components/portal/ui.tsx` already covers page headers, panels, metrics, buttons, toolbars, segmented controls, tabs, badges, tables, empty states, inputs, search, avatar, and modal — and most pages use it. The inconsistency is in the gaps around it:

1. **No shared loading primitive.** Nine pages hand-roll their own loading branch (`isLoading ? …`), including a one-off `animate-pulse` block on the Dashboard. Loading looks different on almost every screen.
2. **No shared error state.** Query failures render nothing at all; only mutations surface anything, and those pipe raw `e.message` straight into a toast.
3. **No drawer primitive.** Applicant records open as a 965-line full page instead of the compact CRM contact card the product wants.
4. **Ad-hoc surfaces.** Academy pages (index, admin, course, library) plus calendar, applicant pipeline, recruiting-link card, and player still use raw `rounded-[…]` / `bg-white/…` / `border-white/…` values instead of tokens, so radius, border, and hover differ from the rest of the portal.
5. **Bespoke form controls.** `add-agent-modal`, `add-applicant-modal`, `date-time-picker`, `recruiter-combobox`, `state-combobox`, and the settings toggles each style their own inputs/labels/footers.
6. **Table density drift.** Only `admin/users` sets a `min-w`, so other tables squash on narrow screens instead of scrolling; pipeline columns are fixed at 240px.
7. **Empty states are partial.** Present on ~10 pages, missing on the rest (calendar, settings sub-sections, onboarding, several admin tables).

## Work

### Extend the shared kit (`src/components/portal/ui.tsx`)

Add the missing primitives so nothing is hand-rolled: `Skeleton` (line/block/text), `TableSkeleton`, `CardSkeleton`, `MetricSkeleton`, `ErrorState` (message + retry), `Drawer` (right-side, mobile becomes bottom sheet, same header/footer contract as `Modal`), `Toggle`, `Checkbox`, `Radio`, `HelperText`/`FieldError`, `IconButton`, `SectionNav`, `notify` toast helper with fixed success/warning/error/info wording. Button gains `outline`, `ghost`, `destructive`, and a `loading` state; disabled styling is unified.

### Token cleanup (`src/styles.css`)

One radius pair (10/12), one border color, one panel/raised background, one hover, one flat shadow, one spacing scale (4/8/12/16/20/24/32), one type scale (page 24/600, section 16/600, card 14/600, body 14, secondary 13, table 13, label 12/500 caps, metric 24–30/600). Gold restricted to actions, active nav, selected states, and key numbers. Both dark and light theme blocks updated together.

### Navigation

Sidebar and top bar: consistent 38px rows, one icon size and stroke weight, clear grouping (Work / Growth / Admin), unmistakable active row, tightened user block with theme + sign out + collapse, icon rail at tablet, drawer at mobile with proper close and focus handling.

### Page-by-page migration

Every portal route and component moves onto the extended kit — Dashboard, Applicants (list + pipeline + record), Onboarding, Academy (index, courses, library, admin), Calendar, Tasks, Leaderboard, Organization, Settings, Invitations, and all Admin screens (index, users, user detail, stages, settings, audit). Each page gets: standard `PageHeader`, one toolbar row for search/filters, panels with identical padding, compact tables that scroll rather than squash, a designed empty state, a skeleton that matches its own layout, and an error state with retry.

Specific screens:
- **Dashboard** — onboarding progress first for unfinished agents, then metrics, attention items, pipeline snapshot, recent activity. Nothing added.
- **Applicants** — applicant record becomes the compact `Drawer` contact card (stage, contact, evaluation, email actions, activity, follow-up all reachable without scrolling past a wall); the standalone route stays working and renders the same content.
- **Onboarding** — single sequential checklist: where you are, what's done, what's next, how much is left.
- **Academy** — landing shows the three sections (Recorded Presentations, Courses, Library) rather than every resource at once; filter clutter reduced; clean progress bars.
- **Calendar** — consistent event chips, readable date contrast, lighter grid, one toolbar.
- **Leaderboard** — scannable ranked table, top performers and the logged-in row highlighted, no gamified styling.
- **Organization** — differentiated manager/agent rows, simple expandable hierarchy.
- **Settings / Admin** — section nav column on desktop, consistent toggles, no raw database wording in agent-facing copy.

### Responsive and interaction

Every route checked at 1440, 1280, 1024, 768, 430, 390, and 375px for horizontal scroll, clipping, tiny targets, broken tables, and modal/drawer overflow. Interaction sweep confirms hover, focus-visible, disabled, and loading states exist on every control and that tabs, filters, search, dropdowns, and drawers all still operate.

### Accessibility

Token-based contrast only, visible keyboard focus, `aria-label` on icon-only buttons, labels bound to every input, 44px minimum touch targets on primary mobile controls, one `<main>` per page.

## Technical notes

- All edits are JSX/className/CSS-level. `useQuery`/`useServerFn` calls, query keys, mutation handlers, filter state, and role gates are carried through unchanged.
- Roughly 35 files: `src/styles.css`, `src/components/portal/ui.tsx`, `src/components/vantage/*`, and every route under `src/routes/_authenticated/portal/`.
- Verification: `tsgo --noEmit`, then an authenticated Playwright pass over each portal route at the seven widths above, plus a role-based walkthrough (new agent, active agent, manager, admin, super admin) to catch anything left inconsistent.
