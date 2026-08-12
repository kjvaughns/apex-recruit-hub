import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Open "agent invite link" flow: a recruiter shares /join/<their slug> and the
 * new agent self-registers. This creates the applicant record at Onboarding,
 * mints a single-use invitation, then finalizes it into a real portal account
 * so the agent lands on their onboarding checklist immediately.
 */

export type AgentJoinContext = {
  found: boolean;
  recruiter_id?: string;
  recruiter_name?: string | null;
  team_name?: string | null;
};

const slugSchema = z.object({ slug: z.string().trim().min(2).max(80) });

export const getAgentJoinContext = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => slugSchema.parse(d))
  .handler(async ({ data }): Promise<AgentJoinContext> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, full_name, is_active, teams(name)")
      .eq("recruiting_slug", data.slug.toLowerCase())
      .maybeSingle();
    if (!prof || !prof.is_active) return { found: false };
    const p = prof as unknown as {
      id: string;
      first_name: string | null;
      last_name: string | null;
      full_name: string | null;
      teams: { name: string } | null;
    };
    return {
      found: true,
      recruiter_id: p.id,
      recruiter_name:
        [p.first_name, p.last_name].filter(Boolean).join(" ") || p.full_name || null,
      team_name: p.teams?.name ?? null,
    };
  });

const registerSchema = z.object({
  slug: z.string().trim().min(2).max(80),
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(7).max(40),
  state: z.string().trim().min(2).max(4),
  npn: z.string().trim().min(2).max(40),
  instagram_handle: z.string().trim().max(80).optional().or(z.literal("")),
  password: z.string().min(8).max(200),
  timezone: z.string().trim().max(64).optional().or(z.literal("")),
  accept_terms: z.literal(true),
});

export const registerAgentViaLink = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => registerSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const email = data.email.toLowerCase();

    // 1. Resolve the recruiter behind the link.
    const { data: recruiter } = await admin
      .from("profiles")
      .select("id, team_id, is_active")
      .eq("recruiting_slug", data.slug.toLowerCase())
      .maybeSingle();
    if (!recruiter || !recruiter.is_active) throw new Error("This invite link is no longer active.");

    // 2. Refuse duplicates — existing agents should just sign in.
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (existing) throw new Error("An account already exists for that email. Please sign in.");

    // 3. Applicant record straight at Onboarding (trigger seeds the checklist).
    const { data: stage } = await admin
      .from("pipeline_stages")
      .select("id")
      .eq("slug", "onboarding")
      .maybeSingle();
    if (!stage?.id) throw new Error("Onboarding stage is not configured.");

    // If they already applied, match that record instead of creating a second
    // one — their history, recruiter and referral attribution are preserved.
    const { data: applicant, error: appErr } = await admin
      .from("applicants")
      .select(
        "id, first_name, last_name, phone, state, resident_state, assigned_recruiter_id, original_recruiter_id, referred_by_profile_id",
      )
      .ilike("email", email)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (appErr) throw new Error(appErr.message);
    let applicantId: string | null = applicant?.id ?? null;
    const matchedExisting = !!applicantId;

    if (!applicantId) {
      const { data: created, error } = await admin
        .from("applicants")
        .insert({
          first_name: data.first_name,
          last_name: data.last_name,
          email,
          phone: data.phone,
          state: data.state,
          resident_state: data.state,
          npn: data.npn,
          licensed: true,
          licensing_status: "licensed",
          consent_contact: true,
          assigned_recruiter_id: recruiter.id,
          original_recruiter_id: recruiter.id,
          referred_by_profile_id: recruiter.id,
          referral_source: "agent_invite_link",
          current_stage_id: stage.id,
          stage_entered_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      applicantId = created.id as string;
    } else {
      await admin
        .from("applicants")
        .update({
          current_stage_id: stage.id,
          stage_entered_at: new Date().toISOString(),
          licensed: true,
          licensing_status: "licensed",
          npn: data.npn,
          // Fill in anything the original application was missing; never
          // overwrite the recruiter/referral attribution already on file.
          first_name: applicant.first_name || data.first_name,
          last_name: applicant.last_name || data.last_name,
          phone: applicant.phone || data.phone,
          state: applicant.state || data.state,
          resident_state: applicant.resident_state || data.state,
          assigned_recruiter_id: applicant.assigned_recruiter_id ?? recruiter.id,
          original_recruiter_id: applicant.original_recruiter_id ?? recruiter.id,
          referred_by_profile_id: applicant.referred_by_profile_id ?? recruiter.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", applicantId);
    }

    // 4. Mint a single-use invitation for this self-registration.
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const { error: invErr } = await admin.from("invitations").insert({
      email,
      first_name: data.first_name,
      last_name: data.last_name,
      phone: data.phone,
      role: "agent",
      parent_user_id: recruiter.id,
      manager_id: recruiter.id,
      team_id: recruiter.team_id,
      state: data.state,
      licensed: true,
      npn: data.npn,
      instagram_handle: data.instagram_handle || null,
      invited_by: recruiter.id,
      status: "pending",
      token,
      expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      applicant_id: applicantId,
    });
    if (invErr) throw new Error(invErr.message);

    // 5. Create the auth account, then wire hierarchy + role through the
    //    existing invitation finalizer.
    const { data: createdUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { first_name: data.first_name, last_name: data.last_name },
    });
    if (createErr || !createdUser?.user) {
      throw new Error(
        createErr?.message || "Could not create your account. The email may already be in use.",
      );
    }

    const { error: finErr } = await admin.rpc("finalize_invitation_acceptance", {
      payload: {
        token,
        profile_id: createdUser.user.id,
        phone: data.phone,
        state: data.state,
        licensed: true,
        npn: data.npn,
        instagram_handle: data.instagram_handle ?? "",
        timezone: data.timezone ?? "",
      },
    });
    if (finErr) {
      await supabaseAdmin.auth.admin.deleteUser(createdUser.user.id).catch(() => {});
      throw new Error(finErr.message);
    }

    await admin.from("applicant_activities").insert({
      applicant_id: applicantId,
      event_type: "agent_self_registered",
      summary: matchedExisting
        ? "Existing applicant registered through invite link — matched to their record and sent to onboarding"
        : "Agent registered through invite link — sent to onboarding",
      actor_id: recruiter.id,
    });

    return { ok: true, email };
  });
