import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell, PortalHeader } from "@/components/apex/portal-shell";
import { getAuditLogs } from "@/lib/portal.functions";

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

  return (
    <PortalShell>
      <PortalHeader
        kicker="Admin"
        title="Audit log"
        actions={
          <select
            className="apx-input h-9 text-[12.5px]"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a === "" ? "All actions" : labelize(a)}
              </option>
            ))}
          </select>
        }
      />
      <div className="px-6 py-8 md:px-10">
        <div className="apx-card overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13.5px]">
            <thead className="bg-white/[0.02] text-[11px] uppercase tracking-[0.12em] text-apex-faint">
              <tr>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Detail</th>
                <th className="px-5 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading ? (
                <tr>
                  <td colSpan={3} className="px-5 py-10 text-center text-apex-dim">
                    Loading…
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-10 text-center text-apex-dim">
                    No audit entries.
                  </td>
                </tr>
              ) : (
                logs.map((l: any) => (
                  <tr key={l.id} className="border-t border-white/[0.05]">
                    <td className="px-5 py-3">
                      <span className="rounded-full border border-apex-gold/30 bg-apex-gold/5 px-2.5 py-1 text-[11.5px] capitalize text-apex-gold">
                        {labelize(l.action)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-apex-dim">
                      {l.new_value ? JSON.stringify(l.new_value) : "—"}
                    </td>
                    <td className="px-5 py-3 text-apex-faint">
                      {new Date(l.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PortalShell>
  );
}
