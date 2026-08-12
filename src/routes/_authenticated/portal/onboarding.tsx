import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/vantage/portal-shell";
import {
  PageHeader,
  PageBody,
  Panel,
  Button,
  Badge,
  ErrorState,
  CardSkeleton,
  Checkbox,
  notify,
} from "@/components/portal/ui";
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
  const notifyFn = useServerFn(notifyOnboarding);

  const q = useQuery({
    queryKey: ["my-onboarding"],
    queryFn: () => fetchOnboarding(),
  });

  const mut = useMutation({
    mutationFn: (step: SelfCheckStep) => completeStep({ data: { step } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-onboarding"] });
      qc.invalidateQueries({ queryKey: ["applicants"] });
      qc.invalidateQueries({ queryKey: ["applicant"] });
      notify.success("Step marked complete.");
    },
    onError: () => notify.error("Could not update that step.", "Please try again."),
  });

  const notifyContracting = () => {
    notifyFn({ data: { kind: "contracting_done" } }).catch(() => {});
  };

  if (q.isLoading) {
    return (
      <PortalShell>
        <PageBody>
          <PageHeader title="Your onboarding checklist" description="Welcome to Vantage" />
          <div className="max-w-[820px] space-y-4">
            <CardSkeleton lines={1} />
            <CardSkeleton lines={5} />
          </div>
        </PageBody>
      </PortalShell>
    );
  }

  if (q.isError) {
    return (
      <PortalShell>
        <PageBody>
          <PageHeader title="Your onboarding checklist" description="Welcome to Vantage" />
          <div className="max-w-[820px]">
            <Panel>
              <ErrorState
                description="We couldn't load your checklist right now. Please try again."
                onRetry={() => q.refetch()}
              />
            </Panel>
          </div>
        </PageBody>
      </PortalShell>
    );
  }

  const data = q.data;

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
            <Panel padded={false}>
              <StepChecklist preview />
            </Panel>
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
  const currentIndex = ONBOARDING_STEP_ORDER.findIndex((k) => !stepState(steps, k).completed);

  return (
    <PortalShell>
      <PageBody>
        <PageHeader title="Your onboarding checklist" description="Welcome to Vantage" />

        <div className="max-w-[820px] space-y-4">
          <Panel>
            <div className="mb-2 flex items-center justify-between">
              <span className="p-label">
                {allDone
                  ? "All steps complete"
                  : `Step ${Math.min(currentIndex + 1, total)} of ${total}`}
              </span>
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

          <Panel padded={false}>
            <StepChecklist
              steps={steps}
              currentIndex={currentIndex}
              onComplete={(s) => mut.mutate(s)}
              onCompleteContracting={() => {
                mut.mutate("agentspace_contracting");
                notifyContracting();
              }}
              pending={mut.isPending}
            />
          </Panel>
        </div>
      </PageBody>
    </PortalShell>
  );
}

function CompletionPanel() {
  const notifyFn = useServerFn(notifyOnboarding);
  const [sent, setSent] = useState(false);
  const mut = useMutation({
    mutationFn: () => notifyFn({ data: { kind: "trainer" } }),
    onSuccess: () => {
      setSent(true);
      notify.success("Your trainer has been notified.");
    },
    onError: () => notify.error("Could not notify your trainer.", "Please try again."),
  });
  return (
    <Panel className="text-center">
      <div
        className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full text-[22px]"
        style={{ background: "var(--p-gold)", color: "#0B0B0C" }}
      >
        ✓
      </div>
      <h2 className="p-card-title">You're all set</h2>
      <p className="p-secondary mx-auto mt-2 max-w-[460px]">
        You are ready for New Agent Training. Notify your trainer that you have completed onboarding.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button variant="primary" loading={mut.isPending} disabled={sent} onClick={() => mut.mutate()}>
          {sent ? "✓ Trainer notified" : "Notify trainer"}
        </Button>
        <Link to="/portal">
          <Button variant="secondary">Go to your dashboard →</Button>
        </Link>
      </div>
    </Panel>
  );
}

type StepDef = {
  key: SelfCheckStep;
  title: string;
  summary: string;
  actionLabel: string;
  requireAgree?: string;
  render: () => React.ReactNode;
};

const STEP_DEFS: StepDef[] = [
  {
    key: "agentspace_contracting",
    title: "AgentSpace contracting",
    summary: "Create your AgentSpace account, join the agency, and verify licensing.",
    actionLabel: "I completed contracting",
    render: () => (
      <>
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
      </>
    ),
  },
  {
    key: "discord_role_update",
    title: "Update Discord role",
    summary: "Register as a Licensed Agent to unlock the licensed-agent channels.",
    actionLabel: "Mark complete",
    render: () => (
      <>
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
      </>
    ),
  },
  {
    key: "read_agent_playbook",
    title: "Read the Vantage Financial Agent Playbook",
    summary: "Covers how we sell, our systems, and what's expected of every agent.",
    actionLabel: "I have read the playbook",
    render: () => (
      <>
        <p className="p-secondary">
          Read the Agent Playbook end to end — it covers how we sell, our systems, and what's expected
          of every Vantage agent.
        </p>
        <div className="mt-3">
          <Link to="/portal/academy/library/$slug" params={{ slug: "agent-playbook" }}>
            <Button variant="secondary" size="sm">Open Agent Playbook →</Button>
          </Link>
        </div>
      </>
    ),
  },
  {
    key: "agent_expectations_schedule",
    title: "Agent expectations & schedule",
    summary: "Weekly meeting schedule and the Vantage production standards.",
    actionLabel: "I understand and agree",
    requireAgree: "I understand and agree to the Vantage Financial standards and schedule.",
    render: () => (
      <>
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
      </>
    ),
  },
  {
    key: "complete_vantage_closer_course",
    title: "Complete the Vantage Closer Course",
    summary: "Required pre-training course on the Vantage sales process and mindset.",
    actionLabel: "I've completed the course",
    render: () => (
      <>
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
      </>
    ),
  },
];

/** The single sequential onboarding checklist. Shared by the live agent view and the read-only preview. */
function StepChecklist({
  steps,
  currentIndex = 0,
  onComplete,
  onCompleteContracting,
  pending,
  preview,
}: {
  steps?: Record<string, OnboardingStepState>;
  currentIndex?: number;
  onComplete?: (step: SelfCheckStep) => void;
  onCompleteContracting?: () => void;
  pending?: boolean;
  preview?: boolean;
}) {
  return (
    <div className="divide-y" style={{ borderColor: "var(--p-border)" }}>
      {STEP_DEFS.map((def, i) => {
        const state = stepState(steps, def.key);
        const done = state.completed;
        const isCurrent = !preview && !done && i === currentIndex;
        const status: "done" | "current" | "upcoming" = done ? "done" : isCurrent ? "current" : "upcoming";
        return (
          <StepRow
            key={def.key}
            n={i + 1}
            def={def}
            status={preview ? "upcoming" : status}
            state={state}
            pending={pending}
            preview={preview}
            onComplete={() =>
              def.key === "agentspace_contracting" && onCompleteContracting
                ? onCompleteContracting()
                : onComplete?.(def.key)
            }
          />
        );
      })}
    </div>
  );
}

function StepRow({
  n,
  def,
  status,
  state,
  pending,
  preview,
  onComplete,
}: {
  n: number;
  def: StepDef;
  status: "done" | "current" | "upcoming";
  state: OnboardingStepState;
  pending?: boolean;
  preview?: boolean;
  onComplete: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const expanded = status === "current" || (preview && n === 1);

  const indicator =
    status === "done" ? (
      <div
        className="grid h-8 w-8 flex-none place-items-center rounded-full text-[14px] font-semibold"
        style={{ background: "rgba(63,179,127,0.12)", color: "var(--p-green)" }}
      >
        ✓
      </div>
    ) : status === "current" ? (
      <div
        className="grid h-8 w-8 flex-none place-items-center rounded-full border-2 text-[13px] font-semibold"
        style={{ borderColor: "var(--p-gold)", color: "var(--p-gold)" }}
      >
        {n}
      </div>
    ) : (
      <div
        className="grid h-8 w-8 flex-none place-items-center rounded-full border text-[13px] font-semibold"
        style={{ borderColor: "var(--p-border)", color: "var(--p-text-3)" }}
      >
        {n}
      </div>
    );

  return (
    <div
      className="px-4 py-4"
      style={status === "current" ? { background: "var(--p-gold-soft)" } : undefined}
    >
      <div className="flex items-start gap-3">
        {indicator}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="p-card-title" style={status === "upcoming" ? { color: "var(--p-text-3)" } : undefined}>
              {def.title}
            </h3>
            {status === "done" && <Badge tone="green">Done</Badge>}
            {status === "current" && <Badge tone="gold">Current step</Badge>}
          </div>

          {!expanded ? (
            <p className="p-secondary mt-1">{def.summary}</p>
          ) : (
            <div className="mt-1.5">{def.render()}</div>
          )}

          {status === "current" && def.requireAgree && (
            <div className="mt-3">
              <Checkbox checked={agreed} onChange={setAgreed} label={def.requireAgree} />
            </div>
          )}

          {!preview && (
            <div className="mt-3">
              {status === "done" ? (
                <div className="text-[12px]" style={{ color: "var(--p-green)" }}>
                  Completed
                  {state.completed_at ? ` · ${new Date(state.completed_at).toLocaleDateString()}` : ""}
                </div>
              ) : status === "current" ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onComplete}
                  disabled={pending || (!!def.requireAgree && !agreed)}
                >
                  {def.actionLabel}
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
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
