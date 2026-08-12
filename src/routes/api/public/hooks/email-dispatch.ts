import { createFileRoute } from "@tanstack/react-router";

import { emailLinks, SITE_URL } from "@/lib/email/links";
import { formatDate, formatTime } from "@/lib/email/vars";
import {
  ONBOARDING_STEP_LABELS,
  ONBOARDING_STEP_ORDER,
  onboardingProgress,
  type OnboardingStepKey,
} from "@/lib/onboarding";

/**
 * Scheduled email dispatcher. Called by pg_cron:
 *   - `{"job":"reminders"}` hourly — interview/overview reminders, follow-up
 *     nudges, onboarding nudges.
 *   - `{"job":"campaigns"}` daily at 7:00 AM CT — recurring agent campaigns.
 *
 * Public route: authenticated with the project's publishable key in `apikey`.
 * Every send is deduped server-side, so a repeated run is harmless.
 */

type Json = Record<string, unknown>;

function ok(body: Json) {
  return Response.json({ ok: true, ...body });
}

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function send(args: Parameters<
  Awaited<typeof import("@/lib/email/dispatch.server")>["sendEmail"]
>[0]) {
  const { sendEmail } = await import("@/lib/email/dispatch.server");
  return sendEmail(args);
}

/** Local CT day key, used to keep dedupe keys stable per calendar day. */
function dayKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function ctWeekday(date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
  }).format(date);
}

/* ------------------------------------------------------------------ */
/* Reminders                                                           */
/* ------------------------------------------------------------------ */

async function runReminders() {
  const supabase = await db();
  const now = Date.now();
  const from = new Date(now + 23 * 3600_000).toISOString();
  const to = new Date(now + 25 * 3600_000).toISOString();
  const counts = { interview: 0, overview: 0, followUp: 0, onboarding: 0 };

  // 24h interview + overview reminders.
  const { data: upcoming } = await supabase
    .from("applicants")
    .select(
      "id, first_name, last_name, email, licensed, calendly_scheduled_at, requested_overview_at, assigned_recruiter_id",
    )
    .or(
      `and(calendly_scheduled_at.gte.${from},calendly_scheduled_at.lte.${to}),and(requested_overview_at.gte.${from},requested_overview_at.lte.${to})`,
    );

  for (const a of upcoming ?? []) {
    if (!a.email) continue;
    const isInterview = !!a.calendly_scheduled_at;
    const when = isInterview ? a.calendly_scheduled_at : a.requested_overview_at;
    const date = formatDate(when) ?? undefined;
    const time = formatTime(when) ?? undefined;
    const template = isInterview ? "interview-reminder" : "overview-reminder";
    const result = await send({
      template,
      to: a.email,
      toName: `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || null,
      applicantId: a.id,
      sendKey: `${a.id}-${when}`,
      context: {
        ...emailLinks(),
        first_name: a.first_name ?? undefined,
        interview_date: date,
        interview_time: time,
        overview_date: date,
        overview_time: time,
      },
    });
    if (result.status === "sent") {
      if (isInterview) counts.interview += 1;
      else counts.overview += 1;
    }
  }

  // Applicant follow-ups due — nudge the recruiting agent.
  const { data: due } = await supabase
    .from("applicants")
    .select("id, first_name, last_name, assigned_recruiter_id, next_follow_up_at")
    .lte("next_follow_up_at", new Date().toISOString())
    .not("assigned_recruiter_id", "is", null)
    .is("archived_at", null)
    .limit(200);

  const recruiterIds = [...new Set((due ?? []).map((d: any) => d.assigned_recruiter_id))];
  const { data: recruiters } = recruiterIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, email, is_active")
        .in("id", recruiterIds)
    : { data: [] };
  const byId = new Map<string, any>((recruiters ?? []).map((r: any) => [r.id, r]));

  for (const a of due ?? []) {
    const r = byId.get(a.assigned_recruiter_id);
    if (!r?.email || r.is_active === false) continue;
    const applicantName = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim();
    const result = await send({
      template: "applicant-followup-reminder",
      to: r.email,
      toName: r.full_name,
      profileId: r.id,
      applicantId: a.id,
      sendKey: `${a.id}-${dayKey()}`,
      context: {
        ...emailLinks({ portal_link: `${SITE_URL}/portal/crm/${a.id}` }),
        first_name: (r.full_name ?? "").split(/\s+/)[0] || undefined,
        applicant_name: applicantName || undefined,
      },
    });
    if (result.status === "sent") counts.followUp += 1;
  }

  // Onboarding stalled for 24h+.
  const cutoff = new Date(now - 24 * 3600_000).toISOString();
  const { data: onboarding } = await supabase
    .from("applicants")
    .select("id, first_name, onboarding_steps, onboarding_completed_at, portal_profile_id, updated_at")
    .is("onboarding_completed_at", null)
    .not("portal_profile_id", "is", null)
    .lte("updated_at", cutoff)
    .limit(200);

  for (const a of onboarding ?? []) {
    const progress = onboardingProgress(a.onboarding_steps ?? {});
    const steps = (a.onboarding_steps ?? {}) as Record<string, { completed?: boolean }>;
    const nextKey = ONBOARDING_STEP_ORDER.find((k: OnboardingStepKey) => !steps[k]?.completed);
    if (!nextKey) continue;
    const { data: p } = await supabase
      .from("profiles")
      .select("id, full_name, email, is_active")
      .eq("id", a.portal_profile_id)
      .maybeSingle();
    if (!p?.email || p.is_active === false) continue;
    const result = await send({
      template: "onboarding-reminder",
      to: p.email,
      toName: p.full_name,
      profileId: p.id,
      applicantId: a.id,
      sendKey: `${a.id}-${dayKey()}`,
      context: {
        ...emailLinks(),
        first_name: (a.first_name ?? p.full_name ?? "").split(/\s+/)[0] || undefined,
        progress: `${progress.done} of ${progress.total} steps complete`,
        next_step: ONBOARDING_STEP_LABELS[nextKey],
      },
    });
    if (result.status === "sent") counts.onboarding += 1;
  }

  return counts;
}

/* ------------------------------------------------------------------ */
/* Campaigns                                                           */
/* ------------------------------------------------------------------ */

const CAMPAIGN_TEMPLATES: Record<string, string> = {
  "daily-production-focus": "campaign-daily-focus",
  "weekly-game-plan": "campaign-weekly-game-plan",
  "weekly-sales-tip": "campaign-weekly-sales-tip",
  "academy-new-content": "campaign-academy-content",
  "leadership-development": "campaign-leadership",
};

const WEEKLY_DAY: Record<string, string> = {
  "weekly-game-plan": "Monday",
  "weekly-sales-tip": "Friday",
  "leadership-development": "Monday",
};

function campaignContext(slug: string, content: Json) {
  const c = content as Record<string, string | undefined>;
  return {
    target: c["target"],
    dial_hours: c["dialHours"],
    mindset: c["mindset"],
    focus: c["focus"],
    meeting_time: c["meetingTime"],
    training_time: c["trainingTime"],
    film_review: c["filmReview"],
    dial_expectation: c["dialExpectation"],
    tip_title: c["title"],
    tip_body: c["body"],
    message: c["message"],
    subject_line: c["subject"] ?? undefined,
  };
}

async function runCampaigns() {
  const supabase = await db();
  const today = dayKey();
  const weekday = ctWeekday();
  const sent: Record<string, number> = {};

  const { data: campaigns } = await supabase
    .from("email_campaigns")
    .select("*")
    .eq("enabled", true);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active")
    .eq("is_active", true);

  const { data: subs } = await supabase
    .from("email_campaign_subscriptions")
    .select("user_id, campaign_slug, subscribed");
  const unsubscribed = new Set(
    (subs ?? [])
      .filter((s: any) => s.subscribed === false)
      .map((s: any) => `${s.user_id}:${s.campaign_slug}`),
  );

  const { data: roles } = await supabase.from("user_roles").select("user_id, role");
  const leadership = new Set(
    (roles ?? [])
      .filter((r: any) => ["leader", "manager", "admin", "super_admin"].includes(r.role))
      .map((r: any) => r.user_id),
  );

  for (const c of campaigns ?? []) {
    const template = CAMPAIGN_TEMPLATES[c.slug];
    if (!template) continue;
    if (c.cadence === "manual") continue;
    if (c.cadence === "weekly" && WEEKLY_DAY[c.slug] && WEEKLY_DAY[c.slug] !== weekday) continue;

    let recipients = (profiles ?? []).filter((p: any) => !!p.email);
    if (c.audience === "leadership") recipients = recipients.filter((p: any) => leadership.has(p.id));
    recipients = recipients.filter((p: any) => !unsubscribed.has(`${p.id}:${c.slug}`));

    let count = 0;
    for (const p of recipients) {
      const result = await send({
        template,
        to: p.email,
        toName: p.full_name,
        profileId: p.id,
        campaignSlug: c.slug,
        sendKey: `${c.slug}-${p.id}-${today}`,
        context: {
          ...emailLinks(),
          first_name: (p.full_name ?? "").split(/\s+/)[0] || undefined,
          ...campaignContext(c.slug, (c.content ?? {}) as Json),
        },
      });
      if (result.status === "sent") count += 1;
    }
    sent[c.slug] = count;

    await supabase
      .from("email_campaigns")
      .update({ last_sent_at: new Date().toISOString() })
      .eq("slug", c.slug);
  }

  return sent;
}

export const Route = createFileRoute("/api/public/hooks/email-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let job = "reminders";
        try {
          const body = (await request.json()) as { job?: string };
          if (body?.job) job = body.job;
        } catch {
          /* empty body — default job */
        }

        const key = request.headers.get("apikey");
        const expected =
          process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
        if (!key || (expected && key !== expected)) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        try {
          if (job === "campaigns") return ok({ job, sent: await runCampaigns() });
          return ok({ job: "reminders", sent: await runReminders() });
        } catch (e) {
          console.error("[email-dispatch] failed", e);
          return Response.json(
            { error: e instanceof Error ? e.message : String(e) },
            { status: 500 },
          );
        }
      },
    },
  },
});
