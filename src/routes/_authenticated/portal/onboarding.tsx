import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/vantage/portal-shell";
import { PageHeader, PageBody, Panel, Button, Badge } from "@/components/portal/ui";
import { getMyOnboarding, completeOnboardingStep } from "@/lib/portal.functions";
import {
  ONBOARDING_STEP_ORDER,
  type OnboardingStepKey,
  type OnboardingStepState,
} from "@/lib/onboarding";

export const Route = createFileRoute("/_authenticated/portal/onboarding")({
  head: () => ({
    meta: [{ title: "Onboarding — Vantage Portal" }, { name: "robots", content: "noindex" }],
  }),
  component: OnboardingPage,
});

const AGENCY_CODE = "AEFS-AVLX-A7FY-9Z9L";
const AGENTSPACE_URL = "https://app.useagentspace.com/register";

function stepState(
  steps: Record<string, OnboardingStepState> | undefined,
  key: OnboardingStepKey,
): OnboardingStepState {
  return steps?.[key] ?? { completed: false, completed_at: null };
}

function OnboardingPage() {
  const qc = useQueryClient();
  const fetchOnboarding = useServerFn(getMyOnboarding);
  const completeStep = useServerFn(completeOnboardingStep);

  const { data, isLoading } = useQuery({
    queryKey: ["my-onboarding"],
    queryFn: () => fetchOnboarding(),
  });

  const mut = useMutation({
    mutationFn: (step: "agentspace_contracting" | "discord_role_update" | "expectations_reviewed") =>
      completeStep({ data: { step } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-onboarding"] });
      qc.invalidateQueries({ queryKey: ["applicants"] });
      qc.invalidateQueries({ queryKey: ["applicant"] });
    },
  });

  if (isLoading) {
    return (
      <PortalShell>
        <PageBody>
          <PageHeader title="Your onboarding checklist" description="Welcome to Vantage" />
          <div className="p-muted">Loading…</div>
        </PageBody>
      </PortalShell>
    );
  }

  if (!data?.hasOnboarding) {
    return (
      <PortalShell>
        <PageBody>
          <PageHeader title="Onboarding" description="Welcome to Vantage" />
          <Panel className="max-w-[560px]">
            <p className="p-secondary">
              You don't have any onboarding steps assigned. You're all set — head to your dashboard.
            </p>
            <Link to="/portal">
              <Button variant="primary" className="mt-4">
                Go to dashboard →
              </Button>
            </Link>
          </Panel>
        </PageBody>
      </PortalShell>
    );
  }

  const steps = data.steps as Record<string, OnboardingStepState>;
  const done = data.done ?? 0;
  const total = data.total ?? ONBOARDING_STEP_ORDER.length;
  const allDone = !!data.complete;
  const pct = Math.round((done / total) * 100);

  return (
    <PortalShell>
      <PageBody>
        <PageHeader title="Your onboarding checklist" description="Welcome to Vantage" />

        <div className="max-w-[820px] space-y-4">
          <Panel>
            <div className="mb-2 flex items-center justify-between">
              <span className="p-label">{allDone ? "All steps complete" : `${done} of ${total} complete`}</span>
              <span className="p-metric" style={{ color: "var(--p-gold)" }}>{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--p-hover)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.max(4, pct)}%`, background: "var(--p-gold)" }}
              />
            </div>
          </Panel>

          {allDone && (
            <Panel className="text-center">
              <div
                className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full text-[22px]"
                style={{ background: "var(--p-gold)", color: "#0B0B0C" }}
              >
                ✓
              </div>
              <h2 className="p-card-title">You're fully onboarded.</h2>
              <p className="p-secondary mx-auto mt-2 max-w-[420px]">
                Every step is done — welcome to the team. Your training path will be available in the
                portal shortly.
              </p>
              <Link to="/portal">
                <Button variant="secondary" className="mt-4">
                  Go to your dashboard →
                </Button>
              </Link>
            </Panel>
          )}

          <StepCard
            n={1}
            title="AgentSpace contracting"
            state={stepState(steps, "agentspace_contracting")}
            onComplete={() => mut.mutate("agentspace_contracting")}
            pending={mut.isPending}
            actionLabel="I've completed this"
          >
            <p className="p-secondary">
              Click the link below, select <strong style={{ color: "var(--p-text)" }}>"Join Agency,"</strong>{" "}
              and paste in the agency code.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a href={AGENTSPACE_URL} target="_blank" rel="noreferrer noopener">
                <Button variant="secondary" size="sm">Open AgentSpace →</Button>
              </a>
              <CopyCode code={AGENCY_CODE} />
            </div>
          </StepCard>

          <StepCard
            n={2}
            title="Discord role update"
            state={stepState(steps, "discord_role_update")}
            onComplete={() => mut.mutate("discord_role_update")}
            pending={mut.isPending}
            actionLabel="I've completed this"
          >
            <p className="p-secondary">
              Follow these steps in our Discord server to get your Licensed Agent role.{" "}
              <span className="p-muted">(Exact instructions coming soon.)</span>
            </p>
          </StepCard>

          <StepCard n={3} title="Portal account setup" state={stepState(steps, "portal_account_setup")} auto>
            <p className="p-secondary">
              Done automatically — you're logged into the portal right now, which is all this step
              needs.
            </p>
          </StepCard>

          <StepCard
            n={4}
            title="Expectations reviewed"
            state={stepState(steps, "expectations_reviewed")}
            onComplete={() => mut.mutate("expectations_reviewed")}
            pending={mut.isPending}
            actionLabel="I've reviewed this"
          >
            <p className="p-secondary">
              Review our hours, standing meetings, and team standards so you know how we operate.{" "}
              <span className="p-muted">(Full expectations copy coming soon.)</span>
            </p>
          </StepCard>
        </div>
      </PageBody>
    </PortalShell>
  );
}

function StepCard({
  n,
  title,
  state,
  onComplete,
  actionLabel,
  auto,
  pending,
  children,
}: {
  n: number;
  title: string;
  state: OnboardingStepState;
  onComplete?: () => void;
  actionLabel?: string;
  auto?: boolean;
  pending?: boolean;
  children: React.ReactNode;
}) {
  const done = state.completed;
  return (
    <Panel>
      <div className="flex items-start gap-3">
        <div
          className="grid h-8 w-8 flex-none place-items-center rounded-full border text-[14px] font-semibold"
          style={
            done
              ? { borderColor: "var(--p-green)", background: "rgba(63,179,127,0.12)", color: "var(--p-green)" }
              : { borderColor: "var(--p-gold-line)", color: "var(--p-gold)" }
          }
        >
          {done ? "✓" : n}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="p-card-title">{title}</h3>
            <Badge tone={done ? "green" : "neutral"}>{done ? "Done" : auto ? "Automatic" : "Not started"}</Badge>
          </div>
          <div className="mt-1.5">{children}</div>

          <div className="mt-3">
            {done ? (
              <div className="p-muted text-[12px]" style={{ color: "var(--p-green)" }}>
                Completed
                {state.completed_at ? ` · ${new Date(state.completed_at).toLocaleDateString()}` : ""}
              </div>
            ) : auto ? null : (
              <Button variant="primary" size="sm" onClick={onComplete} disabled={pending}>
                {actionLabel ?? "Mark complete"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
  }
  return (
    <Button variant="secondary" size="sm" onClick={copy} title="Copy agency code" className="font-mono">
      <span className="tracking-[0.08em]">{code}</span>
      <span className="text-[11px] font-semibold uppercase" style={{ color: "var(--p-gold)" }}>
        {copied ? "Copied" : "Copy"}
      </span>
    </Button>
  );
}
