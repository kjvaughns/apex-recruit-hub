import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PortalShell } from "@/components/apex/portal-shell";
import {
  PageHeader,
  PageBody,
  Panel,
  Button,
  Field,
  Input,
  Textarea,
  Select,
  FormGrid,
  Badge,
  TableWrap,
  Table,
  THead,
  TH,
  TR,
  TD,
  EmptyState,
  type BadgeTone,
} from "@/components/portal/ui";
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

const STATUS_TONE: Record<string, BadgeTone> = {
  pending: "gold",
  accepted: "green",
  expired: "neutral",
  cancelled: "red",
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
      <PageBody>
        <PageHeader title="Invitations" description="Invite and manage new users." />
        <div className="space-y-4">
          {/* Invite form */}
          {ctxQ.data && !ctxQ.data.canInvite ? (
            <Panel>
              <p className="p-secondary">
                Your account isn't permitted to invite users. Ask an administrator or your manager to
                enable it.
              </p>
            </Panel>
          ) : (
            <Panel title="Invite a user">
              <FormGrid>
                <Field label="First name">
                  <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
                </Field>
                <Field label="Last name">
                  <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
                </Field>
                <Field label="Email" required>
                  <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                </Field>
                <Field label="Phone">
                  <Input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                </Field>
                <Field label="Role" required>
                  <Select value={form.role} onChange={(e) => set("role", e.target.value)}>
                    {allowedRoles.map((r) => (
                      <option key={r} value={r} className="capitalize">
                        {r}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Reports to (leader / manager)">
                  <Select value={form.parent_user_id} onChange={(e) => set("parent_user_id", e.target.value)}>
                    <option value="">— none —</option>
                    {parents.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Team">
                  <Select value={form.team_id} onChange={(e) => set("team_id", e.target.value)}>
                    <option value="">— none —</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="State">
                  <Input maxLength={2} value={form.state} onChange={(e) => set("state", e.target.value)} />
                </Field>
                <Field label="Instagram handle">
                  <Input value={form.instagram_handle} onChange={(e) => set("instagram_handle", e.target.value)} />
                </Field>
                <Field label="NPN (if licensed)">
                  <Input value={form.npn} onChange={(e) => set("npn", e.target.value)} />
                </Field>
              </FormGrid>

              <div className="p-secondary mt-3 flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={form.licensed} onChange={(e) => set("licensed", e.target.checked)} />
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

              <Field label="Notes (optional)" className="mt-4">
                <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </Field>

              {error && (
                <div
                  className="mt-3 rounded-[10px] border p-3 text-[13.5px]"
                  style={{ borderColor: "var(--p-red)", background: "rgba(220,106,98,0.1)", color: "var(--p-text)" }}
                >
                  {error}
                </div>
              )}
              {createdLink && (
                <div
                  className="mt-3 flex flex-wrap items-center gap-3 rounded-[10px] border p-3 text-[13.5px]"
                  style={{ borderColor: "var(--p-gold-line)", background: "var(--p-gold-soft)" }}
                >
                  <span className="p-body">Invitation created.</span>
                  <Input
                    readOnly
                    className="h-9 flex-1 text-[12.5px]"
                    value={createdLink}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <Button variant="ghost" size="sm" onClick={() => copy(createdLink, "new")}>
                    {copied === "new" ? "Copied!" : "Copy link"}
                  </Button>
                </div>
              )}

              <Button
                variant="primary"
                className="mt-4"
                onClick={() => {
                  setError("");
                  createMut.mutate();
                }}
                disabled={createMut.isPending || !form.email.trim() || !form.role}
              >
                {createMut.isPending ? "Creating…" : "Send invitation"}
              </Button>
            </Panel>
          )}

          {/* Invitations list */}
          <TableWrap>
            <Table>
              <THead>
                <TH>Invitee</TH>
                <TH>Role</TH>
                <TH>Status</TH>
                <TH>Expires</TH>
                <TH align="right">Actions</TH>
              </THead>
              <tbody>
                {listQ.isLoading ? (
                  <TR>
                    <TD colSpan={5} align="center" className="p-muted py-10">
                      Loading…
                    </TD>
                  </TR>
                ) : invitations.length === 0 ? (
                  <TR>
                    <TD colSpan={5}>
                      <EmptyState title="No invitations yet." />
                    </TD>
                  </TR>
                ) : (
                  invitations.map((inv: any) => (
                    <TR key={inv.id}>
                      <TD>
                        <div className="p-body">
                          {[inv.first_name, inv.last_name].filter(Boolean).join(" ") || "—"}
                        </div>
                        <div className="p-muted">{inv.email}</div>
                      </TD>
                      <TD className="p-secondary capitalize">{inv.role}</TD>
                      <TD>
                        <Badge tone={STATUS_TONE[inv.status] ?? "neutral"} className="capitalize">
                          {inv.status}
                        </Badge>
                      </TD>
                      <TD className="p-muted">
                        {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : "—"}
                      </TD>
                      <TD align="right">
                        <div className="flex flex-wrap justify-end gap-3 text-[12.5px]">
                          {inv.status === "pending" && (
                            <button
                              onClick={() => copy(inviteUrl(inv.token), inv.id)}
                              style={{ color: "var(--p-gold)" }}
                              className="hover:underline"
                            >
                              {copied === inv.id ? "Copied!" : "Copy link"}
                            </button>
                          )}
                          {inv.status !== "accepted" && (
                            <button
                              onClick={() => resendMut.mutate(inv.id)}
                              disabled={resendMut.isPending}
                              className="p-secondary hover:[color:var(--p-text)]"
                            >
                              Resend
                            </button>
                          )}
                          {inv.status === "pending" && (
                            <button
                              onClick={() => cancelMut.mutate(inv.id)}
                              disabled={cancelMut.isPending}
                              style={{ color: "var(--p-red)" }}
                              className="hover:underline"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </TD>
                    </TR>
                  ))
                )}
              </tbody>
            </Table>
          </TableWrap>
        </div>
      </PageBody>
    </PortalShell>
  );
}
