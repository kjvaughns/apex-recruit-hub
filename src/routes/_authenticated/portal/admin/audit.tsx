import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/vantage/portal-shell";
import { getAuditLogs } from "@/lib/portal.functions";
import { PageHeader, PageBody, Select, TableWrap, Table, THead, TH, TR, TD, Badge, EmptyState, ErrorState, TableSkeleton, Toolbar } from "@/components/portal/ui";

export const Route = createFileRoute("/_authenticated/portal/admin/audit")({
  head: () => ({
    meta: [{ title: "Audit Log — Vantage Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: AuditPage,
});

const ACTIONS = [
  "",
  "role_granted",
  "role_revoked",
  "user_invited",
  "applicant_promoted",
  "manual_applicant_created",
  "resource_published",
  "resource_saved",
];

function labelize(a: string) {
  return a.replace(/_/g, " ");
}

function AuditPage() {
  const fn = useServerFn(getAuditLogs);
  const [action, setAction] = useState("");
  const q = useQuery({ queryKey: ["audit", action], queryFn: () => fn({ data: { action } }) });
  const logs = q.data?.logs ?? [];

  if (q.isLoading) {
    return (
      <PortalShell>
        <PageBody>
          <PageHeader title="Audit log" description="System activity across the portal." />
          <TableSkeleton rows={8} cols={3} />
        </PageBody>
      </PortalShell>
    );
  }

  if (q.isError) {
    return (
      <PortalShell>
        <PageBody>
          <PageHeader title="Audit log" description="System activity across the portal." />
          <TableWrap>
            <ErrorState description="We couldn't load the audit log." onRetry={() => q.refetch()} />
          </TableWrap>
        </PageBody>
      </PortalShell>
    );
  }

  return (
    <PortalShell>
      <PageBody>
        <PageHeader title="Audit log" description="System activity across the portal." />
        <Toolbar className="mb-4">
          <Select value={action} onChange={(e) => setAction(e.target.value)} className="h-9 w-auto text-[12.5px]">
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a === "" ? "All actions" : labelize(a)}
              </option>
            ))}
          </Select>
        </Toolbar>
        <TableWrap>
          <Table>
            <THead>
              <TH>Action</TH>
              <TH>Detail</TH>
              <TH>When</TH>
            </THead>
            <tbody>
              {logs.length === 0 ? (
                <TR>
                  <TD colSpan={3}>
                    <EmptyState title="No audit entries" description="Activity like role changes and applicant updates will show up here." />
                  </TD>
                </TR>
              ) : (
                logs.map((l: any) => (
                  <TR key={l.id}>
                    <TD>
                      <Badge tone="gold">{labelize(l.action)}</Badge>
                    </TD>
                    <TD className="p-secondary">
                      {l.new_value ? JSON.stringify(l.new_value) : "—"}
                    </TD>
                    <TD className="p-muted">{new Date(l.created_at).toLocaleString()}</TD>
                  </TR>
                ))
              )}
            </tbody>
          </Table>
        </TableWrap>
      </PageBody>
    </PortalShell>
  );
}
