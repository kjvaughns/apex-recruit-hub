import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PortalShell, PortalHeader } from "@/components/apex/portal-shell";
import {
  getInvitableContext,
  listInvitations,
  createInvitation,
  cancelInvitation,
  resendInvitation,
} from "@/lib/invitations.functions";

export const Route = createFileRoute("/_authenticated/portal/invitations")({
  head: () => ({
    meta: [{ title: "Invitations — Vantage Portal" }, { name: "robots", content: "noindex" }],
  }),
  component: InvitationsPage,
});

const STATUS_STYLES: Record<string, string> = {
  pending: "border-apex-gold/40 bg-apex-gold/10 text-apex-gold",
  accepted: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  expired: "border-white/15 bg-white/[0.04] text-apex-faint",
  cancelled: "border-red-500/25 bg-red-500/10 text-red-300",
};

function inviteUrl(token: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/portal-invite/${token}`;
}

const EMPTY = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  role: "agent",
  parent_user_id: "",
  team_id: "",
  state: "",
  licensed: false,
  npn: "",
  instagram_handle: "",
  notes: "",
  can_invite_agents: false,
  can_invite_leaders: false,
  can_manage_resources: false,
};

function InvitationsPage() {
  const ctxFn = useServerFn(getInvitableContext);
  const listFn = useServerFn(listInvitations);
  const createFn = useServerFn(createInvitation);
  const cancelFn = useServerFn(cancelInvitation);
  const resendFn = useServerFn(resendInvitation);
  const qc = useQueryClient();

  const ctxQ = useQuery({ queryKey: ["invite", "context"], queryFn: () => ctxFn() });
  const listQ = useQuery({ queryKey: ["invite", "list"], queryFn: () => listFn() });
  const refresh = () => qc.invalidateQueries({ queryKey: ["invite"] });

  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState("");
  const [createdLink, setCreatedLink] = useState("");
  const [copied, setCopied] = useState("");

  const createMut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          ...form,
          state: form.state.toUpperCase(),
          parent_user_id: form.parent_user_id || "",
          team_id: form.team_id || "",
        } as any,
      }),
    onSuccess: (res: { token: string }) => {
      setCreatedLink(inviteUrl(res.token));
      setForm({ ...EMPTY });
      setError("");
      refresh();
    },
    onError: (e: unknown) => setError((e as Error).message || "Could not create invitation."),
  });
  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: refresh,
  });
  const resendMut = useMutation({
    mutationFn: (id: string) => resendFn({ data: { id } }),
    onSuccess: refresh,
  });

  const allowedRoles = ctxQ.data?.allowedRoles ?? [];
  const parents = ctxQ.data?.parents ?? [];
  const teams = ctxQ.data?.teams ?? [];
  const invitations = listQ.data?.invitations ?? [];

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      /* noop */
    }
  }

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <PortalShell>
      <PortalHeader kicker="Management" title="Invitations" />
      <div className="space-y-6 px-6 py-8 md:px-10">
        {/* Invite form */}
        {ctxQ.data && !ctxQ.data.canInvite ? (
          <div className="apx-card p-6 text-apex-muted">
            Your account isn't permitted to invite users. Ask an administrator or your manager to
            enable it.
          </div>
        ) : (
          <div className="apx-card p-6 md:p-8">
            <h2 className="mb-4 font-display text-[24px] leading-none">Invite a user</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <L label="First name">
                <input
                  className="apx-input"
                  value={form.first_name}
                  onChange={(e) => set("first_name", e.target.value)}
                />
              </L>
              <L label="Last name">
                <input
                  className="apx-input"
                  value={form.last_name}
                  onChange={(e) => set("last_name", e.target.value)}
                />
              </L>
              <L label="Email *">
                <input
                  type="email"
                  className="apx-input"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </L>
              <L label="Phone">
                <input
                  type="tel"
                  className="apx-input"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </L>
              <L label="Role *">
                <select
                  className="apx-input"
                  value={form.role}
                  onChange={(e) => set("role", e.target.value)}
                >
                  {allowedRoles.map((r) => (
                    <option key={r} value={r} className="capitalize">
                      {r}
                    </option>
                  ))}
                </select>
              </L>
              <L label="Reports to (leader / manager)">
                <select
                  className="apx-input"
                  value={form.parent_user_id}
                  onChange={(e) => set("parent_user_id", e.target.value)}
                >
                  <option value="">— none —</option>
                  {parents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </L>
              <L label="Team">
                <select
                  className="apx-input"
                  value={form.team_id}
                  onChange={(e) => set("team_id", e.target.value)}
                >
                  <option value="">— none —</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </L>
              <L label="State">
                <input
                  className="apx-input"
                  maxLength={2}
                  value={form.state}
                  onChange={(e) => set("state", e.target.value)}
                />
              </L>
              <L label="Instagram handle">
                <input
                  className="apx-input"
                  value={form.instagram_handle}
                  onChange={(e) => set("instagram_handle", e.target.value)}
                />
              </L>
              <L label="NPN (if licensed)">
                <input
                  className="apx-input"
                  value={form.npn}
                  onChange={(e) => set("npn", e.target.value)}
                />
              </L>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-[13px] text-apex-dim">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.licensed}
                  onChange={(e) => set("licensed", e.target.checked)}
                />
                Currently licensed
              </label>
              {(form.role === "leader" || form.role === "manager") && (
                <>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.can_invite_agents}
                      onChange={(e) => set("can_invite_agents", e.target.checked)}
                    />
                    Can invite agents
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.can_invite_leaders}
                      onChange={(e) => set("can_invite_leaders", e.target.checked)}
                    />
                    Can invite leaders
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.can_manage_resources}
                      onChange={(e) => set("can_manage_resources", e.target.checked)}
                    />
                    Can manage resources
                  </label>
                </>
              )}
            </div>
            <L label="Notes (optional)">
              <textarea
                className="apx-input"
                rows={2}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </L>

            {error && (
              <div className="mt-3 rounded-[10px] border border-red-500/30 bg-red-500/10 p-3 text-[13.5px] text-red-200">
                {error}
              </div>
            )}
            {createdLink && (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[10px] border border-apex-gold/30 bg-apex-gold/5 p-3 text-[13.5px]">
                <span className="text-apex-fog">Invitation created.</span>
                <input
                  readOnly
                  className="apx-input h-9 flex-1 text-[12.5px]"
                  value={createdLink}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  onClick={() => copy(createdLink, "new")}
                  className="apx-btn-ghost px-4 py-2 text-[12.5px]"
                >
                  {copied === "new" ? "Copied!" : "Copy link"}
                </button>
              </div>
            )}

            <button
              onClick={() => {
                setError("");
                createMut.mutate();
              }}
              disabled={createMut.isPending || !form.email.trim() || !form.role}
              className="apx-btn-primary mt-4 px-6 py-3 disabled:opacity-60"
            >
              {createMut.isPending ? "Creating…" : "Send invitation"}
            </button>
          </div>
        )}

        {/* Invitations list */}
        <div className="apx-card overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-[14px]">
            <thead className="bg-white/[0.02] text-[11px] uppercase tracking-[0.12em] text-apex-faint">
              <tr>
                <th className="px-5 py-3">Invitee</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Expires</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {listQ.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-apex-dim">
                    Loading…
                  </td>
                </tr>
              ) : invitations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-apex-dim">
                    No invitations yet.
                  </td>
                </tr>
              ) : (
                invitations.map((inv: any) => (
                  <tr key={inv.id} className="border-t border-white/[0.05]">
                    <td className="px-5 py-4">
                      <div className="text-apex-ivory">
                        {[inv.first_name, inv.last_name].filter(Boolean).join(" ") || "—"}
                      </div>
                      <div className="text-[12px] text-apex-faint">{inv.email}</div>
                    </td>
                    <td className="px-5 py-4 capitalize text-apex-dim">{inv.role}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11.5px] font-medium capitalize ${
                          STATUS_STYLES[inv.status] ?? STATUS_STYLES.expired
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[13px] text-apex-faint">
                      {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-3 text-[12.5px]">
                        {inv.status === "pending" && (
                          <button
                            onClick={() => copy(inviteUrl(inv.token), inv.id)}
                            className="text-apex-gold hover:underline"
                          >
                            {copied === inv.id ? "Copied!" : "Copy link"}
                          </button>
                        )}
                        {inv.status !== "accepted" && (
                          <button
                            onClick={() => resendMut.mutate(inv.id)}
                            disabled={resendMut.isPending}
                            className="text-apex-dim hover:text-apex-ivory"
                          >
                            Resend
                          </button>
                        )}
                        {inv.status === "pending" && (
                          <button
                            onClick={() => cancelMut.mutate(inv.id)}
                            disabled={cancelMut.isPending}
                            className="text-red-300 hover:underline"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
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

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.06em] text-apex-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
