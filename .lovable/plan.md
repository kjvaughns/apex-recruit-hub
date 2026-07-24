## Problem

The Calendly iframe on `/application-complete/{licensed,unlicensed}/$token` shows a "redirected you too many times" error on our own `lovableproject.com` domain — not Calendly.

Root cause: `system_settings.value` rows for Calendly URLs are stored JSON-encoded (with literal wrapping `"` characters), e.g. `"https://calendly.com/kjvaughns1/overview?..."`. The RPC `resolve_scheduling_context` reads the raw text and passes it straight through, so `ctx.calendly_url` starts with `"`. The browser treats that malformed src as a relative path on the app's own host and re-serves the same page inside the iframe → infinite redirect.

Query confirming the issue:
```
key: calendly_url                        value: "https://calendly.com/kjvaughns1/overview?..."
key: unlicensed_overview_calendly_url    value: "https://calendly.com/kjvaughns1/overview?..."
```

## Fix

Single migration:

1. **Normalize stored values.** `UPDATE public.system_settings SET value = trim(both '"' from value) WHERE value LIKE '"%"';` — strips wrapping double-quotes from every setting that has them, without touching well-formed values.
2. **Harden the RPC.** In `public.resolve_scheduling_context`, wrap every `system_settings` lookup with `trim(both '"' from …)` so any future JSON-encoded write can't break the flow again.

No frontend changes needed — `CalendlyInline` already URL-parses the incoming string; once the leading `"` is gone, `new URL()` succeeds and the iframe loads Calendly.

## Verification

- Re-run `SELECT key, value FROM system_settings WHERE key LIKE '%calendly%';` → values start with `https://`, no quotes.
- Reload `/application-complete/unlicensed/<existing token>` → Calendly widget renders in the iframe, no redirect error.
- Same for the licensed page when a recruiter/manager link is configured.
