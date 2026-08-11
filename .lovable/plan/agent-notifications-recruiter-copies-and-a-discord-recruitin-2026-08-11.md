# Agent notifications, recruiter copies, and a Discord recruiting bot

Three connected additions, all triggered by the existing application flow — no changes to the application form, pipeline, or applicant-facing pages.

## 1. New-applicant email to the agent

When an application comes in, the recruiter who owns it gets their own branded email:

- Applicant first and last name, email, phone, state
- Licensed or unlicensed
- Instagram handle and why-they-applied text
- The Monday overview date and time they selected (in CT), or "Requested a 1:1 call" when they chose "none of these work"
- Who referred them (recruiter name shown on the form)
- A button straight to that applicant's record in the portal

If the applicant has no assigned recruiter yet, the email goes to the fallback support/admin address so nothing is silently dropped.

## 2. Recruiter copies on every applicant email

Each applicant-facing email (application received — licensed and unlicensed, welcome/hired, follow-up check-in, welcome to onboarding, onboarding complete) also sends a copy to the applicant's recruiter, clearly labelled as a copy: a short "Sent to {applicant name}" banner above the exact same content, so the agent always knows what their recruit just received.

Note on wording: the email platform sends to one recipient per message, so there is no literal CC header. The copy is delivered as its own message to the agent — same content, same timing. That also keeps the applicant's address private and keeps agent copies out of the applicant's suppression/unsubscribe state.

Copies are best-effort: a failed agent copy never blocks or delays the applicant's email.

## 3. Discord recruiting bot webhook (admin settings)

A new "Discord recruiting bot" section in System settings (admin only) with:

- A field to paste a Discord channel webhook URL
- A "Send test message" button so you can confirm the channel works before real applicants come through

Every new application then posts a rich Discord embed to that channel:

```text
New recruit — Jordan Miller
Recruited by   Kevin Vaughns
License        Unlicensed
Scheduled      Monday, August 17 at 7:00 PM CT
```

When the applicant asked for a 1:1 instead, the Scheduled line reads "Requested a 1:1 call". If no webhook URL is saved, nothing is posted and nothing errors.

## Technical notes

- **Migration**: a `SECURITY DEFINER` RPC (`get_applicant_notify_context`) returns the applicant's details plus the assigned recruiter's name and email for a given applicant id, so the public submission path can resolve the notification target without exposing `profiles` to anon. Also grants nothing new to anon beyond this function.
- **New templates** in `src/lib/email-templates/`: `agent-new-applicant` (the agent alert) plus a shared "copy for the recruiter" wrapper used to re-render existing templates with a header banner. Registered in `registry.ts`.
- **`src/lib/emails/send.ts`**: `queueEmail` gains an optional `copyTo` (agent email + name). Copies are logged to `email_outbox` with the same `template_key` so the outbox stays a complete record.
- **`src/lib/applications.functions.ts`**: after `submit_application` succeeds, resolve the notify context, send the agent alert, and fire the Discord post. Both wrapped so submission never fails on a notification error.
- **`src/lib/portal.functions.ts`**: the four portal-triggered sends (welcome/hired, follow-up, welcome onboarding, onboarding complete) pass `copyTo` resolved from the applicant's assigned recruiter.
- **New `src/lib/discord.server.ts`**: builds and posts the embed; reads the webhook URL from `system_settings` (`discord_recruiting_webhook_url`). Server-only, never reachable from the browser.
- **`src/routes/_authenticated/portal/admin/settings.tsx`**: new panel for the webhook URL and test-send, using the existing `adminGetSettings` / `adminSetSetting` functions plus one new admin-only `sendDiscordTest` server function.
