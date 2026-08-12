# Clickable timestamps + speaker-separated transcripts

Make Academy recording transcripts navigable: every line shows a timestamp an agent can click to jump the player to that moment, and lines are grouped by who is speaking.

## What agents will see

- Transcript panel becomes a list of blocks: `Speaker A · 14:32` followed by that person's words, with a new block each time the speaker changes.
- Clicking a timestamp (or a line) seeks the video/audio to that second and starts playing.
- The active block highlights and auto-scrolls as playback moves.
- Timestamps inside the AI training notes ("Moments") become clickable too, jumping to the same player.
- Admins can rename speakers on a recording (e.g. "Speaker A" -> "Kevin") so learners see real names. Names are stored per transcript.

## How transcription changes

- AssemblyAI requests turn on speaker diarization (`speaker_labels`). We read the returned `utterances` (each has speaker, start, end, text) instead of grouping raw words, and fall back to the current word-grouping when no utterances come back.
- Stored transcript segments gain a `speaker` field; existing transcripts keep working (no speaker shown, timestamps still clickable). Re-running transcription on an old recording adds speakers.
- The timed transcript handed to the AI notes generator includes speaker labels, so notes and moments can attribute quotes.

## Player seeking

- Direct video/audio files and uploaded media: seek via the media element `currentTime`.
- YouTube and Vimeo embeds: seek through their player APIs (YouTube iframe `postMessage`, Vimeo player `postMessage`), with embed URLs updated to allow API control.
- Google Drive / Loom embeds don't expose seeking; for those the timestamp is shown as a non-clickable label with a short note, instead of a button that silently does nothing.

## Technical notes

- `src/lib/academy/transcribe.server.ts`: add `speaker_labels: true` to the submit body; map `utterances` -> `{ start, end, text, speaker }`; keep `groupWords` fallback; include `[mm:ss] Speaker A:` prefixes in the timed transcript for notes.
- `src/lib/academy-media.functions.ts`: persist the new segment shape unchanged (`transcript_segments` is jsonb); add a server function to save a `speaker_names` map (stored inside the existing `notes`-adjacent jsonb via a new `speaker_names` key on the transcript row's `notes` sibling — added as a migration column `speaker_names jsonb`).
- Migration: `alter table public.media_transcripts add column speaker_names jsonb not null default '{}'::jsonb;` (RLS/grants unchanged).
- New component `src/components/vantage/academy/transcript-viewer.tsx`: renders speaker-grouped, timestamped, clickable segments with active-segment tracking; takes an `onSeek(seconds)` callback and a `canSeek` flag.
- New hook/helper `src/components/vantage/academy/use-media-seek.ts`: unified seek + time tracking for `<video>`/`<audio>` refs and YouTube/Vimeo iframes.
- `src/routes/_authenticated/portal/academy/presentations.$slug.tsx` and `courses.$slug.tsx`: wire the player ref/iframe into the viewer, replace the plain `whitespace-pre-wrap` transcript block, and make notes "Moments" timestamps call the same seek.
- `src/components/vantage/academy/media-fields.tsx`: admin transcript preview reuses the viewer and gains speaker renaming.
- Design tokens and existing Panel/Tabs/Badge components only — no new colors.
