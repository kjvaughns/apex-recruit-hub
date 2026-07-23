import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell, PortalHeader } from "@/components/apex/portal-shell";
import { adminListUsers, adminSetUserRole, adminUpdateProfile } from "@/lib/portal.functions";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/portal/admin/users")({
  head: () => ({ meta: [{ title: "Users — APEX Admin" }, { name: "robots", content: "noindex" }] }),
  component: UsersPage,
});

const ROLES = ["agent", "manager", "admin", "super_admin"] as const;
type RoleName = typeof ROLES[number];

function UsersPage() {
  const list = useServerFn(adminListUsers);
  const setRole = useServerFn(adminSetUserRole);
  const updateProfile = useServerFn(adminUpdateProfile);
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["admin", "users"], queryFn: () => list() });

  const roleMut = useMutation({
    mutationFn: (v: { user_id: string; role: RoleName; grant: boolean }) => setRole({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
  const activeMut = useMutation({
    mutationFn: (v: { id: string; is_active: boolean }) => updateProfile({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  const users = (data?.users ?? []).filter((u: any) => {
    if (!q.trim()) return true;
    const n = `${u.first_name ?? ""} ${u.last_name ?? ""} ${u.email ?? ""}`.toLowerCase();
    return n.includes(q.toLowerCase());
  });

  return (
    <PortalShell>
      <PortalHeader kicker="Admin" title="Users & Roles" />
      <div className="px-6 py-8 md:px-10">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <input
            className="apx-input max-w-sm"
            placeholder="Search name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="ml-auto text-[13px] text-apex-faint">{users.length} user(s)</div>
        </div>

        {isLoading ? (
          <div className="apx-card p-10 text-center text-apex-dim">Loading…</div>
        ) : (
          <div className="apx-card overflow-hidden">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-white/[0.02] text-[11px] uppercase tracking-[0.12em] text-apex-faint">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Roles</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id} className="border-t border-white/[0.05]">
                    <td className="px-5 py-4 font-medium text-apex-ivory">
                      {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-5 py-4 text-apex-dim">{u.email}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {ROLES.map((r) => {
                          const on = u.roles.includes(r);
                          return (
                            <button
                              key={r}
                              disabled={roleMut.isPending}
                              onClick={() => roleMut.mutate({ user_id: u.id, role: r, grant: !on })}
                              className={`rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition ${
                                on
                                  ? "border-apex-gold/40 bg-apex-gold/10 text-apex-gold"
                                  : "border-white/10 text-apex-faint hover:border-white/25 hover:text-apex-ivory"
                              }`}
                            >
                              {r}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <label className="inline-flex items-center gap-2 text-[13px] text-apex-dim">
                        <input
                          type="checkbox"
                          checked={u.is_active !== false}
                          onChange={(e) => activeMut.mutate({ id: u.id, is_active: e.target.checked })}
                        />
                        {u.is_active !== false ? "Active" : "Inactive"}
                      </label>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-apex-dim">No users match.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PortalShell>
  );
}
