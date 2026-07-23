
## Scope

Replace the current simple `/portal/resources` page with the full **APEX Agent Hub** design from your zip: a hub landing → two sub-views (Resource Library + Recorded Presentations), plus a Quick Links footer. Data comes from the database (not `window.APEX_*`), and admins can manage everything in-app.

Uses the existing portal auth — no password gate (already signed in via Supabase).

**Deferred (not part of this build):** the full 6-lesson Phone Sales Mastery *course engine* with per-user progress, quizzes, and certificate. That's its own module (course viewer, quiz grader, `enrollments` / `quiz_responses` tables). Say the word if you want it in a follow-up phase — otherwise I'll seed the course PDF/summary as a regular "training" resource card here.

## Design tokens

Straight from the design HTML: `--bg #0A0A0A`, `--surface #131313`, `--surface-2 #1A1A1A`, gold `#C9A84C`, ivory `#F4F2ED`, muted `#8C8A84`. Bebas Neue headings, DM Sans body (already registered). Type badges keep the design's palette (video red `#E5484D`, pdf blue `#4C7DF0`, training gold, guide green `#46A758`).

## Data model

Add three tables + extend `resources`:

```text
resources (extend)
  + type          text        -- 'video' | 'pdf' | 'training' | 'guide' | 'course'
  + long          text        -- long description shown in modal
  + cta           text        -- button label ("Open PDF", "Open Script"…)
  + meta          text        -- "PDF", "Script · Google Doc", …
  + tags          text[]      -- hashtag chips
  + display_date  date        -- "May 28, 2026" shown on card
  (existing: title, description, category, url, position, is_published)

presenters
  id, name, role, initials, sort_order, is_active

recordings
  id, presenter_id → presenters, title, topic, description,
  video_url (Google Drive /preview or YouTube embed), audio (bool),
  duration text (e.g. "9:45"), recorded_on date, is_published, position

quick_links
  id, label, sub, url, position, is_active
```

RLS: `authenticated` can SELECT published rows; admins can insert/update/delete.
GRANTs: `SELECT, INSERT, UPDATE, DELETE` to `authenticated`, `ALL` to `service_role`.
Seed with the exact rows from `project/data.js` (Playbook + Needs Quiz + two scripts + 5 presenters + KJ's 3 recordings + 4 quick links).

The Playbook and Needs-Analysis PDFs from the zip get uploaded via `lovable-assets` and their CDN URLs stored in the seed rows — no binaries in the repo.

## Routes

```text
/portal/resources                → Hub landing (2 tiles + Quick Links)
/portal/resources/library        → Filterable library grid + modal
/portal/resources/presentations  → Presenter selector + recordings + player modal
/portal/resources/admin          → Admin-only: manage resources / presenters / recordings / quick links
```

Sidebar keeps a single "Resources" link pointing to `/portal/resources`. Sub-nav (`← Hub`) inside the section matches the design.

## Component/file plan

New:
- `src/lib/resources.functions.ts` — server fns: `getHub`, `listLibrary`, `listPresenters`, `listRecordings`, `listQuickLinks`, plus admin `upsert*` / `delete*` for the four entities.
- `src/components/apex/resources/` — presentation components (Hub tiles, LibraryCard, LibraryModal, PresenterSelector, RecordingRow, MediaPlayer with mock transcript, PlayerModal, QuickLinks).
- `src/routes/_authenticated/portal/resources/route.tsx` — outlet layout.
- `src/routes/_authenticated/portal/resources/index.tsx` — Hub view.
- `src/routes/_authenticated/portal/resources/library.tsx` — Library view (tabs + search).
- `src/routes/_authenticated/portal/resources/presentations.tsx` — Recordings view.
- `src/routes/_authenticated/portal/resources/admin.tsx` — admin CRUD tabs (Resources / Presenters / Recordings / Quick Links).

Delete/replace:
- Old flat `src/routes/_authenticated/portal/resources.tsx` (becomes the folder above).

Keep:
- Existing `resources` server fns get folded into the new file; admin CRUD you already have keeps working through the new admin tab.

## Media player details

Matches the design's `MediaPlayer`:
- Google Drive `/preview` URLs render in a 16:9 `<iframe>`; audio-only shows the shorter player strip; no source ⇒ animated placeholder.
- Below the frame: a play/pause + progress bar with a **client-side mock transcript** generated deterministically from the recording's id + duration (same algorithm as `makeTranscript` in the design). Real transcript ingestion (Whisper) is out of scope — the mock keeps the visual behavior; each row seeks the player.

## Out of scope for this build

- Course engine, quiz grading, per-user progress, certificate PDF.
- Whisper transcription pipeline / real transcript storage.
- File-upload UI for recordings (admins paste Drive/YouTube embed URLs for now).
- Tweaks panel (accent/density/card style toggles) — those were designer knobs, not production controls.

## Verification

Typecheck (`bunx tsgo --noEmit`) and a quick preview walkthrough: hub → library filters/search/modal → presentations presenter switch + player modal → admin adds a test recording and it appears immediately.
