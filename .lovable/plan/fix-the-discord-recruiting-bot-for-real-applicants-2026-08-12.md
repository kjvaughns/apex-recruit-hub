# Fix the Discord recruiting bot for real applicants

## What's happening

The webhook URL is saved correctly, and the "Send test card" button in admin settings works — because that runs as you, a signed-in admin.

A real application is submitted by an anonymous visitor. On that path the app tries to look up the saved webhook URL using the public (not-signed-in) database connection, and the settings table is locked down to signed-in staff/admins only. The lookup comes back empty, the code treats "no webhook configured" as "bot is off", and silently skips the Discord post. Applicant emails still go out, which is why only Discord looks broken.

Verified: `system_settings` has row-level security with policies only for authenticated staff/admins, and `discord_recruiting_webhook_url` is present with a valid Discord URL.

## The fix

On the public application-submission path, read the webhook URL with the trusted server-side connection instead of the public one, so the bot fires for every new applicant regardless of who submitted the form.

Also add a visible failure trail: when the post can't be made, log why (no URL configured vs. Discord rejected it) instead of failing silently.

## Technical notes

- `src/lib/discord.server.ts`: add an admin-client path — `notifyNewRecruit` resolves the URL via `await import('@/integrations/supabase/client.server')` (`supabaseAdmin`) rather than the caller's anon client; keep the existing signature working for the admin test call. Keep all reads server-only.
- `src/lib/applications.functions.ts`: keep the call inside the handler and keep it best-effort (a Discord failure must never fail a submission), but log a warning when the webhook is unset or the post is rejected.
- No migration, no schema change, no change to the settings UI or the application form.

## Verification

After the change, submit a test application through `/apply` and confirm the card lands in the Discord channel; check server logs for the new warning lines if it doesn't.
