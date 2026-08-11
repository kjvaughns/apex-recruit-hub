import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PortalShell, PortalHeader } from "@/components/apex/portal-shell";
import {
  getMe,
  updateMyProfile,
  updateMyNotificationPrefs,
  getMySchedulingSettings,
  updateMySchedulingSettings,
  getTeamRecruitingLinks,
} from "@/lib/portal.functions";
import { CalendlyInline } from "@/components/apex/calendly-inline";
import { RecruitingLinkCard } from "@/components/apex/recruiting-link-card";
import { useTheme } from "@/components/apex/theme";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/portal/settings")({
  head: () => ({
    meta: [{ title: "Settings — Vantage Portal" }, { name: "robots", content: "noindex" }],
  }),
  component: PortalSettingsPage,
});

type Section = "profile" | "security" | "notifications" | "appearance" | "recruiting";
const SECTIONS: { key: Section; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "security", label: "Security" },
  { key: "notifications", label: "Notifications" },
  { key: "appearance", label: "Appearance" },
  { key: "recruiting", label: "Recruiting" },
];

function PortalSettingsPage() {
  const [section, setSection] = useState<Section>("profile");

  return (
    <PortalShell>
      <PortalHeader kicker="Portal" title="Settings" />
      <div className="px-6 py-8 md:px-10">
        <div className="mb-6 flex flex-wrap gap-1.5">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`rounded-[10px] px-4 py-2 text-[13px] font-semibold transition ${
                section === s.key
                  ? "bg-apex-gold text-apex-card"
                  : "border border-[var(--apx-hairline)] text-apex-dim hover:bg-[var(--apx-hover)]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="max-w-2xl">
          {section === "profile" && <ProfileSection />}
          {section === "security" && <SecuritySection />}
          {section === "notifications" && <NotificationsSection />}
          {section === "appearance" && <AppearanceSection />}
          {section === "recruiting" && <RecruitingSection />}
        </div>
      </div>
    </PortalShell>
  );
}

/* ---------------- Profile ---------------- */

function ProfileSection() {
  const qc = useQueryClient();
  const meFn = useServerFn(getMe);
  const saveFn = useServerFn(updateMyProfile);
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const profile = meQ.data?.profile as any;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.first_name ?? "");
    setLastName(profile.last_name ?? "");
    setPhone(profile.phone ?? "");
    setAvatarUrl(profile.avatar_url ?? null);
  }, [profile]);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: { first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim() },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Profile saved.");
    },
    onError: (e: unknown) => toast.error((e as Error).message || "Could not save profile."),
  });

  async function onAvatar(file: File) {
    if (!profile?.id) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = pub.publicUrl;
      await saveFn({ data: { avatar_url: url } });
      setAvatarUrl(url);
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Photo updated.");
    } catch (e) {
      toast.error((e as Error).message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const initials =
    ((firstName[0] ?? "") + (lastName[0] ?? "")).toUpperCase() || "A";

  return (
    <div className="apx-card p-6 md:p-8">
      <h2 className="font-display text-[24px] leading-none">Profile</h2>

      <div className="mt-6 flex items-center gap-4">
        <div className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-full bg-apex-gold/15 font-display text-[22px] text-apex-gold">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <label className="apx-btn-ghost cursor-pointer px-4 py-2.5 text-[13px]">
          {uploading ? "Uploading…" : "Change photo"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onAvatar(f);
            }}
          />
        </label>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label="First name">
          <input className="apx-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </Field>
        <Field label="Last name">
          <input className="apx-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </Field>
        <Field label="Phone">
          <input className="apx-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Email (read-only)">
          <input className="apx-input opacity-70" readOnly value={profile?.email ?? ""} />
        </Field>
      </div>

      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="apx-btn-primary mt-6 px-5 disabled:opacity-60"
      >
        {save.isPending ? "Saving…" : "Save profile"}
      </button>
    </div>
  );
}

/* ---------------- Security ---------------- */

function SecuritySection() {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setLastSignIn(data.user?.last_sign_in_at ?? null);
    });
  }, []);

  const valid = pw.length >= 8 && pw === confirm;

  async function changePassword() {
    if (!valid) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setPw("");
      setConfirm("");
      toast.success("Password updated.");
    } catch (e) {
      toast.error((e as Error).message || "Could not update password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="apx-card p-6 md:p-8">
        <h2 className="font-display text-[24px] leading-none">Change password</h2>
        <div className="mt-5 grid gap-4">
          <Field label="New password">
            <input
              type="password"
              className="apx-input"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="At least 8 characters"
            />
          </Field>
          <Field label="Confirm new password">
            <input
              type="password"
              className="apx-input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          {confirm && pw !== confirm && (
            <p className="text-[13px] text-red-300">Passwords don't match.</p>
          )}
          <button
            onClick={changePassword}
            disabled={!valid || busy}
            className="apx-btn-primary w-fit px-5 disabled:opacity-60"
          >
            {busy ? "Updating…" : "Update password"}
          </button>
        </div>
      </div>

      <div className="apx-card p-6 md:p-8">
        <h2 className="font-display text-[24px] leading-none">Session</h2>
        <p className="mt-3 text-[13.5px] text-apex-muted">
          Last sign-in:{" "}
          <span className="text-apex-ivory">
            {lastSignIn ? new Date(lastSignIn).toLocaleString() : "—"}
          </span>
        </p>
      </div>
    </div>
  );
}

/* ---------------- Notifications ---------------- */

const NOTIF_EVENTS: { key: string; label: string; def: boolean }[] = [
  { key: "new_applicant_assigned", label: "A new applicant is assigned to me", def: true },
  { key: "applicant_stage_changed", label: "An applicant moves to a new stage", def: true },
  { key: "follow_up_overdue", label: "A pre-licensing follow-up is overdue", def: true },
  { key: "evaluation_submitted", label: "An applicant submits their evaluation", def: true },
  { key: "weekly_summary", label: "Weekly summary of my pipeline", def: false },
];

function NotificationsSection() {
  const qc = useQueryClient();
  const meFn = useServerFn(getMe);
  const saveFn = useServerFn(updateMyNotificationPrefs);
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const stored = (meQ.data?.profile as any)?.notification_prefs as Record<string, boolean> | null;

  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const base: Record<string, boolean> = {};
    for (const e of NOTIF_EVENTS) base[e.key] = stored?.[e.key] ?? e.def;
    setPrefs(base);
  }, [stored]);

  const save = useMutation({
    mutationFn: () => saveFn({ data: { prefs } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Notification preferences saved.");
    },
    onError: (e: unknown) => toast.error((e as Error).message || "Could not save."),
  });

  return (
    <div className="apx-card p-6 md:p-8">
      <h2 className="font-display text-[24px] leading-none">Notifications</h2>
      <p className="mt-2 text-[13.5px] text-apex-muted">
        Choose which events email you. These are saved to your profile — we'll wire them into the
        exact send events as the list is finalized.
      </p>
      <div className="mt-5 flex flex-col divide-y divide-[var(--apx-hairline)]">
        {NOTIF_EVENTS.map((e) => (
          <div key={e.key} className="flex items-center justify-between gap-4 py-3.5">
            <span className="text-[14px] text-apex-fog">{e.label}</span>
            <Toggle
              on={!!prefs[e.key]}
              onChange={(v) => setPrefs((p) => ({ ...p, [e.key]: v }))}
            />
          </div>
        ))}
      </div>
      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="apx-btn-primary mt-6 px-5 disabled:opacity-60"
      >
        {save.isPending ? "Saving…" : "Save preferences"}
      </button>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 flex-none rounded-full transition-colors ${
        on ? "bg-apex-gold" : "bg-[var(--apx-hover)] border border-[var(--apx-hairline)]"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

/* ---------------- Appearance ---------------- */

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="apx-card p-6 md:p-8">
      <h2 className="font-display text-[24px] leading-none">Appearance</h2>
      <p className="mt-2 text-[13.5px] text-apex-muted">
        Choose how the portal looks. This preference is saved on this device.
      </p>
      <div className="mt-5 inline-flex overflow-hidden rounded-[10px] border border-[var(--apx-hairline)]">
        {(["dark", "light"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTheme(t)}
            className={`px-5 py-2.5 text-[13px] font-semibold capitalize transition ${
              theme === t
                ? "bg-apex-gold text-apex-card"
                : "bg-transparent text-apex-dim hover:bg-[var(--apx-hover)]"
            }`}
          >
            {t === "dark" ? "☾ Dark" : "☀ Light"}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Recruiting ---------------- */

const CALENDLY_RE = /^https:\/\/calendly\.com\/[A-Za-z0-9\-_/?&=.%#]+$/;

function RecruitingSection() {
  const getFn = useServerFn(getMySchedulingSettings);
  const saveFn = useServerFn(updateMySchedulingSettings);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["me", "scheduling"], queryFn: () => getFn() });
  const save = useMutation({
    mutationFn: (v: { licensed_calendly_url: string }) => saveFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me", "scheduling"] }),
  });

  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    if (q.data) setUrl(q.data.licensed_calendly_url ?? "");
  }, [q.data]);

  const isValid = url === "" || CALENDLY_RE.test(url);
  const status = !q.data ? "…" : url === "" ? "Not set" : !isValid ? "Invalid" : "Set";
  const canEdit = q.data?.can_edit ?? false;

  return (
    <div className="flex flex-col gap-6">
      <RecruitingLinkCard />
      <TeamRecruitingLinksCard />

      <div className="apx-card p-6 md:p-8">
        <h2 className="mb-4 font-display text-[24px] leading-none">Licensed scheduling</h2>
        {q.isLoading ? (
          <div className="text-apex-dim">Loading…</div>
        ) : !canEdit ? (
          <p className="text-apex-muted">
            Your account isn't permitted to schedule licensed applicants. Ask an administrator to
            enable this for you.
          </p>
        ) : (
          <>
            <label className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.06em] text-apex-faint">
              Licensed applicant Calendly link
            </label>
            <div className="flex flex-col gap-3 md:flex-row">
              <input
                className="apx-input flex-1"
                placeholder="https://calendly.com/your-name/interview"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <button
                onClick={() => save.mutate({ licensed_calendly_url: url })}
                disabled={!isValid || save.isPending}
                className="apx-btn-primary px-5 disabled:opacity-60"
              >
                {save.isPending ? "Saving…" : "Save"}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px]">
              <span className="rounded-full border border-[var(--apx-hairline)] px-2.5 py-1 text-apex-fog">
                Status: {status}
              </span>
              {q.data?.licensed_calendly_updated_at && (
                <span className="text-apex-faint">
                  Updated {new Date(q.data.licensed_calendly_updated_at).toLocaleString()}
                </span>
              )}
              {url && isValid && (
                <>
                  <a href={url} target="_blank" rel="noreferrer noopener" className="text-apex-gold hover:underline">
                    Test link →
                  </a>
                  <button onClick={() => setPreview((v) => !v)} className="text-apex-gold hover:underline">
                    {preview ? "Hide preview" : "Preview embed"}
                  </button>
                </>
              )}
            </div>
            {!isValid && url !== "" && (
              <p className="mt-3 text-[13px] text-red-300">Must be a valid https://calendly.com/... URL.</p>
            )}
            {preview && url && isValid && <CalendlyInline url={url} height={640} />}
          </>
        )}
      </div>
    </div>
  );
}

function useOrigin() {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  return origin;
}

function TeamRecruitingLinksCard() {
  const getFn = useServerFn(getTeamRecruitingLinks);
  const q = useQuery({ queryKey: ["team", "recruiting-links"], queryFn: () => getFn() });
  const origin = useOrigin();
  const agents = q.data?.agents ?? [];
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (q.isLoading || agents.length === 0) return null;

  async function copy(id: string, link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      /* noop */
    }
  }

  return (
    <div className="apx-card p-6 md:p-8">
      <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-apex-faint">Team</div>
      <h2 className="font-display text-[24px] leading-none">Team recruiting links</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-apex-muted">
        Referral links for active agents on your team.
      </p>
      <div className="mt-5 divide-y divide-[var(--apx-hairline)]">
        {agents.map((a) => {
          const link = a.recruiting_slug && origin ? `${origin}/?ref=${a.recruiting_slug}` : "";
          return (
            <div key={a.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="truncate text-[14px] text-apex-ivory">{a.full_name || "Unnamed agent"}</div>
                <div className="truncate text-[12.5px] text-apex-faint">{link || "No link"}</div>
              </div>
              <button
                onClick={() => copy(a.id, link)}
                disabled={!link}
                className="apx-btn-ghost shrink-0 px-4 py-2 text-[13px] disabled:opacity-50"
              >
                {copiedId === a.id ? "Copied!" : "Copy"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-apex-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
