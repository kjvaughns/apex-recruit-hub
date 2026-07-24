import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

async function match(email: string | undefined, tracking: Record<string, unknown> | undefined) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const token = typeof tracking?.utm_content === "string" ? tracking.utm_content : undefined;
  if (token) {
    const { data } = await supabaseAdmin
      .from("applicants")
      .select("id")
      .eq("confirmation_token", token)
      .maybeSingle();
    if (data) return data.id as string;
  }
  if (email) {
    const { data } = await supabaseAdmin
      .from("applicants")
      .select("id")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data.id as string;
  }
  return null;
}

export const Route = createFileRoute("/api/public/webhooks/calendly")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CALENDLY_WEBHOOK_SECRET;
        if (!secret) return new Response("Webhook not configured", { status: 503 });

        const sigHeader = request.headers.get("Calendly-Webhook-Signature") ?? "";
        const raw = await request.text();
        // Calendly signature format: t=<ts>,v1=<hmac>
        const parts = Object.fromEntries(sigHeader.split(",").map((p) => p.split("=") as [string, string]));
        const t = parts["t"];
        const v1 = parts["v1"];
        if (!t || !v1) return new Response("Bad signature", { status: 401 });
        const expected = createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
        const a = Buffer.from(v1);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }

        type Payload = {
          event?: string;
          payload?: {
            email?: string;
            uri?: string;
            event?: string;
            scheduled_event?: { uri?: string; start_time?: string; end_time?: string };
            tracking?: Record<string, unknown>;
          };
        };
        const body = JSON.parse(raw) as Payload;
        const event = body.event ?? "";
        const p = body.payload ?? {};
        const eventId = p.scheduled_event?.uri ?? p.event ?? null;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const applicantId = await match(p.email, p.tracking);
        if (!applicantId) return new Response("ok", { status: 200 });

        if (event === "invitee.created") {
          // idempotency by scheduled_event_id
          if (eventId) {
            const { data: existing } = await supabaseAdmin
              .from("applicants")
              .select("id")
              .eq("scheduled_event_id", eventId)
              .maybeSingle();
            if (existing) return new Response("ok", { status: 200 });
          }
          const { data: stage } = await supabaseAdmin
            .from("pipeline_stages")
            .select("id")
            .eq("slug", "interview-scheduled")
            .maybeSingle();
          await supabaseAdmin
            .from("applicants")
            .update({
              scheduling_status: "scheduled",
              scheduled_event_id: eventId,
              scheduled_invitee_id: p.uri ?? null,
              scheduled_event_url: p.scheduled_event?.uri ?? null,
              scheduled_event_start: p.scheduled_event?.start_time ?? null,
              scheduled_event_end: p.scheduled_event?.end_time ?? null,
              calendly_scheduled_at: p.scheduled_event?.start_time ?? new Date().toISOString(),
              current_stage_id: stage?.id ?? undefined,
              stage_entered_at: stage?.id ? new Date().toISOString() : undefined,
            })
            .eq("id", applicantId);
          await supabaseAdmin.from("applicant_activities").insert({
            applicant_id: applicantId,
            event_type: "appointment_scheduled",
            summary: "Calendly appointment scheduled",
            data: { event_id: eventId },
          });
        } else if (event === "invitee.canceled") {
          await supabaseAdmin
            .from("applicants")
            .update({ scheduling_status: "canceled" })
            .eq("id", applicantId);
          await supabaseAdmin.from("applicant_activities").insert({
            applicant_id: applicantId,
            event_type: "appointment_canceled",
            summary: "Calendly appointment canceled",
            data: { event_id: eventId },
          });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
