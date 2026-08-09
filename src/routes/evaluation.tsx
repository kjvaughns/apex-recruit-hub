import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PublicShell } from "@/components/apex/brand";
import { submitEvaluation } from "@/lib/applications.functions";

export const Route = createFileRoute("/evaluation")({
  head: () => ({
    meta: [
      { title: "Complete your evaluation — Vantage Financial" },
      { name: "description", content: "Finish your Vantage application with a two-minute evaluation." },
      { property: "og:title", content: "Vantage evaluation" },
      { property: "og:description", content: "Four questions. About two minutes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EvaluationPage,
});

const QUESTIONS = [
  {
    key: "income", kicker: "Question 1 of 4", title: "What's your monthly income goal?",
    options: ["$8–10k / month", "$10–20k / month", "$20k+ / month", "Replace my current income"],
  },
  {
    key: "licensing", kicker: "Question 2 of 4", title: "Where are you with licensing?",
    options: ["Not licensed yet", "Studying / exam scheduled", "Licensed — life", "Licensed — life & health"],
  },
  {
    key: "availability", kicker: "Question 3 of 4", title: "How much time can you commit?",
    options: ["Part-time (nights & weekends)", "Full-time now", "Transitioning within 30 days"],
  },
  {
    key: "commitment", kicker: "Question 4 of 4", title: "How serious are you about starting?",
    options: ["Just exploring options", "Serious — ready to start", "All-in — this is my priority"],
  },
] as const;

function EvaluationPage() {
  const submit = useServerFn(submitEvaluation);
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [needsEmail, setNeedsEmail] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(opt: string) {
    const q = QUESTIONS[step];
    const next = { ...answers, [q.key]: opt };
    setAnswers(next);
    if (step < QUESTIONS.length - 1) setStep(step + 1);
    else finish(next);
  }

  async function finish(finalAnswers: Record<string, string>) {
    setError(null);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNeedsEmail(true);
      setError("Please enter a valid email.");
      return;
    }
    setSubmitting(true);
    try {
      await submit({ data: { email: email.trim(), answers: finalAnswers } });
      setDone(true);
    } catch (e) {
      setError((e as Error).message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-[720px] px-6 pt-14 pb-24 md:px-8">
        {done ? (
          <div className="apx-card apx-card-gold p-10 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-apex-gold text-[30px] text-apex-card">
              ✓
            </div>
            <h1 className="font-display text-[clamp(38px,6vw,58px)] leading-[0.96]">
              Thanks — your evaluation is complete.
            </h1>
            <p className="mt-4 text-apex-muted">Your recruiter will follow up shortly with next steps.</p>
            <Link to="/" className="apx-btn-ghost mt-6 inline-flex px-6 py-3 text-[14px]">
              Back to home
            </Link>
          </div>
        ) : needsEmail ? (
          <div className="apx-card p-8 md:p-10">
            <div className="apx-kicker mb-3">Step 3 of 3</div>
            <h1 className="font-display text-[clamp(34px,5.5vw,52px)] leading-[0.96]">Your evaluation</h1>
            <p className="mt-3 max-w-[440px] text-[15px] leading-relaxed text-apex-muted">
              Four quick questions. Takes about two minutes. Start by confirming the email you applied with.
            </p>
            <div className="mt-6">
              <label className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.06em] text-apex-muted">Email</label>
              <input
                type="email"
                className="apx-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && <div className="mt-4 text-[13.5px] text-red-300">{error}</div>}
            <button
              onClick={() => { if (email.trim()) setNeedsEmail(false); }}
              className="apx-btn-primary mt-6 w-full px-6 py-4 text-[15px]"
            >
              Start the evaluation →
            </button>
          </div>
        ) : (
          <div className="apx-card p-8 md:p-10">
            <div className="apx-kicker mb-2">{QUESTIONS[step].kicker}</div>
            <h2 className="font-display text-[clamp(26px,4vw,40px)] leading-[1]">{QUESTIONS[step].title}</h2>
            <div className="mt-6 flex flex-col gap-3">
              {QUESTIONS[step].options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => pick(opt)}
                  disabled={submitting}
                  className="rounded-[12px] border border-white/10 bg-white/[0.02] px-5 py-4 text-left text-[15px] text-apex-fog transition hover:border-apex-gold/50 hover:bg-apex-gold/[0.06] hover:text-apex-ivory disabled:opacity-60"
                >
                  {opt}
                </button>
              ))}
            </div>
            {error && <div className="mt-4 text-[13.5px] text-red-300">{error}</div>}
            <div className="mt-6 flex items-center justify-between text-[12px] text-apex-faint">
              <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="disabled:opacity-40">
                ← Back
              </button>
              <span>{step + 1} / {QUESTIONS.length}</span>
            </div>
          </div>
        )}
      </div>
    </PublicShell>
  );
}
