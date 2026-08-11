import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PortalShell } from "@/components/vantage/portal-shell";
import {
  PageHeader,
  PageBody,
  Panel,
  Button,
  Field,
  Input,
  Textarea,
  Select,
  FormGrid,
  SegmentedControl,
  Badge,
  Avatar,
  btnClass,
} from "@/components/portal/ui";
import {
  getMe,
  updateMyProfile,
  updateMyNotificationPrefs,
  getMySchedulingSettings,
  updateMySchedulingSettings,
  getTeamRecruitingLinks,
} from "@/lib/portal.functions";
import { CalendlyInline } from "@/components/vantage/calendly-inline";
import { RecruitingLinkCard } from "@/components/vantage/recruiting-link-card";
import { useTheme } from "@/components/vantage/theme";
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
      <PageBody>
        <PageHeader title="Settings" description="Manage your profile, security, and preferences." />

        <div className="sm:hidden mb-4">
          <Select value={section} onChange={(e) => setSection(e.target.value as Section)}>
            {SECTIONS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="hidden gap-4 sm:grid sm:grid-cols-[200px_minmax(0,1fr)] sm:items-start">
          <nav className="p-panel flex flex-col gap-0.5 p-1.5">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className="p-focus rounded-[8px] px-3 py-2 text-left text-[13.5px] font-medium transition"
                style={
                  section === s.key
                    ? { background: "var(--p-gold-soft)", color: "var(--p-gold)" }
                    : { color: "var(--p-text-2)" }
                }
              >
                {s.label}
              </button>
            ))}
          </nav>
          <div className="min-w-0 space-y-4">
            {section === "profile" && <ProfileSection />}
            {section === "security" && <SecuritySection />}
            {section === "notifications" && <NotificationsSection />}
            {section === "appearance" && <AppearanceSection />}
            {section === "recruiting" && <RecruitingSection />}
          </div>
        </div>

        <div className="space-y-4 sm:hidden">
          {section === "profile" && <ProfileSection />}
          {section === "security" && <SecuritySection />}
          {section === "notifications" && <NotificationsSection />}
          {section === "appearance" && <AppearanceSection />}
          {section === "recruiting" && <RecruitingSection />}
        </div>
      </PageBody>
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
      // The avatars bucket is private, so store a long-lived signed URL.
      const { data: signed, error: signErr } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Could not sign upload URL.");
      const url = signed.signedUrl;
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

  return (
    <Panel title="Profile">
      <div className="flex items-center gap-4">
        <Avatar name={`${firstName} ${lastName}`.trim()} src={avatarUrl} size={56} />
        <label className={btnClass("secondary", "sm") + " cursor-pointer"}>
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

      <FormGrid className="mt-5">
        <Field label="First name">
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </Field>
        <Field label="Last name">
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </Field>
        <Field label="Phone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Email (read-only)">
          <Input readOnly value={profile?.email ?? ""} className="opacity-70" />
        </Field>
      </FormGrid>

      <Button variant="primary" className="mt-5" onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save profile"}
      </Button>
    </Panel>
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
    <div className="space-y-4">
      <Panel title="Change password">
        <div className="grid gap-4">
          <Field label="New password">
            <Input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="At least 8 characters"
            />
          </Field>
          <Field label="Confirm new password">
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          {confirm && pw !== confirm && (
            <p className="text-[13px]" style={{ color: "var(--p-red)" }}>
              Passwords don't match.
            </p>
          )}
          <Button variant="primary" className="w-fit" onClick={changePassword} disabled={!valid || busy}>
            {busy ? "Updating…" : "Update password"}
          </Button>
        </div>
      </Panel>

      <Panel title="Session">
        <p className="p-secondary">
          Last sign-in:{" "}
          <span style={{ color: "var(--p-text)" }}>
            {lastSignIn ? new Date(lastSignIn).toLocaleString() : "—"}
          </span>
        </p>
      </Panel>
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
    <Panel
      title="Notifications"
      description="Choose which events email you. These are saved to your profile — we'll wire them into the exact send events as the list is finalized."
    >
      <div className="flex flex-col divide-y" style={{ borderColor: "var(--p-border)" }}>
        {NOTIF_EVENTS.map((e) => (
          <div key={e.key} className="flex items-center justify-between gap-4 py-3" style={{ borderColor: "var(--p-border)" }}>
            <span className="p-body">{e.label}</span>
            <Toggle on={!!prefs[e.key]} onChange={(v) => setPrefs((p) => ({ ...p, [e.key]: v }))} />
          </div>
        ))}
      </div>
      <Button variant="primary" className="mt-5" onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save preferences"}
      </Button>
    </Panel>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="p-focus relative h-6 w-11 flex-none rounded-full border transition-colors"
      style={{
        background: on ? "var(--p-gold)" : "var(--p-raised)",
        borderColor: on ? "var(--p-gold)" : "var(--p-border)",
      }}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? "translateX(22px)" : "translateX(2px)" }}
      />
    </button>
  );
}

/* ---------------- Appearance ---------------- */

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  return (
    <Panel title="Appearance" description="Choose how the portal looks. This preference is saved on this device.">
      <SegmentedControl
        options={[
          { value: "dark", label: "☾ Dark" },
          { value: "light", label: "☀ Light" },
        ]}
        value={theme}
        onChange={(v) => setTheme(v as "dark" | "light")}
      />
    </Panel>
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
    <div className="space-y-4">
      <RecruitingLinkCard />
      <TeamRecruitingLinksCard />

      <Panel title="Licensed scheduling">
        {q.isLoading ? (
          <div className="p-muted">Loading…</div>
        ) : !canEdit ? (
          <p className="p-secondary">
            Your account isn't permitted to schedule licensed applicants. Ask an administrator to
            enable this for you.
          </p>
        ) : (
          <>
            <Field label="Licensed applicant Calendly link">
              <div className="flex flex-col gap-3 md:flex-row">
                <Input
                  className="flex-1"
                  placeholder="https://calendly.com/your-name/interview"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <Button
                  variant="primary"
                  onClick={() => save.mutate({ licensed_calendly_url: url })}
                  disabled={!isValid || save.isPending}
                >
                  {save.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </Field>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px]">
              <Badge tone={status === "Set" ? "green" : status === "Invalid" ? "red" : "neutral"}>
                Status: {status}
              </Badge>
              {q.data?.licensed_calendly_updated_at && (
                <span className="p-muted">
                  Updated {new Date(q.data.licensed_calendly_updated_at).toLocaleString()}
                </span>
              )}
              {url && isValid && (
                <>
                  <a href={url} target="_blank" rel="noreferrer noopener" style={{ color: "var(--p-gold)" }} className="hover:underline">
                    Test link →
                  </a>
                  <button onClick={() => setPreview((v) => !v)} style={{ color: "var(--p-gold)" }} className="hover:underline">
                    {preview ? "Hide preview" : "Preview embed"}
                  </button>
                </>
              )}
            </div>
            {!isValid && url !== "" && (
              <p className="mt-3 text-[13px]" style={{ color: "var(--p-red)" }}>
                Must be a valid https://calendly.com/... URL.
              </p>
            )}
            {preview && url && isValid && <CalendlyInline url={url} height={640} />}
          </>
        )}
      </Panel>
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
    <Panel title="Team recruiting links" description="Referral links for active agents on your team.">
      <div className="divide-y" style={{ borderColor: "var(--p-border)" }}>
        {agents.map((a) => {
          const link = a.recruiting_slug && origin ? `${origin}/?ref=${a.recruiting_slug}` : "";
          return (
            <div key={a.id} className="flex items-center justify-between gap-3 py-3" style={{ borderColor: "var(--p-border)" }}>
              <div className="min-w-0">
                <div className="truncate p-body">{a.full_name || "Unnamed agent"}</div>
                <div className="truncate p-muted">{link || "No link"}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => copy(a.id, link)} disabled={!link}>
                {copiedId === a.id ? "Copied!" : "Copy"}
              </Button>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
