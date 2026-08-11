import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/apex/portal-shell";
import { adminListUsers, adminSetUserRole, adminUpdateProfile } from "@/lib/portal.functions";
import { useState } from "react";
import {
  PageHeader, PageBody, Toolbar, SearchField, TableWrap, Table, THead, TH, TR, TD,
  Badge, Select, Input,
} from "@/components/portal/ui";

export const Route = createFileRoute("/_authenticated/portal/admin/users")({
  head: () => ({ meta: [{ title: "Users — Vantage Admin" }, { name: "robots", content: "noindex" }] }),
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
      <PageBody>
        <PageHeader title="Users & roles" description="Grant admin, manager, or agent access; toggle activation and teams." />
        <Toolbar className="mb-4">
          <SearchField value={q} onChange={setQ} placeholder="Search name or email…" />
          <div className="ml-auto p-muted">{users.length} user(s)</div>
        </Toolbar>

        {isLoading ? (
          <div className="p-panel p-secondary p-8 text-center">Loading…</div>
        ) : (
          <TableWrap>
            <Table className="min-w-[900px]">
              <THead>
                <TH>Name</TH>
                <TH>Role</TH>
                <TH>Reports to</TH>
                <TH>Permissions</TH>
                <TH>Recruiting link</TH>
                <TH>Status</TH>
              </THead>
              <tbody>
                {users.map((u: any) => (
                  <TR key={u.id} className="align-top">
                    <TD>
                      <div className="p-card-title">
                        {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                      </div>
                      <div className="p-muted">{u.email}</div>
                      {u.roles.includes("super_admin") && (
                        <Badge tone="gold" className="mt-1">Owner</Badge>
                      )}
                    </TD>
                    <TD>
                      <div className="flex flex-wrap gap-1.5">
                        {ROLES.map((r) => {
                          const on = u.roles.includes(r);
                          return (
                            <button
                              key={r}
                              disabled={roleMut.isPending}
                              onClick={() => roleMut.mutate({ user_id: u.id, role: r, grant: !on })}
                              className="p-focus rounded-full border px-2.5 py-1 text-[11.5px] font-medium capitalize transition"
                              style={
                                on
                                  ? { borderColor: "var(--p-gold-line)", background: "var(--p-gold-soft)", color: "var(--p-gold)" }
                                  : { borderColor: "var(--p-border)", color: "var(--p-text-3)" }
                              }
                            >
                              {r}
                            </button>
                          );
                        })}
                      </div>
                    </TD>
                    <TD>
                      <Select
                        className="h-9 w-44 text-[13px]"
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
                      </Select>
                    </TD>
                    <TD>
                      <div className="flex flex-col gap-1.5">
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
                    </TD>
                    <TD>
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
                    </TD>
                    <TD>
                      <label className="p-secondary inline-flex items-center gap-2 text-[13px]">
                        <input
                          type="checkbox"
                          checked={u.is_active !== false}
                          onChange={(e) =>
                            profileMut.mutate({ id: u.id, is_active: e.target.checked })
                          }
                        />
                        {u.is_active !== false ? "Active" : "Inactive"}
                      </label>
                    </TD>
                  </TR>
                ))}
                {users.length === 0 && (
                  <TR>
                    <TD colSpan={6} className="p-secondary text-center">
                      No users match.
                    </TD>
                  </TR>
                )}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </PageBody>
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
    <label className="p-secondary inline-flex items-center gap-2 text-[12px]">
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
      <Input
        className="h-9 w-40 text-[13px]"
        value={value}
        placeholder="recruiting-slug"
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
      />
      {dirty && value.trim() && (
        <button
          onClick={() => onSave(value.trim().toLowerCase())}
          disabled={disabled}
          className="p-focus text-[12px] font-semibold disabled:opacity-50"
          style={{ color: "var(--p-gold)" }}
        >
          Save
        </button>
      )}
    </div>
  );
}
