import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { PortalShell, PortalHeader } from "@/components/apex/portal-shell";
import { getMySchedulingSettings, updateMySchedulingSettings } from "@/lib/portal.functions";
import { CalendlyInline } from "@/components/apex/calendly-inline";

export const Route = createFileRoute("/_authenticated/portal/settings")({
  head: () => ({ meta: [{ title: "My Settings — APEX Portal" }, { name: "robots", content: "noindex" }] }),
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
      <PortalHeader kicker="Portal" title="My scheduling" />
      <div className="px-6 py-8 md:px-10">
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
