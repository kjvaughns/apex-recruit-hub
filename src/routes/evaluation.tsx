import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { PublicShell } from "@/components/apex/brand";
import { submitEvaluation, getEvaluationPrefill } from "@/lib/applications.functions";

const searchSchema = z.object({ a: z.string().optional() });

export const Route = createFileRoute("/evaluation")({
  head: () => ({
    meta: [
      { title: "Join the team — Vantage Financial" },
      { name: "description", content: "Finish your Vantage application in about two minutes." },
      { property: "og:title", content: "Vantage evaluation" },
      { property: "og:description", content: "A few quick details. About two minutes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => ({ a: search.a }),
  loader: async ({ deps }) => {
    if (!deps.a) return { prefill: null as null | Awaited<ReturnType<typeof getEvaluationPrefill>> };
    try {
      const prefill = await getEvaluationPrefill({ data: { applicant_id: deps.a } });
      return { prefill };
    } catch {
      return { prefill: null };
    }
  },
  component: EvaluationPage,
});

const LICENSING_OPTIONS = [
  "Not licensed yet",
  "Studying / exam scheduled",
  "Licensed — Life",
  "Licensed — Life & Health",
] as const;

function deriveLicensing(p: { licensed?: boolean; licensing_status?: string | null } | null) {
  if (!p) return "";
  if (p.licensing_status) {
    const match = LICENSING_OPTIONS.find(
      (o) => o.toLowerCase() === p.licensing_status!.toLowerCase(),
    );
    if (match) return match;
  }
  if (p.licensed === true) return "Licensed — Life & Health";
  if (p.licensed === false) return "Not licensed yet";
  return "";
}

function EvaluationPage() {
  const { a } = Route.useSearch();
  const { prefill } = Route.useLoaderData();
  const submit = useServerFn(submitEvaluation);

  const pf = prefill && prefill.found ? prefill : null;
  const [firstName, setFirstName] = useState(pf?.first_name ?? "");
  const [lastName, setLastName] = useState(pf?.last_name ?? "");
  const [email, setEmail] = useState(pf?.email ?? "");
  const [phone, setPhone] = useState("");
  const [licensing, setLicensing] = useState(deriveLicensing(pf));
  const [why, setWhy] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [hiredLicensed, setHiredLicensed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError("Please add your first and last name.");
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email.");
      return;
    }
    if (!licensing) {
      setError("Please tell us your current licensing status.");
      return;
    }
    if (!why.trim() || why.trim().length < 10) {
      setError("Tell us a little about why you want to join (at least a sentence).");
      return;
    }
    setSubmitting(true);
    try {
      const res = await submit({
        data: {
          applicant_id: a || "",
          email: email.trim(),
          answers: {
            full_name: `${firstName.trim()} ${lastName.trim()}`,
            phone: phone.trim(),
            licensing_status: licensing,
            why: why.trim(),
          },
        },
      });
      setHiredLicensed(!!res.licensed);
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
              Welcome to Vantage — you're officially on the team.
            </h1>
            {hiredLicensed ? (
              <p className="mx-auto mt-4 max-w-[460px] text-apex-muted">
                You're in. Since you're already licensed, the next step is contracting paperwork —
                someone from the team will follow up shortly with the details.
              </p>
            ) : (
              <p className="mx-auto mt-4 max-w-[460px] text-apex-muted">
                You're in. Get started on your licensing course today — we'll be in touch with your
                onboarding steps and check in with you each week until you're licensed.
              </p>
            )}
            <Link to="/" className="apx-btn-ghost mt-6 inline-flex px-6 py-3 text-[14px]">
              Back to home
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center">
              <div className="apx-eyebrow-pill mb-5 inline-flex">Final step</div>
              <h1 className="font-display text-[clamp(36px,5.5vw,58px)] leading-[0.96]">
                Join the Vantage team
              </h1>
              <p className="mx-auto mt-4 max-w-[500px] text-[16px] leading-relaxed text-apex-muted">
                A few quick details and you're in. Takes about two minutes — no résumé, no quiz.
              </p>
            </div>

            <div className="apx-card mt-10 grid gap-4 p-6 md:p-10">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="First name *">
                  <input
                    className="apx-input"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </Field>
                <Field label="Last name *">
                  <input
                    className="apx-input"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Email *">
                  <input
                    type="email"
                    className="apx-input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    type="tel"
                    className="apx-input"
                    placeholder="(optional)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </Field>
              </div>

              <Field label="What's your current licensing status? *">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {LICENSING_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setLicensing(opt)}
                      className={`rounded-[12px] border px-4 py-3 text-left text-[14px] transition ${
                        licensing === opt
                          ? "border-apex-gold bg-apex-gold/[0.08] text-apex-ivory"
                          : "border-white/10 bg-white/[0.02] text-apex-fog hover:border-apex-gold/40"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Why do you want to join Vantage? *">
                <textarea
                  className="apx-input min-h-[160px] leading-relaxed"
                  rows={6}
                  placeholder="Tell us what's driving you — your goals, your background, and why now."
                  value={why}
                  onChange={(e) => setWhy(e.target.value)}
                />
                <p className="mt-2 text-[12px] text-apex-faint">
                  No wrong answer — we just want to hear it in your own words.
                </p>
              </Field>

              {error && (
                <div className="rounded-[10px] border border-red-500/30 bg-red-500/10 p-3.5 text-[13.5px] text-red-200">
                  {error}
                </div>
              )}

              <button
                onClick={onSubmit}
                disabled={submitting}
                className="apx-btn-primary mt-2 w-full px-6 py-4 text-[16px] disabled:opacity-60"
              >
                {submitting ? "Submitting…" : <>Submit & join the team →</>}
              </button>
            </div>
          </>
        )}
      </div>
    </PublicShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.06em] text-apex-muted">
        {label}
      </span>
      {children}
    </div>
  );
}
