## Problem

`CalendlyInline` mounts the `calendly-inline-widget` div and injects `assets.calendly.com/external/widget.js`. Two issues:

1. **Not rendering on client-side navigation.** When applicants land on `/application-complete/{licensed,unlicensed}/$token` via `useNavigate`, the widget script has often already loaded on a previous page. Our fallback path calls `window.Calendly.initInlineWidgets()`, but that helper only scans widgets present at initial script load — on a new SPA route it silently does nothing, so the embed area stays blank.
2. **Too tall.** Fixed `height = 720` overflows the viewport on laptops and small windows, and the wrapping `.apx-card` adds extra padding that makes it look oversized.

## Fix

Replace the script-based `calendly-inline-widget` approach with a direct `<iframe>` — it's the pattern Calendly documents for SPA/embedded use and it works identically on first paint and after client navigation, with no global script needed.

`src/components/apex/calendly-inline.tsx`:
- Render `<iframe src={calendlyUrl}>` where `calendlyUrl` appends `embed_domain=<window.location.host>&embed_type=Inline` plus the existing branding params already on the URL (`hide_event_type_details=1&hide_gdpr_banner=1&primary_color=e6b400`).
- Default `height` down to `630`, and make it responsive: `min(80vh, height)` so it never overflows the viewport.
- Drop the `.apx-card` padding wrapper; keep a thin gold border only, so the frame doesn't visually inflate the widget.
- Keep the same `{ url, height? }` prop signature so all three call sites (`unlicensed.$token.tsx`, `licensed.$token.tsx`, `portal/settings.tsx` preview) work unchanged.

## Verification

- Submit `/apply` as unlicensed → land on `/application-complete/unlicensed/<token>` → Calendly loads immediately, fits within the viewport.
- Same for licensed flow.
- Portal `Settings → Preview` still shows the agent's own Calendly.
- Refresh each page → still renders (no dependency on script load ordering).
