import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/vantage/portal-shell";
import { adminGetSettings, adminSetSetting, adminTestDiscordWebhook } from "@/lib/portal.functions";
import { useState, useEffect } from "react";
import { PageHeader, PageBody, Panel, Field, Input, Button, Stack, TextSkeleton, ErrorState, notify } from "@/components/portal/ui";

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

const DISCORD_KEY = "discord_recruiting_webhook_url";

function SettingsPage() {
  const getFn = useServerFn(adminGetSettings);
  const setFn = useServerFn(adminSetSetting);
  const testFn = useServerFn(adminTestDiscordWebhook);
  const qc = useQueryClient();
  const settingsQ = useQuery({ queryKey: ["admin", "settings"], queryFn: () => getFn() });
  const { data, isLoading } = settingsQ;
  const save = useMutation({
    mutationFn: (v: { key: string; value: any }) => setFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
      notify.success("Setting saved.");
    },
    onError: () => notify.error("Could not save that setting.", "Please try again."),
  });
  const [testResult, setTestResult] = useState<string | null>(null);
  const test = useMutation({
    mutationFn: () => testFn(),
    onSuccess: (r: { ok: boolean; message: string }) => setTestResult(r.message),
    onError: (e: unknown) => setTestResult(e instanceof Error ? e.message : "Test failed."),
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

  const webhook = vals[DISCORD_KEY] ?? "";
  const webhookValid = /^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\//.test(
    webhook.trim(),
  );

  return (
    <PortalShell>
      <PageBody>
        <PageHeader title="System settings" description="Global platform configuration and defaults." />
        <Panel title="Recruiting links" description="Default scheduling links used across the recruiting flow." padded>
          {isLoading ? (
            <TextSkeleton lines={6} />
          ) : settingsQ.isError ? (
            <ErrorState description="We couldn't load system settings." onRetry={() => settingsQ.refetch()} />
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
                      loading={save.isPending}
                      onClick={() => save.mutate({ key: k.key, value: vals[k.key] ?? "" })}
                    >
                      Save
                    </Button>
                  </div>
                </Field>
              ))}
            </Stack>
          )}
        </Panel>

        <Panel padded>
          <PageHeader
            title="Discord recruiting bot"
            description="Paste a Discord channel webhook URL and every new applicant posts a card with their name, who recruited them, license status, and the date they scheduled."
          />
          <Stack className="space-y-4">
            <Field
              label="Discord webhook URL"
              hint="In Discord: Channel settings → Integrations → Webhooks → New Webhook → Copy Webhook URL. Leave blank to turn the bot off."
            >
              <div className="flex gap-2">
                <Input
                  placeholder="https://discord.com/api/webhooks/…"
                  value={webhook}
                  onChange={(e) => {
                    setTestResult(null);
                    setVals({ ...vals, [DISCORD_KEY]: e.target.value });
                  }}
                />
                <Button
                  variant="primary"
                  loading={save.isPending}
                  onClick={() => save.mutate({ key: DISCORD_KEY, value: webhook.trim() })}
                >
                  Save
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setTestResult(null);
                    test.mutate();
                  }}
                  disabled={test.isPending}
                >
                  {test.isPending ? "Sending…" : "Send test card"}
                </Button>
              </div>
            </Field>
            {webhook.trim() && !webhookValid ? (
              <div className="p-secondary text-[13px]">
                That doesn&apos;t look like a Discord webhook URL — it should start with
                https://discord.com/api/webhooks/
              </div>
            ) : null}
            {testResult ? <div className="p-secondary text-[13px]">{testResult}</div> : null}
          </Stack>
        </Panel>
      </PageBody>
    </PortalShell>
  );
}

