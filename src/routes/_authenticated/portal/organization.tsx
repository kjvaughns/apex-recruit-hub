import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
import { PortalShell } from "@/components/vantage/portal-shell";
import { getOrganizationTree, type OrgNode } from "@/lib/portal.functions";
import {
  PageHeader,
  PageBody,
  Panel,
  Avatar,
  Badge,
  EmptyState,
  ErrorState,
  ListSkeleton,
  IconButton,
  type BadgeTone,
} from "@/components/portal/ui";

export const Route = createFileRoute("/_authenticated/portal/organization")({
  head: () => ({
    meta: [{ title: "Organization — Vantage Portal" }, { name: "robots", content: "noindex" }],
  }),
  component: OrganizationPage,
});

const ROLE_TONE: Record<string, BadgeTone> = {
  admin: "gold",
  manager: "green",
  leader: "blue",
  agent: "neutral",
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
      <PageBody>
        <PageHeader title="Organization" description="Your reporting hierarchy and downline." />
        {q.isError ? (
          <Panel>
            <ErrorState description="We couldn't load your organization right now." onRetry={() => q.refetch()} />
          </Panel>
        ) : q.isLoading ? (
          <Panel bodyClassName="p-4">
            <ListSkeleton rows={6} />
          </Panel>
        ) : nodes.length === 0 ? (
          <Panel>
            <EmptyState
              icon={<Users size={16} />}
              title="No downline yet"
              description="Agents you recruit or manage will appear here, organized by reporting line, as soon as they join."
            />
          </Panel>
        ) : (
          <Panel
            title="Hierarchy"
            description={`${nodes.length} ${nodes.length === 1 ? "person" : "people"} in view`}
            bodyClassName="p-2"
          >
            <div className="flex flex-col gap-0.5">
              {roots.map((r) => (
                <TreeNode key={r.id} node={r} childrenOf={childrenOf} depth={0} />
              ))}
            </div>
          </Panel>
        )}
      </PageBody>
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
  const isLeaderRole = node.role === "manager" || node.role === "leader" || node.role === "admin";
  const active = (node as any).active !== false;
  return (
    <div>
      <div
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[8px] py-2 pr-2 pl-[calc(var(--depth)*10px_+_8px)] hover:bg-[var(--p-hover)] sm:flex sm:pl-[calc(var(--depth)*18px_+_8px)]"
        style={{ "--depth": depth } as React.CSSProperties}
      >
        <div className="flex min-w-0 items-center gap-2">
          {kids.length > 0 ? (
            <IconButton
              label={open ? "Collapse" : "Expand"}
              size="sm"
              className="h-5 w-5"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </IconButton>
          ) : (
            <span className="w-5 flex-none text-center" style={{ color: "var(--p-text-3)" }}>
              ·
            </span>
          )}
          <Avatar name={node.name} size={26} />
          <span className={`truncate text-[13.5px] ${isLeaderRole ? "font-semibold" : ""}`}>{node.name}</span>
          <Badge tone={ROLE_TONE[node.role ?? ""] ?? "neutral"} className="capitalize shrink-0">
            {node.role ?? "—"}
          </Badge>
          {!active && (
            <Badge tone="neutral" className="shrink-0">Inactive</Badge>
          )}
          {node.team_name && (
            <span className="p-muted hidden truncate sm:inline">· {node.team_name}</span>
          )}
        </div>
        {kids.length > 0 && (
          <span className="p-muted shrink-0 text-[11px]">{kids.length} direct</span>
        )}
      </div>
      {open &&
        kids.map((k) => <TreeNode key={k.id} node={k} childrenOf={childrenOf} depth={depth + 1} />)}
    </div>
  );
}
