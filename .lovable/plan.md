## Problem

Navigating to `/application-complete/unlicensed/<token>` (or `/licensed/<token>`) always shows the generic "Application Received" screen instead of the token-specific licensed/unlicensed pages.

Root cause: `src/routes/application-complete.tsx` and the folder `src/routes/application-complete/` both exist. In TanStack file-based routing, that file becomes the **parent layout** for the folder's children. It renders its own UI (the generic success card) and never renders `<Outlet />`, so the child routes match but are masked. The licensed/unlicensed files are already correctly declared — they just can't render.

## Fix

1. Convert `src/routes/application-complete.tsx` into a pathless pass-through layout: `component: () => <Outlet />`, keep the `head()` as-is for the parent path.
2. Create `src/routes/application-complete/index.tsx` containing the current generic "Application Received" UI so bare `/application-complete` still works as a fallback (used by the "not found" redirects inside the licensed/unlicensed pages).
3. No changes needed to `apply.tsx`, the child routes, or the DB — redirect logic already returns the right `success_page_type` and token.

## Verification

- Submit `/apply` with "Yes, I'm licensed" → lands on `/application-complete/licensed/<token>` and sees the recruiter/manager Calendly (or fallback message).
- Submit with "No" → lands on `/application-complete/unlicensed/<token>` and sees the global overview Calendly.
- Direct visit to `/application-complete` → still shows the generic success card.
