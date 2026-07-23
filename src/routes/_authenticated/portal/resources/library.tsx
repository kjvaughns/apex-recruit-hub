import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/apex/portal-shell";
import { listLibrary } from "@/lib/resources.functions";
import { LibraryView, type LibraryItem } from "@/components/apex/resources/library";

export const Route = createFileRoute("/_authenticated/portal/resources/library")({
  head: () => ({ meta: [{ title: "Resource Library — APEX Portal" }, { name: "robots", content: "noindex" }] }),
  component: LibraryPage,
});

function LibraryPage() {
  const fn = useServerFn(listLibrary);
  const q = useQuery({ queryKey: ["library"], queryFn: () => fn() });
  const items = (q.data?.resources ?? []) as LibraryItem[];

  return (
    <PortalShell>
      <div className="mx-auto max-w-[1240px] px-6 pb-20 md:px-8">
        <div className="flex items-center gap-4 pt-6">
          <Link
            to="/portal/resources"
            className="rounded-lg border border-white/[0.09] px-3 py-1.5 text-[13px] font-semibold text-apex-dim transition hover:border-apex-gold hover:text-apex-gold"
          >
            ← Hub
          </Link>
        </div>
        {q.isLoading ? (
          <div className="py-24 text-center text-apex-dim">Loading library…</div>
        ) : (
          <LibraryView items={items} />
        )}
      </div>
    </PortalShell>
  );
}
