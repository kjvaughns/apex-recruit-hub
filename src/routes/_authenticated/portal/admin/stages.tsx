import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/apex/portal-shell";
import { adminListStages, adminUpsertStage } from "@/lib/portal.functions";
import { useState } from "react";
import {
  PageHeader, PageBody, Panel, TableWrap, Table, THead, TH, TR, TD,
  Input, Field, Button,
} from "@/components/portal/ui";

export const Route = createFileRoute("/_authenticated/portal/admin/stages")({
  head: () => ({ meta: [{ title: "Pipeline Stages — Vantage Admin" }, { name: "robots", content: "noindex" }] }),
  component: StagesPage,
});

function StagesPage() {
  const listFn = useServerFn(adminListStages);
  const upsertFn = useServerFn(adminUpsertStage);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin", "stages"], queryFn: () => listFn() });
  const upsert = useMutation({
    mutationFn: (v: any) => upsertFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "stages"] }),
  });

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [color, setColor] = useState("#C9A84C");

  const stages = data?.stages ?? [];

  return (
    <PortalShell>
      <PageBody>
        <PageHeader title="Pipeline stages" description="Configure the recruiting pipeline stages, colors, and order." />
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <TableWrap>
            {isLoading ? (
              <div className="p-secondary p-6 text-center">Loading…</div>
            ) : (
              <Table>
                <THead>
                  <TH>Order</TH>
                  <TH>Name</TH>
                  <TH>Slug</TH>
                  <TH>Color</TH>
                  <TH align="right">Archived</TH>
                </THead>
                <tbody>
                  {stages.map((s: any) => (
                    <TR key={s.id}>
                      <TD>
                        <Input
                          type="number"
                          defaultValue={s.position}
                          onBlur={(e) => {
                            const p = Number(e.target.value);
                            if (p !== s.position) upsert.mutate({ ...s, position: p });
                          }}
                          className="h-8 w-16 text-[13px]"
                        />
                      </TD>
                      <TD className="p-card-title">{s.name}</TD>
                      <TD className="p-secondary">{s.slug}</TD>
                      <TD>
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-4 w-4 rounded" style={{ background: s.color || "var(--p-border)" }} />
                          <span className="p-muted">{s.color || "—"}</span>
                        </div>
                      </TD>
                      <TD align="right">
                        <button
                          onClick={() => upsert.mutate({ ...s, is_archived: !s.is_archived })}
                          className="p-focus text-[13px] font-semibold"
                          style={{ color: "var(--p-gold)" }}
                        >
                          {s.is_archived ? "Restore" : "Archive"}
                        </button>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            )}
          </TableWrap>

          <Panel title="Add a stage" description="New stage" padded>
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!name || !slug) return;
                const pos = stages.length ? Math.max(...stages.map((s: any) => s.position)) + 1 : 1;
                upsert.mutate({ name, slug, color, position: pos });
                setName(""); setSlug("");
              }}
            >
              <Field label="Name">
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
              <Field label="Slug">
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  required
                />
              </Field>
              <Field label="Color">
                <input
                  type="color"
                  className="h-10 w-24 rounded-[10px] border"
                  style={{ borderColor: "var(--p-border)", background: "transparent" }}
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </Field>
              <Button type="submit" variant="primary" disabled={upsert.isPending} className="w-full">
                {upsert.isPending ? "Saving…" : "Add stage"}
              </Button>
            </form>
          </Panel>
        </div>
      </PageBody>
    </PortalShell>
  );
}
