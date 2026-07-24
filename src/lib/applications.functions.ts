import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function serverClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

const applicationSchema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(7).max(40),
  date_of_birth: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  state: z.string().trim().max(4).optional().or(z.literal("")),
  zip: z.string().trim().max(12).optional().or(z.literal("")),
  licensed: z.boolean().optional(),
  why_text: z.string().trim().max(2000).optional().or(z.literal("")),
  consent_contact: z.boolean(),
  ref_slug: z.string().trim().max(80).optional().or(z.literal("")),
});

export const submitApplication = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => applicationSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = serverClient();
    const { data: result, error } = await supabase.rpc("submit_application", {
      payload: data as never,
    });
    if (error) throw new Error(error.message);
    return result as { id: string; recruiter_id: string | null };
  });

const evaluationSchema = z.object({
  email: z.string().trim().email().max(200),
  answers: z.record(z.string(), z.string()).default({}),
});

export const submitEvaluation = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => evaluationSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = serverClient();
    const { data: result, error } = await supabase.rpc("submit_evaluation", {
      payload: data as never,
    });
    if (error) throw new Error(error.message);
    return result as { id: string; matched: boolean };
  });

const recruiterLookupSchema = z.object({
  slug: z.string().trim().min(1).max(80),
});

export const lookupRecruiter = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => recruiterLookupSchema.parse(data))
  .handler(async ({ data }) => {
    // Public read of a limited profile field would require an anon SELECT
    // policy; instead we query staff-side and return only the display name.
    // Since profiles is staff-only, we route through a service-role read
    // strictly for the display name — no PII.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name")
      .ilike("recruiting_slug", data.slug)
      .eq("is_active", true)
      .maybeSingle();
    if (!row) return { name: null };
    const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
    return { name: name || null };
  });

export const getCalendlyUrl = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = serverClient();
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "calendly_url")
    .maybeSingle();
  return { url: data?.value ?? "https://calendly.com/kjvaughns1/overview?hide_event_type_details=1&hide_gdpr_banner=1&primary_color=e6b400" };
});

export const markScheduled = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ email: z.string().email() }).parse(data))
  .handler(async ({ data }) => {
    const supabase = serverClient();
    const { data: result, error } = await supabase.rpc("mark_applicant_scheduled", {
      _email: data.email,
    });
    if (error) throw new Error(error.message);
    return result as { matched: boolean; id?: string };
  });
