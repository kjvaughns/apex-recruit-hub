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
  state: z.string().trim().length(2),
  licensed: z.boolean(),
  instagram_handle: z.string().trim().max(80).optional().or(z.literal("")),
  why_text: z.string().trim().min(10).max(2000),
  consent_contact: z.literal(true),
  // Attribution — a valid recruiter must be selected.
  referred_by_profile_id: z.string().uuid(),
  original_referral_profile_id: z.string().uuid().optional().or(z.literal("")),
  referral_slug: z.string().trim().max(120).optional().or(z.literal("")),
  referral_source: z.enum(["referral_link", "manual", "direct"]).optional(),
  referral_landing_url: z.string().trim().max(600).optional().or(z.literal("")),
  invalid_referral_slug: z.string().trim().max(120).optional().or(z.literal("")),
});

export const submitApplication = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => applicationSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = serverClient();
    const { data: result, error } = await supabase.rpc("submit_application", {
      payload: data as never,
    });
    if (error) throw new Error(error.message);
    return result as { id: string; token: string; success_page_type: "licensed" | "unlicensed"; recruiter_id: string | null };
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

export type RecruiterOption = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  recruiting_slug: string | null;
  team_name: string | null;
};

// Safe, debounced recruiter directory search for the public application form.
// Backed by the SECURITY DEFINER search_recruiters RPC (active + recruiting
// agents only, no PII). Never exposes the profiles table to the public.
export const searchRecruiters = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ q: z.string().trim().max(80).optional().or(z.literal("")) }).parse(data),
  )
  .handler(async ({ data }) => {
    const supabase = serverClient();
    const { data: rows, error } = await supabase.rpc("search_recruiters", { _q: data.q ?? "" });
    if (error) throw new Error(error.message);
    return (rows ?? []) as RecruiterOption[];
  });

// Resolve a single active recruiter from a referral slug (for link preselect).
export const getRecruiterBySlug = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ slug: z.string().trim().min(1).max(120) }).parse(data),
  )
  .handler(async ({ data }) => {
    const supabase = serverClient();
    const { data: rows, error } = await supabase.rpc("get_recruiter_by_slug", { _slug: data.slug });
    if (error) throw new Error(error.message);
    const row = (rows ?? [])[0];
    return (row ?? null) as RecruiterOption | null;
  });

type SchedulingContext = {
  found: boolean;
  first_name?: string;
  success_page_type?: "licensed" | "unlicensed";
  calendly_url?: string | null;
  contact_name?: string | null;
  contact_kind?: string | null;
  link_missing?: boolean;
  scheduling_status?: string;
};

export const getSchedulingContext = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ token: z.string().min(10).max(128) }).parse(data))
  .handler(async ({ data }) => {
    const supabase = serverClient();
    const { data: result, error } = await supabase.rpc("resolve_scheduling_context", {
      _token: data.token,
    });
    if (error) throw new Error(error.message);
    return (result ?? { found: false }) as SchedulingContext;
  });

export const markLicensedFallback = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ token: z.string().min(10).max(128) }).parse(data))
  .handler(async ({ data }) => {
    const supabase = serverClient();
    const { data: result, error } = await supabase.rpc("mark_licensed_fallback", { _token: data.token });
    if (error) throw new Error(error.message);
    return result as { ok: boolean; already?: boolean };
  });

export const markScheduled = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ token: z.string().min(10).max(128) }).parse(data))
  .handler(async ({ data }) => {
    const supabase = serverClient();
    const { data: result, error } = await supabase.rpc("mark_scheduled_by_token", { _token: data.token });
    if (error) throw new Error(error.message);
    return result as { matched: boolean; id?: string };
  });

