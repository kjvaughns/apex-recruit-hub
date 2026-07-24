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

// super_admin is a protected internal owner level and is never selectable here.
const ROLES = ["agent", "leader", "manager", "admin"] as const;
type RoleName = (typeof ROLES)[number];

function UsersPage() {
  const list = useServerFn(adminListUsers);
  const setRole = useServerFn(adminSetUserRole);
  const updateProfile = useServerFn(adminUpdateProfile);
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["admin", "users"], queryFn: () => list() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "users"] });

  const roleMut = useMutation({
    mutationFn: (v: { user_id: string; role: RoleName; grant: boolean }) => setRole({ data: v }),
    onSuccess: invalidate,
  });
  const profileMut = useMutation({
    mutationFn: (v: Record<string, unknown> & { id: string }) => updateProfile({ data: v }),
    onSuccess: invalidate,
    onError: (e: unknown) => alert((e as Error).message || "Update failed."),
  });

  const allUsers = data?.users ?? [];
  const users = allUsers.filter((u: any) => {
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
          <div className="apx-card overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-[14px]">
              <thead className="bg-white/[0.02] text-[11px] uppercase tracking-[0.12em] text-apex-faint">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Reports to</th>
                  <th className="px-5 py-3">Permissions</th>
                  <th className="px-5 py-3">Recruiting link</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id} className="border-t border-white/[0.05] align-top">
                    <td className="px-5 py-4">
                      <div className="font-medium text-apex-ivory">
                        {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                      </div>
                      <div className="text-[12px] text-apex-faint">{u.email}</div>
                      {u.roles.includes("super_admin") && (
                        <span className="mt-1 inline-block rounded-full border border-apex-gold/40 bg-apex-gold/10 px-2 py-0.5 text-[10.5px] font-semibold text-apex-gold">
                          Owner
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {ROLES.map((r) => {
                          const on = u.roles.includes(r);
                          return (
                            <button
                              key={r}
                              disabled={roleMut.isPending}
                              onClick={() => roleMut.mutate({ user_id: u.id, role: r, grant: !on })}
                              className={`rounded-full border px-2.5 py-1 text-[11.5px] font-medium capitalize transition ${
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
                      <select
                        className="apx-input h-9 w-44 text-[13px]"
                        value={u.parent_user_id ?? ""}
                        onChange={(e) =>
                          profileMut.mutate({ id: u.id, parent_user_id: e.target.value || null })
                        }
                      >
                        <option value="">— none —</option>
                        {allUsers
                          .filter((p: any) => p.id !== u.id)
                          .map((p: any) => (
                            <option key={p.id} value={p.id}>
                              {[p.first_name, p.last_name].filter(Boolean).join(" ") || p.email}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1.5 text-[12px] text-apex-dim">
                        <PermToggle
                          label="Invite agents"
                          checked={!!u.can_invite_agents}
                          onChange={(v) => profileMut.mutate({ id: u.id, can_invite_agents: v })}
                        />
                        <PermToggle
                          label="Invite leaders"
                          checked={!!u.can_invite_leaders}
                          onChange={(v) => profileMut.mutate({ id: u.id, can_invite_leaders: v })}
                        />
                        <PermToggle
                          label="Manage resources"
                          checked={!!u.can_manage_resources}
                          onChange={(v) => profileMut.mutate({ id: u.id, can_manage_resources: v })}
                        />
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <SlugCell
                        slug={u.recruiting_slug ?? ""}
                        disabled={profileMut.isPending}
                        onSave={(slug) => profileMut.mutate({ id: u.id, recruiting_slug: slug })}
                      />
                      <PermToggle
                        label="Can receive applicants"
                        checked={u.can_receive_applicants !== false}
                        onChange={(v) => profileMut.mutate({ id: u.id, can_receive_applicants: v })}
                      />
                    </td>
                    <td className="px-5 py-4">
                      <label className="inline-flex items-center gap-2 text-[13px] text-apex-dim">
                        <input
                          type="checkbox"
                          checked={u.is_active !== false}
                          onChange={(e) =>
                            profileMut.mutate({ id: u.id, is_active: e.target.checked })
                          }
                        />
                        {u.is_active !== false ? "Active" : "Inactive"}
                      </label>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-apex-dim">
                      No users match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PortalShell>
  );
}

function PermToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-[12px] text-apex-dim">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function SlugCell({
  slug,
  disabled,
  onSave,
}: {
  slug: string;
  disabled: boolean;
  onSave: (slug: string) => void;
}) {
  const [value, setValue] = useState(slug);
  const dirty = value.trim() !== slug;
  return (
    <div className="flex items-center gap-2">
      <input
        className="apx-input h-9 w-40 text-[13px]"
        value={value}
        placeholder="recruiting-slug"
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
      />
      {dirty && value.trim() && (
        <button
          onClick={() => onSave(value.trim().toLowerCase())}
          disabled={disabled}
          className="text-[12px] text-apex-gold hover:underline disabled:opacity-50"
        >
          Save
        </button>
      )}
    </div>
  );
}
