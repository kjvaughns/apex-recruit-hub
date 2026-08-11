import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/vantage/portal-shell";
import { adminGetSettings, adminSetSetting } from "@/lib/portal.functions";
import { useState, useEffect } from "react";
import { PageHeader, PageBody, Panel, Field, Input, Button, Stack } from "@/components/portal/ui";

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
      <PageBody>
        <PageHeader title="System settings" description="Global platform configuration and defaults." />
        <Panel padded>
          {isLoading ? (
            <div className="p-secondary">Loading…</div>
          ) : (
            <Stack className="space-y-4">
              {KEYS.map((k) => (
                <Field key={k.key} label={k.label}>
                  <div className="flex gap-2">
                    <Input
                      placeholder={k.placeholder}
                      value={vals[k.key] ?? ""}
                      onChange={(e) => setVals({ ...vals, [k.key]: e.target.value })}
                    />
                    <Button
                      variant="primary"
                      onClick={() => save.mutate({ key: k.key, value: vals[k.key] ?? "" })}
                      disabled={save.isPending}
                    >
                      Save
                    </Button>
                  </div>
                </Field>
              ))}
            </Stack>
          )}
        </Panel>
      </PageBody>
    </PortalShell>
  );
}
