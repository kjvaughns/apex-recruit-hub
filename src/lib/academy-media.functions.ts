import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { assertCanManage } from "@/lib/academy/guard";

const ownerSchema = z.object({
  owner_type: z.enum(["recording", "library", "lesson"]),
  owner_id: z.string().uuid(),
});

/** Read the transcript row for a media item (admin + agent readable). */
export const getTranscript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ownerSchema.parse(d))
  .handler(async ({ context, data }) => {
    const s = context.supabase as any;
    const { data: row } = await s
      .from("media_transcripts")
      .select("*")
      .eq("owner_type", data.owner_type)
      .eq("owner_id", data.owner_id)
      .maybeSingle();
    return { transcript: row ?? null };
  });

/** Queue transcription for a media item. Idempotent: an existing queued /
 *  processing job for the same source is reused instead of duplicated. */
export const requestTranscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    ownerSchema.extend({ source_url: z.string().trim().min(1).max(2000), force: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    const { resolveMedia, transcriptionBlocker } = await import("@/lib/academy/media");

    const blocker = transcriptionBlocker(data.source_url);
    if (blocker) throw new Error(blocker);
    const fetchUrl = resolveMedia(data.source_url).fetchUrl!;

    const { data: existing } = await s
      .from("media_transcripts")
      .select("*")
      .eq("owner_type", data.owner_type)
      .eq("owner_id", data.owner_id)
      .maybeSingle();

    if (
      existing &&
      !data.force &&
      existing.source_url === data.source_url &&
      ["queued", "processing", "completed"].includes(existing.status)
    ) {
      return { status: existing.status as string, reused: true };
    }

    const { submitTranscription } = await import("@/lib/academy/transcribe.server");
    let jobId: string;
    try {
      jobId = await submitTranscription(fetchUrl);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Transcription could not be started.";
      await s.from("media_transcripts").upsert(
        {
          owner_type: data.owner_type,
          owner_id: data.owner_id,
          source_url: data.source_url,
          resolved_url: fetchUrl,
          status: "failed",
          error: message,
          requested_at: new Date().toISOString(),
        },
        { onConflict: "owner_type,owner_id" },
      );
      throw new Error(message);
    }

    await s.from("media_transcripts").upsert(
      {
        owner_type: data.owner_type,
        owner_id: data.owner_id,
        source_url: data.source_url,
        resolved_url: fetchUrl,
        status: "queued",
        provider_job_id: jobId,
        error: null,
        transcript_text: null,
        transcript_segments: null,
        notes: existing?.notes ?? null,
        notes_status: "not_started",
        notes_error: null,
        requested_at: new Date().toISOString(),
        completed_at: null,
      },
      { onConflict: "owner_type,owner_id" },
    );
    return { status: "queued" as const, reused: false };
  });

/** Poll the provider for an in-flight job and persist the result. Safe to call
 *  repeatedly — completed jobs return immediately without re-hitting the API. */
export const syncTranscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ownerSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    const { data: row } = await s
      .from("media_transcripts")
      .select("*")
      .eq("owner_type", data.owner_type)
      .eq("owner_id", data.owner_id)
      .maybeSingle();
    if (!row?.provider_job_id) return { transcript: row ?? null };
    if (row.status === "completed" || row.status === "failed") return { transcript: row };

    const { fetchTranscription } = await import("@/lib/academy/transcribe.server");
    const res = await fetchTranscription(row.provider_job_id);

    const patch: Record<string, unknown> = { status: res.status };
    if (res.status === "completed") {
      patch.transcript_text = res.text;
      patch.transcript_segments = res.segments;
      patch.completed_at = new Date().toISOString();
      patch.error = null;
    } else if (res.status === "failed") {
      patch.error = res.error ?? "The transcription service could not process this media.";
    }
    const { data: updated } = await s
      .from("media_transcripts")
      .update(patch)
      .eq("id", row.id)
      .select("*")
      .maybeSingle();

    // Kick off notes generation once a transcript lands.
    if (res.status === "completed" && res.text && (updated?.notes_status ?? "not_started") === "not_started") {
      await buildNotes(s, updated, res.text, res.segments);
      const { data: withNotes } = await s.from("media_transcripts").select("*").eq("id", row.id).maybeSingle();
      return { transcript: withNotes ?? updated };
    }
    return { transcript: updated ?? row };
  });

async function buildNotes(
  s: any,
  row: any,
  text: string,
  segments: { start: number; end: number; text: string; speaker?: string | null }[] | null,
) {
  const { generateTrainingNotes } = await import("@/lib/academy/transcribe.server");
  const { formatTimestamp } = await import("@/lib/academy/media");
  await s.from("media_transcripts").update({ notes_status: "processing", notes_error: null }).eq("id", row.id);
  try {
    const names = (row?.speaker_names ?? {}) as Record<string, string>;
    const timed = (segments ?? [])
      .map((sg) => {
        const who = sg.speaker ? `${names[sg.speaker] || sg.speaker}: ` : "";
        return `[${formatTimestamp(sg.start)}] ${who}${sg.text}`;
      })
      .join("\n")
      .slice(0, 90000);
    const notes = await generateTrainingNotes(row.title ?? "Vantage training", text, timed);

    if (!notes) {
      await s
        .from("media_transcripts")
        .update({ notes_status: "not_started", notes_error: null })
        .eq("id", row.id);
      return;
    }
    await s.from("media_transcripts").update({ notes, notes_status: "completed" }).eq("id", row.id);
  } catch (e) {
    await s
      .from("media_transcripts")
      .update({
        notes_status: "failed",
        notes_error: e instanceof Error ? e.message : "Notes could not be generated.",
      })
      .eq("id", row.id);
  }
}

/** Regenerate AI training notes from the stored transcript. */
export const regenerateNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ownerSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    const { data: row } = await s
      .from("media_transcripts")
      .select("*")
      .eq("owner_type", data.owner_type)
      .eq("owner_id", data.owner_id)
      .maybeSingle();
    if (!row?.transcript_text) throw new Error("There's no transcript to summarize yet.");
    await buildNotes(s, row, row.transcript_text, row.transcript_segments ?? null);
    const { data: updated } = await s.from("media_transcripts").select("*").eq("id", row.id).maybeSingle();
    return { transcript: updated };
  });

/** Admin edits to the transcript text and/or the training notes. */
export const saveTranscriptEdits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    ownerSchema
      .extend({
        transcript_text: z.string().max(400000).optional(),
        notes: z
          .object({
            summary: z.string().max(8000).optional().default(""),
            key_takeaways: z.array(z.string().max(1000)).max(40).optional().default([]),
            sales_concepts: z.array(z.string().max(1000)).max(40).optional().default([]),
            script_examples: z.array(z.string().max(2000)).max(40).optional().default([]),
            objections: z.array(z.string().max(2000)).max(40).optional().default([]),
            action_items: z.array(z.string().max(1000)).max(40).optional().default([]),
            moments: z
              .array(
                z.object({
                  timestamp: z.string().max(20).optional().default(""),
                  title: z.string().max(200).optional().default(""),
                  detail: z.string().max(2000).optional().default(""),
                }),
              )
              .max(60)
              .optional()
              .default([]),
          })
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    const patch: Record<string, unknown> = {};
    if (data.transcript_text !== undefined) patch.transcript_text = data.transcript_text;
    if (data.notes !== undefined) {
      patch.notes = data.notes;
      patch.notes_status = "completed";
      patch.notes_error = null;
    }
    const { error } = await s
      .from("media_transcripts")
      .update(patch)
      .eq("owner_type", data.owner_type)
      .eq("owner_id", data.owner_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin renames the diarized speakers (e.g. "Speaker A" -> "Kevin"). */
export const saveSpeakerNames = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    ownerSchema
      .extend({ speaker_names: z.record(z.string().max(60), z.string().max(80)) })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId);
    const s = supabase as any;
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(data.speaker_names)) {
      const name = v.trim();
      if (name) cleaned[k] = name;
    }
    const { error } = await s
      .from("media_transcripts")
      .update({ speaker_names: cleaned })
      .eq("owner_type", data.owner_type)
      .eq("owner_id", data.owner_id);
    if (error) throw new Error(error.message);
    return { ok: true, speaker_names: cleaned };
  });
