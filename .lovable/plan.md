# Vantage Academy — Complete Management System

Rebuild Academy management into three first-class content types (Recorded Presentations, Library, Courses), each with a native-looking Vantage admin experience, plus transcripts and AI training notes.

## Current state (verified)

- Academy admin is a single page with a Courses / Library toggle; Library rows are `library_resources` (title, description, type, url, is_required, slug) — there is no category, status, thumbnail, featured or "new" column, so the agent Academy already renders a `category` field that does not exist.
- `recordings` + `presenters` tables exist (from the older resources hub) but Academy does not read them; the agent "Recorded Presentations" section is currently just library video items.
- Courses support modules → lessons → quiz questions. Lessons only have title, kind, media_type, video_url, duration, blurb, pass threshold. No text body, no resource attachments, no per-question explanation, no course thumbnail / "what you'll learn", no publish flag per lesson.
- Progress persists already (`enrollments`, `lesson_progress`).
- A private `academy` storage bucket exists. Transcription and AI keys are both configured on the server.

## What gets built

### 1. Academy Admin Home
Replace the toggle with a management hub: three section cards (Recorded Presentations, Library, Courses), each showing published count, draft count, recently added, and Manage / Add New buttons. A "How to manage Academy" help modal explains each content type in plain language.

### 2. Recorded Presentations manager
- List: Title, Presenter, Format, Date, Transcript status, Status, row actions (Edit, Preview, Publish/Unpublish, Duplicate, Delete) — status changes happen inline, no need to open the record.
- Editor drawer: title, presenter (pick an existing portal user or create an external presenter with name/role/photo), presenter role, topic, date recorded, format (video/audio), duration, description, recording URL, thumbnail, Featured, New, Draft/Published.
- Source handling: Google Drive share links auto-converted to a playable/streamable form; also accepts Vimeo, Loom, unlisted YouTube, direct video/audio URLs, and uploads to the existing private media bucket. Supported sources listed under the field.
- Collapsible "How to add a recording" with the Google Drive sharing steps.

### 3. Library manager
- Types: PDF, document, guide, playbook, script, worksheet, link, video, audio, image, other.
- Fields: title, type, description, source (upload or URL), thumbnail, optional category (simple list + custom), date added, Featured, New, Required, Draft/Published. The old tag system is dropped in favour of one optional category.
- Uploads go to the private Academy bucket with progress, type/size validation, and signed-URL viewing/downloading for agents. Filename, file type, and media duration are auto-filled where reliably detectable.
- Video/audio resources enter the transcription flow automatically.
- Collapsible instructions: when to use Library, files vs links, supported types.

### 4. Course builder
- Create form stays short: title, description, instructor, instructor role, thumbnail, what you'll learn, required/optional, draft/published.
- Builder: single vertical, drag-and-drop-ordered lesson list. Lesson kinds: video, audio, text (simple rich text — headings, bold, lists, links, callouts), resource/PDF, external link, quiz. Per-lesson add, edit, duplicate, delete, reorder, publish/unpublish.
- Media lessons auto-transcribe and show Transcribing / Ready / Failed, with transcript and training notes attached.
- Quiz builder: question, options, correct answer, explanation, multiple questions, course-level passing percentage displayed as e.g. "Passing score: 80%".
- Collapsible instructions covering create → lessons → reorder → quiz → publish.

### 5. Transcription + AI training notes
- Asynchronous: adding valid media creates one job (deduplicated per media URL), states Not started / Queued / Processing / Completed / Failed, surfaced in admin. Publishing is never blocked.
- Before submitting, the media source is resolved to a genuinely fetchable URL; private or non-playable links fail fast with a plain-language message telling the admin exactly what to fix.
- On completion the transcript is stored and training notes are generated: summary, key takeaways, sales concepts, script/language examples, objections, action items, important moments with timestamps. Notes are editable, regenerable, permanently saved, and shown to agents under the media. The transcript is never overwritten by notes.

### 6. Agent experience
Concept unchanged — hub with the same three sections. Recordings get a proper player page with transcript and training notes. Library items open/download properly. Courses show lessons completed, total, percentage, current lesson, Required badge, continue/back/next, transcript, notes, resources, and quizzes with persisted scores. Drafts never appear to agents.

## Technical notes

- Migration: extend `library_resources` (category, status, thumbnail, featured, is_new, file_path, media metadata) and `recordings` (presenter role snapshot, format, thumbnail, featured, is_new, status, external presenter support); extend `courses` (thumbnail, outcomes, lesson count needs), `course_lessons` (kind set incl. text/resource/link, body, resource url/path, is_published), `quiz_questions` (explanation). New `media_transcripts` and `media_notes` (or equivalent columns) keyed to recording / library resource / lesson, plus a job/dedupe key. Every new table gets GRANTs, RLS, and policies: manage for admins and `can_manage_resources`, read for authenticated agents on published rows only.
- Existing library video rows stay in Library; no destructive data moves. Recorded Presentations is powered by `recordings`, which admins populate going forward.
- All writes go through `academy.functions.ts` server functions with the existing `assertCanManage` authorization; transcription callbacks/polling live in a server route that verifies its caller.
- Transcription and AI summarization run server-side only; keys are never sent to the browser.
- UI is built entirely from the existing `@/components/portal/ui` kit (Panel, Drawer, Tabs, Badge, Button, Toolbar, notify) — same density, radii, gold accents, and typography as the rest of the portal. No new visual language.

## Verification

End-to-end pass as admin (create recording from a Drive link → publish → playback → transcript → notes → edit; library PDF + video; course with video, text, PDF and quiz lessons, reordered and published) and as an agent (watch, read notes, open library files, complete lessons and quiz, return later and confirm progress persisted).
