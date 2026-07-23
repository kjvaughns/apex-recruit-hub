import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Current user profile + roles + team. */
export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    return {
      profile: profileRes.data,
      roles: (rolesRes.data ?? []).map((r) => r.role),
    };
  });

/** Dashboard KPIs + activity feed for the signed-in user. */
export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();
    const since7 = new Date(Date.now() - 7 * 86400_000).toISOString();

    const [mineRes, mine7Res, scheduledRes, evalDoneRes, feedRes, stagesRes] = await Promise.all([
      supabase.from("applicants").select("id, current_stage_id, status", { count: "exact" })
        .eq("assigned_recruiter_id", userId).is("archived_at", null),
      supabase.from("applicants").select("id", { count: "exact", head: true })
        .eq("assigned_recruiter_id", userId).gte("created_at", since7),
      supabase.from("applicants").select("id", { count: "exact", head: true })
        .eq("assigned_recruiter_id", userId).not("calendly_scheduled_at", "is", null).gte("calendly_scheduled_at", since30),
      supabase.from("applicants").select("id", { count: "exact", head: true })
        .eq("assigned_recruiter_id", userId).not("evaluation_completed_at", "is", null).gte("evaluation_completed_at", since30),
      supabase.from("applicant_activities").select("id, event_type, summary, created_at, applicant_id, applicants(first_name, last_name, assigned_recruiter_id)")
        .order("created_at", { ascending: false }).limit(15),
      supabase.from("pipeline_stages").select("id, name, slug, color, position").eq("is_archived", false).order("position"),
    ]);

    const stages = stagesRes.data ?? [];
    const stageCounts: Record<string, number> = {};
    for (const a of mineRes.data ?? []) {
      if (a.current_stage_id) stageCounts[a.current_stage_id] = (stageCounts[a.current_stage_id] ?? 0) + 1;
    }

    return {
      counts: {
        totalMine: mineRes.count ?? 0,
        newThisWeek: mine7Res.count ?? 0,
        scheduled30d: scheduledRes.count ?? 0,
        evaluated30d: evalDoneRes.count ?? 0,
      },
      stages,
      stageCounts,
      feed: (feedRes.data ?? []).filter((f) => {
        // Show items for own applicants; managers/admins see all via RLS
        const rec = (f.applicants as { assigned_recruiter_id: string | null } | null)?.assigned_recruiter_id;
        return !rec || rec === userId || true;
      }),
    };
  });

const listInput = z.object({
  q: z.string().optional().default(""),
  stage: z.string().optional().default(""),
  scope: z.enum(["mine", "team", "all"]).optional().default("mine"),
  limit: z.number().int().min(1).max(200).optional().default(100),
});

export const listApplicants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listInput.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let query = supabase
      .from("applicants")
      .select("id, first_name, last_name, email, phone, state, city, priority, status, current_stage_id, assigned_recruiter_id, evaluation_completed_at, calendly_scheduled_at, licensed, created_at, updated_at, stage_entered_at")
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(data.limit);

    if (data.scope === "mine") query = query.eq("assigned_recruiter_id", userId);
    if (data.stage) query = query.eq("current_stage_id", data.stage);
    if (data.q.trim()) {
      const q = data.q.trim();
      query = query.or(
        `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`,
      );
    }

    const [aRes, stagesRes] = await Promise.all([
      query,
      supabase.from("pipeline_stages").select("id, name, slug, color, position").eq("is_archived", false).order("position"),
    ]);

    return { applicants: aRes.data ?? [], stages: stagesRes.data ?? [] };
  });

export const getApplicant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const [aRes, actsRes, evalRes, stagesRes] = await Promise.all([
      supabase.from("applicants").select("*").eq("id", data.id).maybeSingle(),
      supabase.from("applicant_activities").select("id, event_type, summary, created_at, data").eq("applicant_id", data.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("evaluations").select("id, email, answers, matched, created_at").eq("applicant_id", data.id).order("created_at", { ascending: false }),
      supabase.from("pipeline_stages").select("id, name, slug, color, position").eq("is_archived", false).order("position"),
    ]);
    if (!aRes.data) throw new Error("Applicant not found");
    return {
      applicant: aRes.data,
      activities: actsRes.data ?? [],
      evaluations: evalRes.data ?? [],
      stages: stagesRes.data ?? [],
    };
  });

export const updateApplicantStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), stage_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("applicants")
      .update({ current_stage_id: data.stage_id, stage_entered_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("applicant_activities").insert({
      applicant_id: data.id,
      event_type: "stage_changed",
      summary: "Stage updated",
      actor_id: userId,
      data: { stage_id: data.stage_id },
    });
    return { ok: true };
  });

export const addApplicantNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), note: z.string().trim().min(1).max(2000) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await supabase.from("applicant_activities").insert({
      applicant_id: data.id,
      event_type: "note",
      summary: data.note,
      actor_id: userId,
    });
    await supabase.from("applicants").update({ last_contacted_at: new Date().toISOString() }).eq("id", data.id);
    return { ok: true };
  });

/* ============================================================
   Admin functions
   ============================================================ */

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.some((r: string) => r === "admin" || r === "super_admin")) {
    throw new Error("Forbidden: admin only");
  }
  return roles;
}

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const [profilesRes, rolesRes, teamsRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("teams").select("*").order("name"),
    ]);
    const roleMap: Record<string, string[]> = {};
    for (const r of rolesRes.data ?? []) {
      (roleMap[r.user_id] ??= []).push(r.role);
    }
    return {
      users: (profilesRes.data ?? []).map((p: any) => ({ ...p, roles: roleMap[p.id] ?? [] })),
      teams: teamsRes.data ?? [],
    };
  });

export const adminSetUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      role: z.enum(["agent", "senior_agent", "manager", "admin", "super_admin"]),
      grant: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (data.grant) {
      await supabase.from("user_roles").upsert({ user_id: data.user_id, role: data.role }, { onConflict: "user_id,role" });
    } else {
      await supabase.from("user_roles").delete().eq("user_id", data.user_id).eq("role", data.role);
    }
    return { ok: true };
  });

export const adminUpdateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      phone: z.string().optional(),
      title: z.string().optional(),
      team_id: z.string().uuid().nullable().optional(),
      is_active: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { id, ...rest } = data;
    const { error } = await supabase.from("profiles").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListStages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data } = await supabase.from("pipeline_stages").select("*").order("position");
    return { stages: data ?? [] };
  });

export const adminUpsertStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().min(1),
      slug: z.string().min(1),
      color: z.string().optional(),
      position: z.number().int(),
      is_archived: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (data.id) {
      const { error } = await supabase.from("pipeline_stages").update(data).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("pipeline_stages").insert(data);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminGetSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data } = await supabase.from("system_settings").select("*");
    return { settings: data ?? [] };
  });

export const adminSetSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ key: z.string().min(1), value: z.any() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("system_settings")
      .upsert({ key: data.key, value: data.value }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

