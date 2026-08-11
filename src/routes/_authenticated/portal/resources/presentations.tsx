import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/vantage/portal-shell";
import { listPresentersWithRecordings } from "@/lib/resources.functions";
import { PlayerModal, type Presenter, type Recording } from "@/components/vantage/resources/player";
import { formatDisplayDate } from "@/components/vantage/resources/shared";
import { PageHeader, PageBody, Button, Avatar, EmptyState, TableWrap, Table, THead, TH, TR, TD, Badge } from "@/components/portal/ui";

export const Route = createFileRoute("/_authenticated/portal/resources/presentations")({
  head: () => ({ meta: [{ title: "Recorded Trainings — Vantage Portal" }, { name: "robots", content: "noindex" }] }),
  component: PresentationsPage,
});

function PresentationsPage() {
  const fn = useServerFn(listPresentersWithRecordings);
  const q = useQuery({ queryKey: ["presentations"], queryFn: () => fn() });
  const presenters = (q.data?.presenters ?? []) as Presenter[];
  const recordings = (q.data?.recordings ?? []) as Recording[];

  const [sel, setSel] = useState<string | null>(null);
  const activeId = sel ?? presenters[0]?.id ?? null;
  const [active, setActive] = useState<Recording | null>(null);

  const list = useMemo(
    () => recordings.filter((r) => r.presenter_id === activeId),
    [recordings, activeId],
  );
  const activePresenter = presenters.find((p) => p.id === activeId) ?? null;

  return (
    <PortalShell>
      <PageBody>
        <PageHeader
          title="Recorded Trainings"
          description="Pick a presenter to browse their recorded calls and trainings."
          actions={
            <Link to="/portal/resources">
              <Button variant="secondary" size="sm">← Hub</Button>
            </Link>
          }
        />

        {q.isLoading ? (
          <div className="p-secondary py-16 text-center">Loading…</div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {presenters.map((p) => {
                const on = p.id === activeId;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSel(p.id)}
                    className="p-focus flex min-w-[120px] flex-col items-center gap-1.5 rounded-[10px] border px-3.5 py-2.5 transition"
                    style={
                      on
                        ? { borderColor: "var(--p-gold-line)", background: "var(--p-gold-soft)" }
                        : { borderColor: "var(--p-border)" }
                    }
                  >
                    <Avatar name={p.name} size={36} />
                    <span className="p-card-title text-[13px]">{p.name}</span>
                    {p.role && <span className="p-muted">{p.role}</span>}
                  </button>
                );
              })}
            </div>

            <div className="mb-2 flex items-baseline justify-between">
              <span className="p-section-title">{activePresenter?.name}</span>
              <span className="p-muted">
                {list.length} recording{list.length === 1 ? "" : "s"}
              </span>
            </div>

            {list.length === 0 ? (
              <EmptyState
                title="No recordings yet"
                description={`${activePresenter?.name ?? "This presenter"}'s recordings will appear here once they're added.`}
              />
            ) : (
              <TableWrap>
                <Table>
                  <THead>
                    <TH>Title</TH>
                    <TH>Topic</TH>
                    <TH>Recorded</TH>
                    <TH>Type</TH>
                    <TH align="right">Duration</TH>
                  </THead>
                  <tbody>
                    {list.map((r) => (
                      <TR key={r.id} onClick={() => setActive(r)}>
                        <TD className="p-card-title">{r.title}</TD>
                        <TD className="p-secondary">{r.topic ?? "—"}</TD>
                        <TD className="p-muted">{formatDisplayDate(r.recorded_on)}</TD>
                        <TD>
                          {r.video_url ? (
                            <Badge tone="gold">{r.audio ? "♪ Audio" : "▶ Video"}</Badge>
                          ) : (
                            <span className="p-muted">—</span>
                          )}
                        </TD>
                        <TD align="right" className="p-muted font-mono tabular-nums">{r.duration ?? ""}</TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </>
        )}

        {active && (
          <PlayerModal
            rec={active}
            presenter={presenters.find((p) => p.id === active.presenter_id) ?? null}
            onClose={() => setActive(null)}
          />
        )}
      </PageBody>
    </PortalShell>
  );
}
