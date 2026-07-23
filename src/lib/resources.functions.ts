import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.some((r: string) => r === "admin" || r === "super_admin")) {
    throw new Error("Forbidden: admin only");
  }
}

/* ============================================================ */
/* Reads                                                         */
/* ============================================================ */

export const getResourceHub = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [libRes, presRes, recRes, qlRes] = await Promise.all([
      supabase.from("resources").select("*").eq("is_published", true).order("position").order("created_at", { ascending: false }),
      supabase.from("presenters").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("recordings").select("id, presenter_id").eq("is_published", true),
      supabase.from("quick_links").select("*").eq("is_active", true).order("position"),
    ]);
    return {
      resourceCount: (libRes.data ?? []).length,
      presenterCount: (presRes.data ?? []).length,
      recordingCount: (recRes.data ?? []).length,
      quickLinks: qlRes.data ?? [],
    };
  });

export const listLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data } = await supabase
      .from("resources")
      .select("*")
      .eq("is_published", true)
      .order("position")
      .order("created_at", { ascending: false });
    return { resources: data ?? [] };
  });

export const listPresentersWithRecordings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [presRes, recRes] = await Promise.all([
      supabase.from("presenters").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("recordings").select("*").eq("is_published", true).order("position"),
    ]);
    return { presenters: presRes.data ?? [], recordings: recRes.data ?? [] };
  });

/* ============================================================ */
/* Admin: Resources                                              */
/* ============================================================ */

export const adminListResources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data } = await supabase.from("resources").select("*").order("position").order("created_at", { ascending: false });
    return { resources: data ?? [] };
  });

export const adminUpsertResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      title: z.string().min(1),
      description: z.string().optional().nullable(),
      long: z.string().optional().nullable(),
      category: z.string().min(1),
      type: z.enum(["video", "pdf", "training", "guide", "course"]),
      url: z.string().optional().nullable(),
      cta: z.string().optional().nullable(),
      meta: z.string().optional().nullable(),
      tags: z.array(z.string()).optional().default([]),
      display_date: z.string().optional().nullable(),
      position: z.number().int().optional().default(0),
      is_published: z.boolean().optional().default(true),
    }).parse(d),
  )
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

export const adminDeleteResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("resources").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================================================ */
/* Admin: Presenters                                             */
/* ============================================================ */

export const adminUpsertPresenter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      slug: z.string().min(1),
      name: z.string().min(1),
      role: z.string().optional().nullable(),
      initials: z.string().min(1).max(3),
      sort_order: z.number().int().optional().default(0),
      is_active: z.boolean().optional().default(true),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await supabase.from("presenters").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("presenters").insert(data);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeletePresenter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("presenters").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================================================ */
/* Admin: Recordings                                             */
/* ============================================================ */

export const adminUpsertRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      presenter_id: z.string().uuid(),
      title: z.string().min(1),
      topic: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
      video_url: z.string().optional().nullable(),
      audio: z.boolean().optional().default(false),
      duration: z.string().optional().nullable(),
      recorded_on: z.string().optional().nullable(),
      position: z.number().int().optional().default(0),
      is_published: z.boolean().optional().default(true),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await supabase.from("recordings").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("recordings").insert(data);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeleteRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("recordings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================================================ */
/* Admin: Quick Links                                            */
/* ============================================================ */

export const adminListQuickLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data } = await supabase.from("quick_links").select("*").order("position");
    return { links: data ?? [] };
  });

export const adminUpsertQuickLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      label: z.string().min(1),
      sub: z.string().optional().nullable(),
      url: z.string().min(1),
      position: z.number().int().optional().default(0),
      is_active: z.boolean().optional().default(true),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await supabase.from("quick_links").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("quick_links").insert(data);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeleteQuickLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("quick_links").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
