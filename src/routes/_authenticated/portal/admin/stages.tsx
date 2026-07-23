import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell, PortalHeader } from "@/components/apex/portal-shell";
import { adminListStages, adminUpsertStage } from "@/lib/portal.functions";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/portal/admin/stages")({
  head: () => ({ meta: [{ title: "Pipeline Stages — APEX Admin" }, { name: "robots", content: "noindex" }] }),
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
      <PortalHeader kicker="Admin" title="Pipeline stages" />
      <div className="px-6 py-8 md:px-10 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="apx-card overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-apex-dim">Loading…</div>
          ) : (
            <table className="w-full text-left text-[14px]">
              <thead className="bg-white/[0.02] text-[11px] uppercase tracking-[0.12em] text-apex-faint">
                <tr><th className="px-5 py-3">Order</th><th className="px-5 py-3">Name</th><th className="px-5 py-3">Slug</th><th className="px-5 py-3">Color</th><th className="px-5 py-3">Archived</th></tr>
              </thead>
              <tbody>
                {stages.map((s: any) => (
                  <tr key={s.id} className="border-t border-white/[0.05]">
                    <td className="px-5 py-3">
                      <input
                        type="number"
                        defaultValue={s.position}
                        onBlur={(e) => {
                          const p = Number(e.target.value);
                          if (p !== s.position) upsert.mutate({ ...s, position: p });
                        }}
                        className="apx-input w-20"
                      />
                    </td>
                    <td className="px-5 py-3 font-medium text-apex-ivory">{s.name}</td>
                    <td className="px-5 py-3 text-apex-dim">{s.slug}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-5 w-5 rounded" style={{ background: s.color || "#666" }} />
                        <span className="text-apex-faint">{s.color || "—"}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => upsert.mutate({ ...s, is_archived: !s.is_archived })}
                        className="text-[13px] text-apex-gold hover:underline"
                      >
                        {s.is_archived ? "Restore" : "Archive"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <form
          className="apx-card p-6 h-fit"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name || !slug) return;
            const pos = stages.length ? Math.max(...stages.map((s: any) => s.position)) + 1 : 1;
            upsert.mutate({ name, slug, color, position: pos });
            setName(""); setSlug("");
          }}
        >
          <div className="apx-kicker mb-2">New stage</div>
          <h3 className="font-display text-[22px] mb-4">Add a stage</h3>
          <label className="mb-3 block">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.06em] text-apex-faint">Name</span>
            <input className="apx-input" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="mb-3 block">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.06em] text-apex-faint">Slug</span>
            <input className="apx-input" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} required />
          </label>
          <label className="mb-4 block">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.06em] text-apex-faint">Color</span>
            <input type="color" className="h-11 w-24 rounded-[10px] border border-white/10 bg-transparent" value={color} onChange={(e) => setColor(e.target.value)} />
          </label>
          <button disabled={upsert.isPending} className="apx-btn-primary w-full py-3 disabled:opacity-60">
            {upsert.isPending ? "Saving…" : "Add stage"}
          </button>
        </form>
      </div>
    </PortalShell>
  );
}
