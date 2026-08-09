import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell, PortalHeader } from "@/components/apex/portal-shell";
import { getOrganizationTree, type OrgNode } from "@/lib/portal.functions";

export const Route = createFileRoute("/_authenticated/portal/organization")({
  head: () => ({
    meta: [{ title: "Organization — Vantage Portal" }, { name: "robots", content: "noindex" }],
  }),
  component: OrganizationPage,
});

const ROLE_COLOR: Record<string, string> = {
  admin: "text-apex-gold",
  manager: "text-emerald-300",
  leader: "text-sky-300",
  agent: "text-apex-fog",
};

function OrganizationPage() {
  const fn = useServerFn(getOrganizationTree);
  const q = useQuery({ queryKey: ["org", "tree"], queryFn: () => fn() });

  const nodes = q.data?.nodes ?? [];
  const rootId = q.data?.rootId ?? null;

  const { childrenOf, roots } = useMemo(() => {
    const map: Record<string, OrgNode[]> = {};
    const ids = new Set(nodes.map((n) => n.id));
    for (const n of nodes) {
      const key = n.parent_user_id ?? "__root__";
      (map[key] ??= []).push(n);
    }
    let roots: OrgNode[];
    if (rootId) {
      roots = nodes.filter((n) => n.id === rootId);
    } else {
      // Admin view: roots are nodes whose parent isn't in the visible set.
      roots = nodes.filter((n) => !n.parent_user_id || !ids.has(n.parent_user_id));
    }
    return { childrenOf: map, roots };
  }, [nodes, rootId]);

  return (
    <PortalShell>
      <PortalHeader kicker="Hierarchy" title="Organization" />
      <div className="px-6 py-8 md:px-10">
        {q.isLoading ? (
          <div className="apx-card p-10 text-center text-apex-dim">Loading…</div>
        ) : nodes.length === 0 ? (
          <div className="apx-card p-10 text-center text-apex-dim">No downline yet.</div>
        ) : (
          <div className="apx-card p-4 md:p-6">
            <div className="mb-3 text-[12px] text-apex-faint">
              {nodes.length} {nodes.length === 1 ? "person" : "people"} in view
            </div>
            <div className="flex flex-col gap-1">
              {roots.map((r) => (
                <TreeNode key={r.id} node={r} childrenOf={childrenOf} depth={0} />
              ))}
            </div>
          </div>
        )}
      </div>
    </PortalShell>
  );
}

function TreeNode({
  node,
  childrenOf,
  depth,
}: {
  node: OrgNode;
  childrenOf: Record<string, OrgNode[]>;
  depth: number;
}) {
  const kids = childrenOf[node.id] ?? [];
  const [open, setOpen] = useState(depth < 2);
  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-[10px] px-2 py-2 hover:bg-white/[0.03]"
        style={{ paddingLeft: `${depth * 18 + 8}px` }}
      >
        {kids.length > 0 ? (
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex h-5 w-5 flex-none items-center justify-center rounded text-apex-muted hover:text-apex-gold"
          >
            {open ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-5 flex-none text-center text-apex-faint">·</span>
        )}
        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-apex-fog">
          {(node.name?.[0] ?? "?").toUpperCase()}
        </span>
        <span className="truncate text-[14px] text-apex-ivory">{node.name}</span>
        <span
          className={`text-[11.5px] capitalize ${ROLE_COLOR[node.role ?? ""] ?? "text-apex-faint"}`}
        >
          {node.role ?? "—"}
        </span>
        {node.team_name && <span className="text-[11px] text-apex-faint">· {node.team_name}</span>}
        {kids.length > 0 && (
          <span className="ml-auto text-[11px] text-apex-faint">{kids.length} direct</span>
        )}
      </div>
      {open &&
        kids.map((k) => <TreeNode key={k.id} node={k} childrenOf={childrenOf} depth={depth + 1} />)}
    </div>
  );
}
