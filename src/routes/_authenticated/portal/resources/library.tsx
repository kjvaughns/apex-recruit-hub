import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/apex/portal-shell";
import { listLibrary } from "@/lib/resources.functions";
import { LibraryView, type LibraryItem } from "@/components/apex/resources/library";
import { PageHeader, PageBody, Button } from "@/components/portal/ui";

export const Route = createFileRoute("/_authenticated/portal/resources/library")({
  head: () => ({ meta: [{ title: "Resource Library — Vantage Portal" }, { name: "robots", content: "noindex" }] }),
  component: LibraryPage,
});

function LibraryPage() {
  const fn = useServerFn(listLibrary);
  const q = useQuery({ queryKey: ["library"], queryFn: () => fn() });
  const items = (q.data?.resources ?? []) as LibraryItem[];

  return (
    <PortalShell>
      <PageBody>
        <PageHeader
          title="Resource Library"
          description="Scripts, guides & trainings."
          actions={
            <Link to="/portal/resources">
              <Button variant="secondary" size="sm">← Hub</Button>
            </Link>
          }
        />
        {q.isLoading ? (
          <div className="p-secondary py-16 text-center">Loading library…</div>
        ) : (
          <LibraryView items={items} />
        )}
      </PageBody>
    </PortalShell>
  );
}
