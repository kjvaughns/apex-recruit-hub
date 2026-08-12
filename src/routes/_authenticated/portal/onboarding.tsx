import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PortalShell } from "@/components/vantage/portal-shell";
import { PageHeader, PageBody, Panel, Button, Badge } from "@/components/portal/ui";
import { getMyOnboarding, completeOnboardingStep, notifyOnboarding } from "@/lib/portal.functions";
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
const DISCORD_INVITE = "https://discord.gg/HhFwYbjyt2";

type SelfCheckStep = Exclude<OnboardingStepKey, never>;

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
  const notify = useServerFn(notifyOnboarding);

  const { data, isLoading } = useQuery({
    queryKey: ["my-onboarding"],
    queryFn: () => fetchOnboarding(),
  });

  const mut = useMutation({
    mutationFn: (step: SelfCheckStep) => completeStep({ data: { step } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-onboarding"] });
      qc.invalidateQueries({ queryKey: ["applicants"] });
      qc.invalidateQueries({ queryKey: ["applicant"] });
    },
  });

  const notifyContracting = () => {
    notify({ data: { kind: "contracting_done" } }).catch(() => {});
  };

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
          <PageHeader title="Onboarding checklist" description="Welcome to Vantage" />
          <div className="max-w-[820px] space-y-4">
            <Panel>
              <p className="p-secondary">
                This is the checklist new Vantage agents complete when they join. Your account doesn't
                have an active onboarding checklist, so these steps are shown here as a preview.
              </p>
            </Panel>
            <StepList preview />
          </div>
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

          {allDone && <CompletionPanel />}

          <StepList
            steps={steps}
            onComplete={(s) => mut.mutate(s)}
            onCompleteContracting={() => {
              mut.mutate("agentspace_contracting");
              notifyContracting();
            }}
            pending={mut.isPending}
          />
        </div>
      </PageBody>
    </PortalShell>
  );
}

function CompletionPanel() {
  const notify = useServerFn(notifyOnboarding);
  const [sent, setSent] = useState(false);
  const mut = useMutation({
    mutationFn: () => notify({ data: { kind: "trainer" } }),
    onSuccess: () => {
      setSent(true);
      toast.success("Your trainer has been notified.");
    },
    onError: (e: unknown) => toast.error((e as Error).message || "Could not notify trainer."),
  });
  return (
    <Panel className="text-center">
      <div
        className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full text-[22px]"
        style={{ background: "var(--p-gold)", color: "#0B0B0C" }}
      >
        ✓
      </div>
      <h2 className="p-card-title">Onboarding complete</h2>
      <p className="p-secondary mx-auto mt-2 max-w-[460px]">
        You are ready for New Agent Training. Notify your trainer that you have completed onboarding.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button variant="primary" onClick={() => mut.mutate()} disabled={mut.isPending || sent}>
          {sent ? "✓ Trainer notified" : mut.isPending ? "Notifying…" : "Notify Trainer"}
        </Button>
        <Link to="/portal">
          <Button variant="secondary">Go to your dashboard →</Button>
        </Link>
      </div>
    </Panel>
  );
}

/** The onboarding steps. Shared by the live agent checklist and the read-only preview. */
function StepList({
  steps,
  onComplete,
  onCompleteContracting,
  pending,
  preview,
}: {
  steps?: Record<string, OnboardingStepState>;
  onComplete?: (step: SelfCheckStep) => void;
  onCompleteContracting?: () => void;
  pending?: boolean;
  preview?: boolean;
}) {
  return (
    <>
      <StepCard
        n={1}
        title="AgentSpace Contracting"
        state={stepState(steps, "agentspace_contracting")}
        onComplete={() => (onCompleteContracting ? onCompleteContracting() : onComplete?.("agentspace_contracting"))}
        pending={pending}
        preview={preview}
        actionLabel="I Completed Contracting"
      >
        <p className="p-secondary">
          Create your AgentSpace account and enter the Vantage Financial agency code when prompted
          (select <strong style={{ color: "var(--p-text)" }}>"Join Agency"</strong>). Then verify your
          licensing using your NPN.
        </p>
        <p className="p-muted mt-2">
          Note: AgentSpace occasionally doesn't recognize licensing info right away — refreshing the
          page often updates it.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a href={AGENTSPACE_URL} target="_blank" rel="noreferrer noopener">
            <Button variant="secondary" size="sm">Open AgentSpace →</Button>
          </a>
          <CopyCode code={AGENCY_CODE} />
        </div>
        <div className="mt-4 rounded-[10px] border p-3" style={{ borderColor: "var(--p-border)", background: "var(--p-raised)" }}>
          <div className="p-label mb-1">Training video</div>
          <p className="p-secondary">
            Watch the contracting walkthrough covering SureLC setup, creating your required accounts,
            requesting carrier contracts, and completing AgentSpace onboarding. Work through
            everything until you reach the <strong style={{ color: "var(--p-text)" }}>Pending contracting</strong> screen,
            then mark this step complete below.
          </p>
        </div>
      </StepCard>

      <StepCard
        n={2}
        title="Update Discord Role"
        state={stepState(steps, "discord_role_update")}
        onComplete={() => onComplete?.("discord_role_update")}
        pending={pending}
        preview={preview}
        actionLabel="Mark Complete"
      >
        <p className="p-secondary">
          Once you're licensed, update your Discord access so the licensed-agent channels unlock:
        </p>
        <ol className="p-secondary mt-2 ml-4 list-decimal space-y-1">
          <li>Open the <strong style={{ color: "var(--p-text)" }}>Start Here</strong> channel.</li>
          <li>Click <strong style={{ color: "var(--p-text)" }}>New App</strong>.</li>
          <li>Register as a <strong style={{ color: "var(--p-text)" }}>Licensed Agent</strong>.</li>
        </ol>
        <p className="p-muted mt-2">
          If you're already in the server, this updates your access from Unlicensed to Licensed. If you
          haven't joined Discord yet, use the invite below.
        </p>
        <div className="mt-3">
          <a href={DISCORD_INVITE} target="_blank" rel="noreferrer noopener">
            <Button variant="secondary" size="sm">Join the Discord →</Button>
          </a>
        </div>
      </StepCard>

      <StepCard
        n={3}
        title="Read the Vantage Financial Agent Playbook"
        state={stepState(steps, "read_agent_playbook")}
        onComplete={() => onComplete?.("read_agent_playbook")}
        pending={pending}
        preview={preview}
        actionLabel="I Have Read the Playbook"
      >
        <p className="p-secondary">
          Read the Agent Playbook end to end — it covers how we sell, our systems, and what's expected
          of every Vantage agent.
        </p>
        <div className="mt-3">
          <Link to="/portal/academy/library/$slug" params={{ slug: "agent-playbook" }}>
            <Button variant="secondary" size="sm">Open Agent Playbook →</Button>
          </Link>
        </div>
      </StepCard>

      <StepCard
        n={4}
        title="Agent Expectations & Schedule"
        state={stepState(steps, "agent_expectations_schedule")}
        onComplete={() => onComplete?.("agent_expectations_schedule")}
        pending={pending}
        preview={preview}
        actionLabel="I understand and agree"
        requireAgree="I understand and agree to the Vantage Financial standards and schedule."
      >
        <div className="p-label mb-1">Weekly schedule (CST)</div>
        <ul className="p-secondary space-y-1">
          <li><strong style={{ color: "var(--p-text)" }}>Mandatory Team Meeting</strong> — Monday 9:30 AM</li>
          <li><strong style={{ color: "var(--p-text)" }}>Company Overview</strong> — Monday 7:00 PM</li>
          <li><strong style={{ color: "var(--p-text)" }}>New Agent Live Training</strong> — Monday ~10:30 AM (Training Room Discord voice channel)</li>
          <li><strong style={{ color: "var(--p-text)" }}>Agency Training</strong> — Wednesday 10:30 AM</li>
          <li><strong style={{ color: "var(--p-text)" }}>Film Review</strong> — Tuesday & Thursday 6:00 PM</li>
          <li><strong style={{ color: "var(--p-text)" }}>Live Dials</strong> — 10:00 AM to 6:00 PM daily</li>
        </ul>
        <p className="p-muted mt-2">Encouraged to start earlier and continue calling later when possible.</p>

        <div className="p-label mt-4 mb-1">Standards & expectations</div>
        <ul className="p-secondary ml-4 list-disc space-y-1">
          <li>Cameras must be on while calling.</li>
          <li>Stay unmuted while calling unless operationally necessary.</li>
          <li>Do not be late to meetings.</li>
          <li>$5,000 weekly and $20,000 monthly personal production is the Vantage standard.</li>
          <li>Closing business consistently is a normal expectation of the sales role.</li>
          <li>Agents below standard may be assigned additional training.</li>
          <li>Consistently falling below production standards may result in loss of free lead eligibility and possible termination.</li>
          <li>New Agent Training begins Mondays; the Monday Team Meeting is mandatory.</li>
          <li>Missing required meetings without prior communication may result in termination — communicate beforehand, not after.</li>
        </ul>
      </StepCard>

      <StepCard
        n={5}
        title="Complete the Vantage Closer Course"
        state={stepState(steps, "complete_vantage_closer_course")}
        onComplete={() => onComplete?.("complete_vantage_closer_course")}
        pending={pending}
        preview={preview}
        actionLabel="I've completed the course"
      >
        <p className="p-secondary">
          The Vantage Closer Course is the required pre-training course covering the Vantage sales
          process, sales psychology, mindset, and fundamentals you'll need before live training.
        </p>
        <p className="p-muted mt-2">This step completes automatically once you finish the course.</p>
        <div className="mt-3">
          <Link to="/portal/academy/courses/$slug" params={{ slug: "vantage-closer" }}>
            <Button variant="secondary" size="sm">Start Vantage Closer Course →</Button>
          </Link>
        </div>
      </StepCard>
    </>
  );
}

function StepCard({
  n,
  title,
  state,
  onComplete,
  actionLabel,
  pending,
  preview,
  requireAgree,
  children,
}: {
  n: number;
  title: string;
  state: OnboardingStepState;
  onComplete?: () => void;
  actionLabel?: string;
  pending?: boolean;
  preview?: boolean;
  requireAgree?: string;
  children: React.ReactNode;
}) {
  const done = state.completed;
  const [agreed, setAgreed] = useState(false);
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
            <Badge tone={done ? "green" : "neutral"}>{done ? "Done" : "Not started"}</Badge>
          </div>
          <div className="mt-1.5">{children}</div>

          {!preview && !done && requireAgree && (
            <label className="mt-3 flex items-start gap-2 text-[13px]" style={{ color: "var(--p-text-2)" }}>
              <input type="checkbox" className="mt-0.5" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>{requireAgree}</span>
            </label>
          )}

          {!preview && (
            <div className="mt-3">
              {done ? (
                <div className="p-muted text-[12px]" style={{ color: "var(--p-green)" }}>
                  Completed
                  {state.completed_at ? ` · ${new Date(state.completed_at).toLocaleDateString()}` : ""}
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onComplete}
                  disabled={pending || (!!requireAgree && !agreed)}
                >
                  {actionLabel ?? "Mark complete"}
                </Button>
              )}
            </div>
          )}
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
