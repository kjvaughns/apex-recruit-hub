# Move sidebar controls to the portal header

## Goal
Relocate the sidebar collapse toggle and the light/dark mode switch out of the sidebar footer and into the top header bar, using clean icon-only buttons.

## Changes

### 1. Header controls
- Add two icon-only buttons to the right side of the existing top header (`src/components/vantage/portal-shell.tsx`).
  - Collapse/expand sidebar button: use a Lucide chevron/arrow icon that flips direction based on `collapsed` state.
  - Theme toggle button: use sun/moon Lucide icons (or the existing ☀/☾ glyphs) and keep the current `useTheme()` behavior.
- Keep the existing mobile hamburger on the left; only show the collapse button on `md:` and up.
- Add `aria-label` attributes for accessibility.

### 2. Sidebar footer cleanup
- Remove the theme toggle button from the sidebar footer.
- Remove the collapse button from the bottom of the sidebar.
- Keep the user profile block and the "Sign out" button in the sidebar footer.

### 3. Visual consistency
- Style the new header icon buttons with the existing `btnClass("ghost", "sm")` pattern so they match the header’s existing actions.
- Maintain current gold/neutral color tokens and hover states.

## Files changed
- `src/components/vantage/portal-shell.tsx`

## Out of scope
- No route, auth, data, or business logic changes.
- No changes to the theme implementation itself.
