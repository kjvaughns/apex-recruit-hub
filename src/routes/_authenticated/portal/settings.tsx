import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { PortalShell, PortalHeader } from "@/components/apex/portal-shell";
import {
  getMySchedulingSettings,
  updateMySchedulingSettings,
  getTeamRecruitingLinks,
} from "@/lib/portal.functions";
import { CalendlyInline } from "@/components/apex/calendly-inline";
import { RecruitingLinkCard } from "@/components/apex/recruiting-link-card";

export const Route = createFileRoute("/_authenticated/portal/settings")({
  head: () => ({ meta: [{ title: "My Settings — Vantage Portal" }, { name: "robots", content: "noindex" }] }),
  component: PortalSettingsPage,
});

const CALENDLY_RE = /^https:\/\/calendly\.com\/[A-Za-z0-9\-_/?&=.%#]+$/;

function PortalSettingsPage() {
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
  useEffect(() => { if (q.data) setUrl(q.data.licensed_calendly_url ?? ""); }, [q.data]);

  const isValid = url === "" || CALENDLY_RE.test(url);
  const status = !q.data
    ? "…"
    : url === ""
    ? "Not set"
    : !isValid
    ? "Invalid"
    : "Set";
  const canEdit = q.data?.can_edit ?? false;

  return (
    <PortalShell>
      <PortalHeader kicker="Portal" title="My settings" />
      <div className="space-y-6 px-6 py-8 md:px-10">
        <RecruitingLinkCard />
        <TeamRecruitingLinksCard />
        <div className="apx-card max-w-2xl p-6 md:p-8">
          {q.isLoading ? (
            <div className="text-apex-dim">Loading…</div>
          ) : !canEdit ? (
            <p className="text-apex-muted">
              Your account isn't permitted to schedule licensed applicants. Ask an administrator to enable this for you.
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
                <span className="rounded-full border border-white/10 px-2.5 py-1 text-apex-fog">Status: {status}</span>
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
    </PortalShell>
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
    <div className="apx-card max-w-2xl p-6 md:p-8">
      <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-apex-faint">Team</div>
      <h2 className="font-display text-[26px] leading-none">Team recruiting links</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-apex-muted">Referral links for active agents on your team.</p>
      <div className="mt-5 divide-y divide-white/5">
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
