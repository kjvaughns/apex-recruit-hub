import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell, PortalHeader } from "@/components/apex/portal-shell";
import { adminGetSettings, adminSetSetting } from "@/lib/portal.functions";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/_authenticated/portal/admin/settings")({
  head: () => ({ meta: [{ title: "System Settings — Vantage Admin" }, { name: "robots", content: "noindex" }] }),
  component: SettingsPage,
});

const KEYS = [
  { key: "unlicensed_overview_calendly_url", label: "Unlicensed overview Calendly URL", placeholder: "https://calendly.com/…" },
  { key: "licensed_fallback_calendly_url", label: "Licensed applicant fallback Calendly URL", placeholder: "https://calendly.com/…" },
  { key: "allow_recruiter_licensed_priority", label: "Allow recruiter licensed Calendly priority (true/false)" },
  { key: "allow_manager_licensed_priority", label: "Allow manager licensed Calendly priority (true/false)" },
  { key: "brand_tagline", label: "Brand tagline" },
  { key: "support_email", label: "Support email" },
];


function SettingsPage() {
  const getFn = useServerFn(adminGetSettings);
  const setFn = useServerFn(adminSetSetting);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin", "settings"], queryFn: () => getFn() });
  const save = useMutation({
    mutationFn: (v: { key: string; value: any }) => setFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "settings"] }),
  });

  const [vals, setVals] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!data) return;
    const map: Record<string, string> = {};
    for (const s of data.settings) {
      map[s.key] = typeof s.value === "string" ? s.value : JSON.stringify(s.value ?? "");
    }
    setVals(map);
  }, [data]);

  return (
    <PortalShell>
      <PortalHeader kicker="Admin" title="System settings" />
      <div className="px-6 py-8 md:px-10">
        <div className="apx-card max-w-2xl p-6 md:p-8">
          {isLoading ? (
            <div className="text-apex-dim">Loading…</div>
          ) : (
            <div className="flex flex-col gap-5">
              {KEYS.map((k) => (
                <div key={k.key}>
                  <label className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.06em] text-apex-faint">{k.label}</label>
                  <div className="flex gap-2">
                    <input
                      className="apx-input flex-1"
                      placeholder={k.placeholder}
                      value={vals[k.key] ?? ""}
                      onChange={(e) => setVals({ ...vals, [k.key]: e.target.value })}
                    />
                    <button
                      onClick={() => save.mutate({ key: k.key, value: vals[k.key] ?? "" })}
                      disabled={save.isPending}
                      className="apx-btn-primary px-5 disabled:opacity-60"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PortalShell>
  );
}
