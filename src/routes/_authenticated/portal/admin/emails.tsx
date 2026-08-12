import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { PortalShell } from "@/components/vantage/portal-shell";
import {
  Badge,
  Button,
  Field,
  Input,
  ListSkeleton,
  PageBody,
  PageHeader,
  Panel,
  SearchField,
  SectionNav,
  Stack,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableWrap,
  Textarea,
  Toggle,
  Toolbar,
  EmptyState,
  ErrorState,
  notify,
} from "@/components/portal/ui";
import {
  listEmailCampaigns,
  listEmailHistory,
  listEmailTemplates,
  previewEmailTemplate,
  resetEmailTemplate,
  saveEmailCampaign,
  saveEmailTemplate,
} from "@/lib/email.functions";

export const Route = createFileRoute("/_authenticated/portal/admin/emails")({
  head: () => ({
    meta: [
      { title: "Email System — Vantage Admin" },
      {
        name: "description",
        content:
          "Manage every Vantage Financial email: template copy, recurring campaigns, and delivery history.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EmailAdminPage,
});

type Tab = "templates" | "campaigns" | "history";

const CATEGORY_LABEL: Record<string, string> = {
  security: "Security",
  account: "Account",
  recruiting: "Recruiting",
  follow_up: "Follow up",
  onboarding: "Onboarding",
  training: "Training",
  meeting: "Meetings",
  announcement: "Announcements",
  campaign: "Campaigns",
};

function statusTone(status: string) {
  if (status === "sent" || status === "delivered") return "green" as const;
  if (status === "failed" || status === "bounced" || status === "complained") return "red" as const;
  if (status === "skipped" || status === "suppressed") return "amber" as const;
  return "neutral" as const;
}

function EmailAdminPage() {
  const [tab, setTab] = useState<Tab>("templates");

  return (
    <PortalShell>
      <PageHeader
        title="Email system"
        subtitle="Every automated and manual email the platform sends, in one place."
      />
      <PageBody>
        <SectionNav
          value={tab}
          onChange={setTab}
          items={[
            { value: "templates", label: "Templates" },
            { value: "campaigns", label: "Campaigns" },
            { value: "history", label: "History" },
          ]}
        />
        {tab === "templates" ? <TemplatesTab /> : null}
        {tab === "campaigns" ? <CampaignsTab /> : null}
        {tab === "history" ? <HistoryTab /> : null}
      </PageBody>
    </PortalShell>
  );
}

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

function TemplatesTab() {
  const listFn = useServerFn(listEmailTemplates);
  const saveFn = useServerFn(saveEmailTemplate);
  const resetFn = useServerFn(resetEmailTemplate);
  const previewFn = useServerFn(previewEmailTemplate);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["admin", "email-templates"], queryFn: () => listFn() });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const templates = q.data?.templates ?? [];
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return templates;
    return templates.filter(
      (t: any) =>
        t.label.toLowerCase().includes(needle) ||
        t.name.includes(needle) ||
        t.trigger.toLowerCase().includes(needle),
    );
  }, [templates, search]);

  const active = templates.find((t: any) => t.name === selected) ?? null;

  function openTemplate(t: any) {
    setSelected(t.name);
    setPreviewHtml(null);
    const o = t.override?.body_override ?? {};
    setDraft({
      subject: t.override?.subject_override ?? "",
      title: o.title ?? "",
      intro: o.intro ?? "",
      body: o.body ?? "",
      note: o.note ?? "",
      cta_label: o.cta_label ?? "",
      cta_url: o.cta_url ?? "",
    });
  }

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          template_name: selected!,
          subject_override: draft["subject"] ?? "",
          body_override: {
            title: draft["title"] ?? "",
            intro: draft["intro"] ?? "",
            body: draft["body"] ?? "",
            note: draft["note"] ?? "",
            cta_label: draft["cta_label"] ?? "",
            cta_url: draft["cta_url"] ?? "",
          },
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "email-templates"] });
      notify.success("Template copy saved.");
    },
    onError: () => notify.error("Could not save that template."),
  });

  const reset = useMutation({
    mutationFn: () => resetFn({ data: { template_name: selected! } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "email-templates"] });
      notify.success("Reverted to the default copy.");
      setDraft({ subject: "", title: "", intro: "", body: "", note: "", cta_label: "", cta_url: "" });
    },
  });

  const preview = useMutation({
    mutationFn: () => previewFn({ data: { template_name: selected! } }),
    onSuccess: (r: any) => setPreviewHtml(r.html),
    onError: () => notify.error("Could not render that preview."),
  });

  if (q.isLoading) return <ListSkeleton rows={8} />;
  if (q.error) return <ErrorState title="Could not load the email templates." />;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      <Panel title="Templates" subtitle={`${templates.length} emails`}>
        <Stack>
          <SearchField value={search} onChange={setSearch} placeholder="Search templates…" />
          <div className="max-h-[560px] overflow-y-auto">
            {filtered.map((t: any) => (
              <button
                key={t.name}
                type="button"
                onClick={() => openTemplate(t)}
                className={`flex w-full flex-col gap-1 border-b border-white/5 px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-white/5 ${
                  selected === t.name ? "bg-white/[0.07]" : ""
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {t.label}
                  {t.override ? <Badge tone="gold">Edited</Badge> : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  {CATEGORY_LABEL[t.category] ?? t.category} · {t.audience}
                </span>
              </button>
            ))}
            {!filtered.length ? <EmptyState title="No templates match that search." /> : null}
          </div>
        </Stack>
      </Panel>

      {active ? (
        <Panel title={active.label} subtitle={active.trigger}>
          <Stack>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge tone="neutral">{CATEGORY_LABEL[active.category] ?? active.category}</Badge>
              <Badge tone="neutral">{active.audience}</Badge>
              {active.prefKey ? <Badge tone="amber">Optional — respects preferences</Badge> : (
                <Badge tone="green">Always delivered</Badge>
              )}
              {active.manualOnly ? <Badge tone="blue">Manual only</Badge> : null}
            </div>

            <Field label="Subject" hint={`Default: ${active.defaults.subject}`}>
              <Input
                value={draft["subject"] ?? ""}
                placeholder={active.defaults.subject}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              />
            </Field>
            <Field label="Heading" hint={`Default: ${active.defaults.title}`}>
              <Input
                value={draft["title"] ?? ""}
                placeholder={active.defaults.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </Field>
            <Field label="Greeting line">
              <Input
                value={draft["intro"] ?? ""}
                placeholder={active.defaults.intro}
                onChange={(e) => setDraft({ ...draft, intro: e.target.value })}
              />
            </Field>
            <Field label="Body" hint="One paragraph per line. Leave blank to use the default copy.">
              <Textarea
                rows={7}
                value={draft["body"] ?? ""}
                placeholder={active.defaults.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Button label">
                <Input
                  value={draft["cta_label"] ?? ""}
                  placeholder={active.defaults.cta_label || "None"}
                  onChange={(e) => setDraft({ ...draft, cta_label: e.target.value })}
                />
              </Field>
              <Field label="Button link">
                <Input
                  value={draft["cta_url"] ?? ""}
                  placeholder={active.defaults.cta_url || "None"}
                  onChange={(e) => setDraft({ ...draft, cta_url: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Footnote">
              <Input
                value={draft["note"] ?? ""}
                placeholder={active.defaults.note || "None"}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              />
            </Field>

            <div className="rounded-lg border border-white/8 bg-white/[0.02] p-3 text-xs text-muted-foreground">
              Available variables — wrap in double braces:{" "}
              <span className="text-foreground">{(q.data?.vars ?? []).join(", ")}</span>
            </div>

            <Toolbar>
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                Save copy
              </Button>
              <Button variant="secondary" onClick={() => preview.mutate()} disabled={preview.isPending}>
                Preview
              </Button>
              {active.override ? (
                <Button variant="ghost" onClick={() => reset.mutate()} disabled={reset.isPending}>
                  Revert to default
                </Button>
              ) : null}
            </Toolbar>

            {previewHtml ? (
              <iframe
                title="Email preview"
                srcDoc={previewHtml}
                className="h-[620px] w-full rounded-xl border border-white/10 bg-white"
              />
            ) : null}
          </Stack>
        </Panel>
      ) : (
        <Panel title="Pick a template">
          <EmptyState
            title="Select a template to edit"
            description="Every email uses the same Vantage layout — you're editing the copy inside it."
          />
        </Panel>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Campaigns                                                           */
/* ------------------------------------------------------------------ */

const CAMPAIGN_FIELDS: Record<string, Array<{ key: string; label: string; long?: boolean }>> = {
  "daily-production-focus": [
    { key: "target", label: "Daily target" },
    { key: "dialHours", label: "Dial hours" },
    { key: "mindset", label: "Mindset line", long: true },
    { key: "focus", label: "Today's focus", long: true },
  ],
  "weekly-game-plan": [
    { key: "meetingTime", label: "Team meeting" },
    { key: "trainingTime", label: "Agency training" },
    { key: "filmReview", label: "Film review" },
    { key: "dialExpectation", label: "Dial expectation" },
    { key: "message", label: "Note to the team", long: true },
  ],
  "weekly-sales-tip": [
    { key: "title", label: "Tip title" },
    { key: "body", label: "Tip body", long: true },
  ],
  "academy-new-content": [{ key: "message", label: "What's new", long: true }],
  "leadership-development": [{ key: "message", label: "Leadership note", long: true }],
};

function CampaignsTab() {
  const listFn = useServerFn(listEmailCampaigns);
  const saveFn = useServerFn(saveEmailCampaign);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "email-campaigns"], queryFn: () => listFn() });
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});

  const save = useMutation({
    mutationFn: (v: { slug: string; enabled?: boolean; content?: Record<string, string> }) =>
      saveFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "email-campaigns"] });
      notify.success("Campaign updated.");
    },
    onError: () => notify.error("Could not update that campaign."),
  });

  if (q.isLoading) return <ListSkeleton rows={5} />;
  if (q.error) return <ErrorState title="Could not load campaigns." />;

  return (
    <Stack>
      {(q.data ?? []).map((c: any) => {
        const fields = CAMPAIGN_FIELDS[c.slug] ?? [];
        const draft = drafts[c.slug] ?? (c.content ?? {});
        return (
          <Panel key={c.slug} title={c.name} subtitle={c.schedule_label}>
            <Stack>
              <div className="flex flex-wrap items-center gap-3">
                <Toggle
                  checked={!!c.enabled}
                  onChange={(v) => save.mutate({ slug: c.slug, enabled: v })}
                  label={c.enabled ? "Sending" : "Paused"}
                />
                <Badge tone="neutral">{c.cadence}</Badge>
                <Badge tone="neutral">{c.audience.replace("_", " ")}</Badge>
                {c.last_sent_at ? (
                  <span className="text-xs text-muted-foreground">
                    Last run {new Date(c.last_sent_at).toLocaleString()}
                  </span>
                ) : null}
              </div>
              {fields.length ? (
                <>
                  {fields.map((f) =>
                    f.long ? (
                      <Field key={f.key} label={f.label}>
                        <Textarea
                          rows={3}
                          value={draft[f.key] ?? ""}
                          onChange={(e) =>
                            setDrafts({
                              ...drafts,
                              [c.slug]: { ...draft, [f.key]: e.target.value },
                            })
                          }
                        />
                      </Field>
                    ) : (
                      <Field key={f.key} label={f.label}>
                        <Input
                          value={draft[f.key] ?? ""}
                          onChange={(e) =>
                            setDrafts({
                              ...drafts,
                              [c.slug]: { ...draft, [f.key]: e.target.value },
                            })
                          }
                        />
                      </Field>
                    ),
                  )}
                  <Toolbar>
                    <Button
                      onClick={() => save.mutate({ slug: c.slug, content: draft })}
                      disabled={save.isPending}
                    >
                      Save content
                    </Button>
                  </Toolbar>
                </>
              ) : null}
            </Stack>
          </Panel>
        );
      })}
    </Stack>
  );
}

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

function HistoryTab() {
  const listFn = useServerFn(listEmailHistory);
  const q = useQuery({
    queryKey: ["admin", "email-history"],
    queryFn: () => listFn({ data: { limit: 100 } }),
  });

  if (q.isLoading) return <ListSkeleton rows={8} />;
  if (q.error) return <ErrorState title="Could not load email history." />;
  const rows = q.data ?? [];
  if (!rows.length) return <EmptyState title="No emails have gone out yet." />;

  return (
    <Panel title="Recent emails" subtitle="Newest first">
      <TableWrap>
        <Table>
          <THead>
            <TH>Sent</TH>
            <TH>To</TH>
            <TH>Subject</TH>
            <TH>Template</TH>
            <TH>Status</TH>
          </THead>
          <tbody>
            {rows.map((r: any) => (
              <TR key={r.id}>
                <TD className="whitespace-nowrap text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </TD>
                <TD>{r.to_name || r.to_email}</TD>
                <TD className="max-w-[280px] truncate">{r.subject}</TD>
                <TD className="text-xs text-muted-foreground">
                  {r.template_name || r.template_key}
                  {r.automated === false ? " · manual" : ""}
                </TD>
                <TD>
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                  {r.error ? (
                    <div className="mt-1 max-w-[220px] truncate text-xs text-muted-foreground">
                      {r.error}
                    </div>
                  ) : null}
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </TableWrap>
    </Panel>
  );
}
