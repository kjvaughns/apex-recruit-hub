import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell, PortalHeader } from "@/components/apex/portal-shell";
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
        <PortalHeader kicker="Welcome to Vantage" title="Your onboarding checklist" />
        <div className="p-10 text-[13px] text-apex-faint">Loading…</div>
      </PortalShell>
    );
  }

  if (!data?.hasOnboarding) {
    return (
      <PortalShell>
        <PortalHeader kicker="Welcome to Vantage" title="Onboarding" />
        <div className="mx-auto max-w-[560px] px-6 py-16 text-center md:px-10">
          <div className="apx-card p-8">
            <p className="text-[15px] text-apex-muted">
              You don't have any onboarding steps assigned. You're all set — head to your dashboard.
            </p>
            <Link to="/portal" className="apx-btn-primary mt-5 inline-flex px-6 py-3 text-[14px]">
              Go to dashboard →
            </Link>
          </div>
        </div>
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
      <PortalHeader kicker="Welcome to Vantage" title="Your onboarding checklist" />

      <div className="mx-auto max-w-[820px] px-6 py-8 md:px-10">
        <div className="apx-card p-5 md:p-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-apex-muted">
              {allDone ? "All steps complete" : `${done} of ${total} complete`}
            </span>
            <span className="font-display text-[20px] text-apex-gold">{pct}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-apex-gold transition-all"
              style={{ width: `${Math.max(4, pct)}%` }}
            />
          </div>
        </div>

        {allDone && (
          <div className="apx-card apx-card-gold mt-6 p-6 text-center md:p-8">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-apex-gold text-[26px] text-apex-card">
              ✓
            </div>
            <h2 className="font-display text-[26px] leading-tight text-apex-ivory">
              You're fully onboarded.
            </h2>
            <p className="mx-auto mt-2 max-w-[420px] text-[14px] text-apex-muted">
              Every step is done — welcome to the team. Your training path will be available in the
              portal shortly.
            </p>
            <Link to="/portal" className="apx-btn-ghost mt-5 inline-flex px-6 py-3 text-[14px]">
              Go to your dashboard →
            </Link>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-4">
          <StepCard
            n={1}
            title="AgentSpace contracting"
            state={stepState(steps, "agentspace_contracting")}
            onComplete={() => mut.mutate("agentspace_contracting")}
            pending={mut.isPending}
            actionLabel="I've completed this"
          >
            <p className="text-[14px] leading-relaxed text-apex-dim">
              Click the link below, select <strong className="text-apex-fog">"Join Agency,"</strong>{" "}
              and paste in the agency code.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a
                href={AGENTSPACE_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="apx-btn-ghost px-4 py-2.5 text-[13px]"
              >
                Open AgentSpace →
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
            <p className="text-[14px] leading-relaxed text-apex-dim">
              Follow these steps in our Discord server to get your Licensed Agent role.{" "}
              <span className="text-apex-faint">(Exact instructions coming soon.)</span>
            </p>
          </StepCard>

          <StepCard n={3} title="Portal account setup" state={stepState(steps, "portal_account_setup")} auto>
            <p className="text-[14px] leading-relaxed text-apex-dim">
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
            <p className="text-[14px] leading-relaxed text-apex-dim">
              Review our hours, standing meetings, and team standards so you know how we operate.{" "}
              <span className="text-apex-faint">(Full expectations copy coming soon.)</span>
            </p>
          </StepCard>
        </div>
      </div>
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
    <div className={`apx-card p-5 md:p-6 ${done ? "border-emerald-500/25" : ""}`}>
      <div className="flex items-start gap-4">
        <div
          className={`flex h-10 w-10 flex-none items-center justify-center rounded-full border font-display text-[18px] ${
            done
              ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300"
              : "border-apex-gold/40 text-apex-gold"
          }`}
        >
          {done ? "✓" : n}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-[20px] leading-tight text-apex-ivory">{title}</h3>
            <StatusPill done={done} auto={auto} />
          </div>
          <div className="mt-2">{children}</div>

          <div className="mt-4">
            {done ? (
              <div className="text-[12px] text-emerald-300/80">
                Completed
                {state.completed_at
                  ? ` · ${new Date(state.completed_at).toLocaleDateString()}`
                  : ""}
              </div>
            ) : auto ? null : (
              <button
                onClick={onComplete}
                disabled={pending}
                className="apx-btn-primary px-4 py-2.5 text-[13px] disabled:opacity-60"
              >
                {actionLabel ?? "Mark complete"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ done, auto }: { done: boolean; auto?: boolean }) {
  if (done) {
    return (
      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-emerald-300">
        Done
      </span>
    );
  }
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-apex-faint">
      {auto ? "Automatic" : "Not started"}
    </span>
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
    <button
      onClick={copy}
      className="inline-flex items-center gap-2 rounded-[10px] border border-apex-gold/30 bg-apex-gold/[0.06] px-3 py-2.5 font-mono text-[13px] text-apex-ivory transition hover:border-apex-gold/50"
      title="Copy agency code"
    >
      <span className="tracking-[0.08em]">{code}</span>
      <span className="text-[11px] font-semibold uppercase text-apex-gold">
        {copied ? "Copied" : "Copy"}
      </span>
    </button>
  );
}
