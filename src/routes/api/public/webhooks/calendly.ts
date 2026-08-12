import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Calendly webhook. Handles booking, rescheduling, and cancellation of the
 * Company Overview / interview, and routes every stage change through the
 * central recruiting stage engine.
 */

type Payload = {
  event?: string;
  payload?: {
    email?: string;
    text_reminder_number?: string;
    uri?: string;
    event?: string;
    old_event?: string;
    rescheduled?: boolean;
    scheduled_event?: { uri?: string; start_time?: string; end_time?: string };
    tracking?: Record<string, unknown>;
    questions_and_answers?: Array<{ question?: string; answer?: string }>;
  };
};

export const Route = createFileRoute("/api/public/webhooks/calendly")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CALENDLY_WEBHOOK_SECRET;
        if (!secret) return new Response("Webhook not configured", { status: 503 });

        const sigHeader = request.headers.get("Calendly-Webhook-Signature") ?? "";
        const raw = await request.text();
        const parts = Object.fromEntries(
          sigHeader.split(",").map((p) => p.split("=") as [string, string]),
        );
        const t = parts["t"];
        const v1 = parts["v1"];
        if (!t || !v1) return new Response("Bad signature", { status: 401 });
        const expected = createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
        const a = Buffer.from(v1);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const body = JSON.parse(raw) as Payload;
        const event = body.event ?? "";
        const p = body.payload ?? {};
        const eventId = p.scheduled_event?.uri ?? p.event ?? null;
        const startTime = p.scheduled_event?.start_time ?? null;

        const engine = await import("@/lib/recruiting/stage-engine.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Match by tracking token, then email, then phone.
        let applicant = null as Awaited<ReturnType<typeof engine.loadApplicant>>;
        const token =
          typeof p.tracking?.utm_content === "string" ? p.tracking.utm_content : undefined;
        if (token) {
          const { data } = await supabaseAdmin
            .from("applicants")
            .select("id")
            .eq("confirmation_token", token)
            .maybeSingle();
          if (data) applicant = await engine.loadApplicant(data.id);
        }
        if (!applicant) {
          applicant = await engine.findApplicant(p.email, p.text_reminder_number);
        }
        if (!applicant) return new Response("ok", { status: 200 });

        if (event === "invitee.created") {
          // Idempotent on event id + start time — a replay is a no-op.
          if (
            eventId &&
            applicant.scheduled_event_url === eventId &&
            applicant.scheduled_event_start === startTime
          ) {
            return new Response("ok", { status: 200 });
          }

          const isReschedule =
            !!applicant.scheduled_event_start && applicant.scheduled_event_start !== startTime;
          const previousStart = applicant.scheduled_event_start;

          if (isReschedule) {
            await engine.logActivity(
              applicant.id,
              "appointment_rescheduled",
              "Company Overview Rescheduled",
              { previous_start: previousStart, new_start: startTime, event_id: eventId },
            );
          }

          const result = await engine.applyStage({
            applicantId: applicant.id,
            stage: "interview-scheduled",
            reason: isReschedule ? "calendly_rescheduled" : "calendly_booked",
            skipEmail: true,
            patch: {
              scheduling_status: "scheduled",
              scheduled_event_id: eventId,
              scheduled_invitee_id: p.uri ?? null,
              scheduled_event_url: p.scheduled_event?.uri ?? null,
              scheduled_event_start: startTime,
              scheduled_event_end: p.scheduled_event?.end_time ?? null,
              calendly_scheduled_at: startTime ?? new Date().toISOString(),
              requested_overview_at: startTime,
            },
          });

          if (!isReschedule) {
            await engine.logActivity(
              applicant.id,
              "appointment_scheduled",
              "Company Overview Scheduled",
              { event_id: eventId, start_time: startTime },
            );
          }

          const fresh = await engine.loadApplicant(applicant.id);
          if (fresh) {
            // Restart reminders around the (possibly new) appointment time.
            if (startTime) {
              await engine.startSequence(applicant.id, "interview_reminders", startTime);
            }
            await engine.stopSequence(applicant.id, "no_show_followup", "rescheduled");
            await engine.sendApplicantEmail(
              fresh,
              isReschedule ? "reschedule-confirmation" : "interview-confirmation",
              { sendKey: `cal:${eventId ?? "none"}:${startTime ?? "none"}` },
            );
          }
          void result;
        } else if (event === "invitee.canceled") {
          await supabaseAdmin
            .from("applicants")
            .update({ scheduling_status: "canceled" })
            .eq("id", applicant.id);
          await engine.stopSequence(applicant.id, "interview_reminders", "canceled");
          await engine.logActivity(
            applicant.id,
            "appointment_canceled",
            "Company Overview Canceled",
            { event_id: eventId },
          );
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
