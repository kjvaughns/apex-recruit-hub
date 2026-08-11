import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Admins, or anyone granted can_manage_resources, may edit Academy content.
 *  Mirrors the SQL academy_can_manage() used by RLS. */
async function assertCanManage(supabase: any, userId: string) {
  const [{ data: roleRows }, { data: prof }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("profiles").select("can_manage_resources").eq("id", userId).maybeSingle(),
  ]);
  const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
  const isAdmin = roles.some((r: string) => r === "admin" || r === "super_admin");
  if (!isAdmin && !prof?.can_manage_resources) {
    throw new Error("Forbidden: you are not permitted to manage Academy content.");
  }
}

/* ============================================================ */
/* Courses                                                       */
/* ============================================================ */

export const adminListCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const { data } = await (supabase as any)
      .from("courses")
      .select("id, slug, title, status, is_required, instructor_name, created_at")
      .order("created_at", { ascending: false });
    return { courses: data ?? [] };
  });

/** Full nested course tree for the editor. */
export const adminGetCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    const { data: course } = await s.from("courses").select("*").eq("id", data.id).maybeSingle();
    if (!course) throw new Error("Course not found");
    const { data: modules } = await s
      .from("course_modules")
      .select("*")
      .eq("course_id", data.id)
      .order("position");
    const moduleIds = (modules ?? []).map((m: any) => m.id);
    const { data: lessons } = moduleIds.length
      ? await s.from("course_lessons").select("*").in("module_id", moduleIds).order("position")
      : { data: [] };
    const quizIds = (lessons ?? []).filter((l: any) => l.kind === "quiz").map((l: any) => l.id);
    const { data: questions } = quizIds.length
      ? await s.from("quiz_questions").select("*").in("lesson_id", quizIds).order("position")
      : { data: [] };
    return { course, modules: modules ?? [], lessons: lessons ?? [], questions: questions ?? [] };
  });

export const adminUpsertCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().trim().min(1).max(200),
        slug: z.string().trim().max(200).optional().or(z.literal("")),
        description: z.string().max(1000).optional().or(z.literal("")),
        long_description: z.string().max(6000).optional().or(z.literal("")),
        instructor_name: z.string().max(160).optional().or(z.literal("")),
        instructor_role: z.string().max(160).optional().or(z.literal("")),
        is_required: z.boolean().optional(),
        status: z.enum(["draft", "published"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    const patch: Record<string, unknown> = {
      title: data.title,
      description: data.description || null,
      long_description: data.long_description || null,
      instructor_name: data.instructor_name || null,
      instructor_role: data.instructor_role || null,
      is_required: data.is_required ?? false,
      status: data.status ?? "draft",
    };
    if (data.slug) patch.slug = data.slug; // else the trigger auto-generates
    if (data.id) {
      const { error } = await s.from("courses").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await s.from("courses").insert(patch).select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const adminDeleteCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const { error } = await (supabase as any).from("courses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================================================ */
/* Modules / lessons / questions                                 */
/* ============================================================ */

export const adminUpsertModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        course_id: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        position: z.number().int().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    if (data.id) {
      const { error } = await s
        .from("course_modules")
        .update({ title: data.title })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { count } = await s
      .from("course_modules")
      .select("id", { count: "exact", head: true })
      .eq("course_id", data.course_id);
    const { data: created, error } = await s
      .from("course_modules")
      .insert({ course_id: data.course_id, title: data.title, position: count ?? 0 })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const adminUpsertLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        module_id: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        kind: z.enum(["lesson", "quiz"]),
        media_type: z.enum(["video", "audio"]).optional().nullable(),
        video_url: z.string().trim().max(1000).optional().or(z.literal("")),
        duration: z.string().trim().max(40).optional().or(z.literal("")),
        blurb: z.string().max(4000).optional().or(z.literal("")),
        quiz_pass_threshold: z.number().min(0).max(1).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    const patch: Record<string, unknown> = {
      title: data.title,
      kind: data.kind,
      media_type: data.kind === "quiz" ? null : (data.media_type ?? "video"),
      video_url: data.video_url || null,
      duration: data.duration || null,
      blurb: data.blurb || null,
      quiz_pass_threshold: data.quiz_pass_threshold ?? 0.75,
    };
    if (data.id) {
      const { error } = await s.from("course_lessons").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { count } = await s
      .from("course_lessons")
      .select("id", { count: "exact", head: true })
      .eq("module_id", data.module_id);
    const { data: created, error } = await s
      .from("course_lessons")
      .insert({ module_id: data.module_id, position: count ?? 0, ...patch })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const adminUpsertQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        lesson_id: z.string().uuid(),
        question_text: z.string().trim().min(1).max(1000),
        options: z.array(z.string().max(400)).min(2).max(6),
        correct_index: z.number().int().min(0),
        position: z.number().int().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    const patch = {
      question_text: data.question_text,
      options: data.options,
      correct_index: Math.min(data.correct_index, data.options.length - 1),
    };
    if (data.id) {
      const { error } = await s.from("quiz_questions").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { count } = await s
      .from("quiz_questions")
      .select("id", { count: "exact", head: true })
      .eq("lesson_id", data.lesson_id);
    const { data: created, error } = await s
      .from("quiz_questions")
      .insert({ lesson_id: data.lesson_id, position: count ?? 0, ...patch })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

/** Delete any Academy child row (module/lesson/question). */
export const adminDeleteNode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        kind: z.enum(["module", "lesson", "question"]),
        id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const table =
      data.kind === "module"
        ? "course_modules"
        : data.kind === "lesson"
          ? "course_lessons"
          : "quiz_questions";
    const { error } = await (supabase as any).from(table).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Persist a new order for modules / lessons / questions (position = index). */
export const adminReorder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        kind: z.enum(["module", "lesson", "question"]),
        ids: z.array(z.string().uuid()).max(200),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const table =
      data.kind === "module"
        ? "course_modules"
        : data.kind === "lesson"
          ? "course_lessons"
          : "quiz_questions";
    const s = supabase as any;
    await Promise.all(
      data.ids.map((id, i) => s.from(table).update({ position: i }).eq("id", id)),
    );
    return { ok: true };
  });

/* ============================================================ */
/* Library                                                       */
/* ============================================================ */

export const adminListLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    const [{ data: resources }, { data: joins }, { data: tags }] = await Promise.all([
      s.from("library_resources").select("*").order("created_at", { ascending: false }),
      s.from("library_resource_tags").select("resource_id, tag_id"),
      s.from("library_tags").select("id, name").order("name"),
    ]);
    const tagName: Record<string, string> = {};
    for (const t of tags ?? []) tagName[t.id] = t.name;
    const byResource: Record<string, string[]> = {};
    for (const j of joins ?? []) (byResource[j.resource_id] ??= []).push(tagName[j.tag_id]);
    return {
      resources: (resources ?? []).map((r: any) => ({ ...r, tags: byResource[r.id] ?? [] })),
      tags: tags ?? [],
    };
  });

export const adminUpsertResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().trim().min(1).max(200),
        slug: z.string().trim().max(200).optional().or(z.literal("")),
        description: z.string().max(2000).optional().or(z.literal("")),
        type: z.enum(["file", "video", "audio", "link"]),
        url: z.string().trim().max(1000).optional().or(z.literal("")),
        is_required: z.boolean().optional(),
        tags: z.array(z.string().trim().max(60)).max(20).optional().default([]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    const patch: Record<string, unknown> = {
      title: data.title,
      description: data.description || null,
      type: data.type,
      url: data.url || null,
      is_required: data.is_required ?? false,
    };
    if (data.slug) patch.slug = data.slug;

    let resourceId = data.id;
    if (resourceId) {
      const { error } = await s.from("library_resources").update(patch).eq("id", resourceId);
      if (error) throw new Error(error.message);
    } else {
      const { data: created, error } = await s
        .from("library_resources")
        .insert(patch)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      resourceId = created.id as string;
    }

    // Sync tags: ensure each exists, then replace the join set.
    const names = Array.from(new Set((data.tags ?? []).map((t) => t.trim()).filter(Boolean)));
    const tagIds: string[] = [];
    for (const name of names) {
      await s.from("library_tags").upsert({ name }, { onConflict: "name" });
      const { data: tag } = await s.from("library_tags").select("id").eq("name", name).maybeSingle();
      if (tag?.id) tagIds.push(tag.id);
    }
    await s.from("library_resource_tags").delete().eq("resource_id", resourceId);
    if (tagIds.length) {
      await s
        .from("library_resource_tags")
        .insert(tagIds.map((tag_id) => ({ resource_id: resourceId, tag_id })));
    }
    return { id: resourceId as string };
  });

export const adminDeleteResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const { error } = await (supabase as any).from("library_resources").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminRenameTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(60) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const { error } = await (supabase as any)
      .from("library_tags")
      .update({ name: data.name })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const { error } = await (supabase as any).from("library_tags").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
