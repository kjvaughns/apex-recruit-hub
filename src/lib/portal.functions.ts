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

/** The signed-in agent's recruiting slug + how many applicants it generated. */
export const getMyRecruitingLink = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles")
      .select("recruiting_slug, is_active, can_receive_applicants")
      .eq("id", userId)
      .maybeSingle();
    const { count } = await supabase
      .from("applicants")
      .select("id", { count: "exact", head: true })
      .eq("referred_by_profile_id", userId);
    return {
      recruiting_slug: prof?.recruiting_slug ?? null,
      is_active: prof?.is_active ?? false,
      can_receive_applicants: prof?.can_receive_applicants ?? false,
      applicant_count: count ?? 0,
    };
  });

/** Managers/admins: recruiting links of active agents on their team. */
export const getTeamRecruitingLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const roles = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roleList = (roles.data ?? []).map((r) => r.role as string);
    const isManager = roleList.some((r) => r === "manager" || r === "admin" || r === "super_admin");
    if (!isManager) return { agents: [] as TeamRecruitingLink[] };
    const { data: me } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
    if (!me?.team_id) return { agents: [] as TeamRecruitingLink[] };
    const { data: agents } = await supabase
      .from("profiles")
      .select("id, full_name, recruiting_slug, can_receive_applicants")
      .eq("team_id", me.team_id)
      .eq("is_active", true)
      .order("full_name");
    return { agents: (agents ?? []) as TeamRecruitingLink[] };
  });

type TeamRecruitingLink = {
  id: string;
  full_name: string | null;
  recruiting_slug: string | null;
  can_receive_applicants: boolean;
};

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
      role: z.enum(["agent", "manager", "admin", "super_admin"]),
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
      team_id: z.string().uuid().nullable().optional(),
      is_active: z.boolean().optional(),
      can_receive_applicants: z.boolean().optional(),
      recruiting_slug: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug may only contain lowercase letters, numbers and hyphens")
        .max(120)
        .optional(),
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

/* ============================================================
   Tasks
   ============================================================ */

const taskInput = z.object({
  scope: z.enum(["mine", "all"]).optional().default("mine"),
  status: z.enum(["open", "done", "all"]).optional().default("open"),
});

export const listTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => taskInput.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("tasks")
      .select("id, title, notes, due_at, completed_at, priority, assigned_to, created_by, applicant_id, created_at, applicants(first_name, last_name)")
      .order("completed_at", { ascending: true, nullsFirst: true })
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.scope === "mine") q = q.eq("assigned_to", userId);
    if (data.status === "open") q = q.is("completed_at", null);
    if (data.status === "done") q = q.not("completed_at", "is", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { tasks: rows ?? [] };
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    title: z.string().trim().min(1).max(200),
    notes: z.string().max(2000).optional(),
    due_at: z.string().datetime().optional().nullable(),
    priority: z.enum(["low", "normal", "high"]).optional().default("normal"),
    assigned_to: z.string().uuid().optional().nullable(),
    applicant_id: z.string().uuid().optional().nullable(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("tasks").insert({
      title: data.title,
      notes: data.notes ?? null,
      due_at: data.due_at ?? null,
      priority: data.priority,
      assigned_to: data.assigned_to ?? userId,
      created_by: userId,
      applicant_id: data.applicant_id ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), done: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("tasks")
      .update({ completed_at: data.done ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase.from("tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================================================
   Calendar
   ============================================================ */

export const getCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
    scope: z.enum(["mine", "all"]).optional().default("mine"),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let apps = supabase
      .from("applicants")
      .select("id, first_name, last_name, calendly_scheduled_at, assigned_recruiter_id")
      .not("calendly_scheduled_at", "is", null)
      .gte("calendly_scheduled_at", data.from)
      .lte("calendly_scheduled_at", data.to);
    if (data.scope === "mine") apps = apps.eq("assigned_recruiter_id", userId);

    let tasks = supabase
      .from("tasks")
      .select("id, title, due_at, completed_at, priority, assigned_to")
      .not("due_at", "is", null)
      .gte("due_at", data.from)
      .lte("due_at", data.to);
    if (data.scope === "mine") tasks = tasks.eq("assigned_to", userId);

    const [appsRes, tasksRes] = await Promise.all([apps, tasks]);
    return { appointments: appsRes.data ?? [], tasks: tasksRes.data ?? [] };
  });

/* ============================================================
   Leaderboard
   ============================================================ */

export const getLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    window: z.enum(["7d", "30d", "90d", "all"]).optional().default("30d"),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const days = data.window === "7d" ? 7 : data.window === "30d" ? 30 : data.window === "90d" ? 90 : 3650;
    const since = new Date(Date.now() - days * 86400_000).toISOString();

    const [appsRes, profilesRes] = await Promise.all([
      supabase
        .from("applicants")
        .select("assigned_recruiter_id, calendly_scheduled_at, evaluation_completed_at, created_at, current_stage_id, pipeline_stages(is_completed_stage)")
        .gte("created_at", since)
        .not("assigned_recruiter_id", "is", null),
      supabase.from("profiles").select("id, first_name, last_name, avatar_url").eq("is_active", true),
    ]);

    const byUser: Record<string, { user_id: string; applicants: number; scheduled: number; evaluated: number; onboarded: number }> = {};
    for (const p of profilesRes.data ?? []) {
      byUser[p.id] = { user_id: p.id, applicants: 0, scheduled: 0, evaluated: 0, onboarded: 0 };
    }
    for (const a of appsRes.data ?? []) {
      const uid = a.assigned_recruiter_id as string | null;
      if (!uid) continue;
      const row = (byUser[uid] ??= { user_id: uid, applicants: 0, scheduled: 0, evaluated: 0, onboarded: 0 });
      row.applicants += 1;
      if (a.calendly_scheduled_at) row.scheduled += 1;
      if (a.evaluation_completed_at) row.evaluated += 1;
      const stage = a.pipeline_stages as { is_completed_stage: boolean } | null;
      if (stage?.is_completed_stage) row.onboarded += 1;
    }
    const profileMap: Record<string, { first_name: string | null; last_name: string | null; avatar_url: string | null }> = {};
    for (const p of profilesRes.data ?? []) profileMap[p.id] = p;

    const rows = Object.values(byUser)
      .map((r) => ({ ...r, profile: profileMap[r.user_id] ?? null, score: r.onboarded * 10 + r.evaluated * 3 + r.scheduled * 2 + r.applicants }))
      .filter((r) => r.applicants > 0 || r.scheduled > 0 || r.evaluated > 0 || r.onboarded > 0)
      .sort((a, b) => b.score - a.score);

    return { rows };
  });

/* ============================================================
   Resources
   ============================================================ */

export const listResources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data } = await supabase
      .from("resources")
      .select("*")
      .order("position", { ascending: true })
      .order("created_at", { ascending: false });
    return { resources: data ?? [] };
  });

export const upsertResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid().optional(),
    title: z.string().min(1),
    description: z.string().optional().nullable(),
    category: z.string().min(1),
    url: z.string().url().optional().nullable(),
    kind: z.enum(["link", "doc", "video"]).optional().default("link"),
    position: z.number().int().optional().default(0),
    is_published: z.boolean().optional().default(true),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await supabase.from("resources").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("resources").insert({ ...data, created_by: userId });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("resources").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================================================
   Scheduling settings (per-user)
   ============================================================ */

const calendlyUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https:\/\/calendly\.com\/[A-Za-z0-9\-_/?&=.%#]+$/.test(v), {
    message: "Must be a valid https://calendly.com/... URL",
  });

export const getMySchedulingSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("profiles")
      .select("licensed_calendly_url, can_schedule_licensed, licensed_calendly_updated_at")
      .eq("id", userId)
      .maybeSingle();
    const roles = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roleList = (roles.data ?? []).map((r) => r.role as string);
    const isPrivileged = roleList.some((r) => r === "manager" || r === "admin" || r === "super_admin");
    return {
      licensed_calendly_url: data?.licensed_calendly_url ?? "",
      can_schedule_licensed: data?.can_schedule_licensed ?? false,
      licensed_calendly_updated_at: data?.licensed_calendly_updated_at ?? null,
      can_edit: isPrivileged || (data?.can_schedule_licensed ?? false),
    };
  });

export const updateMySchedulingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ licensed_calendly_url: calendlyUrlSchema }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const roles = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roleList = (roles.data ?? []).map((r) => r.role as string);
    const { data: prof } = await supabase
      .from("profiles")
      .select("can_schedule_licensed")
      .eq("id", userId)
      .maybeSingle();
    const isPrivileged = roleList.some((r) => r === "manager" || r === "admin" || r === "super_admin");
    if (!isPrivileged && !prof?.can_schedule_licensed) {
      throw new Error("You don't have permission to set a licensed Calendly link.");
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        licensed_calendly_url: data.licensed_calendly_url || null,
        licensed_calendly_updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetAgentScheduling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      can_schedule_licensed: z.boolean().optional(),
      licensed_calendly_url: calendlyUrlSchema.optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const patch: { can_schedule_licensed?: boolean; licensed_calendly_url?: string | null; licensed_calendly_updated_at?: string } = {};
    if (data.can_schedule_licensed !== undefined) patch.can_schedule_licensed = data.can_schedule_licensed;
    if (data.licensed_calendly_url !== undefined) {
      patch.licensed_calendly_url = data.licensed_calendly_url || null;
      patch.licensed_calendly_updated_at = new Date().toISOString();
    }
    const { error } = await supabase.from("profiles").update(patch).eq("id", data.user_id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

