import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { PublicShell } from "@/components/apex/brand";
import { CalendlyInline } from "@/components/apex/calendly-inline";
import { getSchedulingContext, markScheduled } from "@/lib/applications.functions";

export const Route = createFileRoute("/application-complete/unlicensed/$token")({
  head: () => ({
    meta: [
      { title: "Application received — Book your Vantage overview" },
      { name: "description", content: "Schedule your Vantage Financial overview call." },
      { property: "og:title", content: "Book your Vantage overview" },
      {
        property: "og:description",
        content: "Pick a Monday and we'll walk you through the next steps.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ params }) => {
    const ctx = await getSchedulingContext({ data: { token: params.token } });
    return { ctx };
  },
  component: UnlicensedComplete,
});

function UnlicensedComplete() {
  const { ctx } = Route.useLoaderData();
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const mark = useServerFn(markScheduled);
  const [firstName, setFirstName] = useState(ctx.first_name || "there");

  useEffect(() => {
    if (!ctx.first_name) {
      setFirstName(sessionStorage.getItem("apex_applicant_first") || "there");
    }
  }, [ctx.first_name]);

  if (!ctx.found) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-[720px] px-6 pt-24 pb-24 text-center md:px-8">
          <h1 className="font-display text-[clamp(36px,6vw,58px)] leading-none">Link expired</h1>
          <p className="mt-4 text-apex-muted">
            We couldn't find your application. Please re-apply.
          </p>
          <div className="mt-6">
            <Link to="/apply" className="apx-btn-primary px-6 py-3.5">
              Start over →
            </Link>
          </div>
        </div>
      </PublicShell>
    );
  }

  async function onConfirm() {
    try {
      await mark({ data: { token } });
    } catch {
      /* non-blocking */
    }
    navigate({ to: "/application-complete" });
  }

  const url = ctx.calendly_url!;

  return (
    <PublicShell>
      <div className="mx-auto max-w-[900px] px-6 pt-14 pb-24 text-center md:px-8">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-apex-gold text-[26px] text-apex-card shadow-[0_0_40px_rgba(201,168,76,0.5)]">
          ✓
        </div>
        <div className="apx-eyebrow-pill mb-4 inline-flex">Application received</div>
        <h1 className="font-display text-[clamp(36px,6vw,58px)] leading-[0.96]">
          You're in, {firstName} — now book your overview
        </h1>
        <p className="mx-auto mt-4 max-w-[560px] text-[16px] leading-relaxed text-apex-muted">
          The next step is the Vantage Financial overview call. Pick a Monday below — your application
          isn't complete until an overview time is selected.
        </p>

        <CalendlyInline url={url} />

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className="apx-btn-ghost px-6 py-3.5 text-[15px]"
          >
            Open Calendly in a new tab →
          </a>
          <button onClick={onConfirm} className="apx-btn-primary px-6 py-3.5 text-[15px]">
            I've booked — continue →
          </button>
        </div>
        <p className="mt-4 text-[13px] text-apex-faint">
          Your application isn't complete until you select an overview time.
        </p>

        {/* Immediate licensing next steps — don't make them wait for Monday to know what's next */}
        <div className="mx-auto mt-16 max-w-[820px] text-left">
          <div className="apx-kicker mb-4">Your licensing next steps</div>
          <div className="grid gap-4 md:grid-cols-3">
            {NEXT_STEPS.map((s) => (
              <div key={s.n} className="apx-card flex flex-col gap-2.5 p-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-apex-gold/50 font-display text-[18px] text-apex-gold">
                  {s.n}
                </div>
                <div className="font-display text-[20px] leading-tight text-apex-ivory">{s.t}</div>
                <div className="text-[13.5px] leading-relaxed text-apex-dim">{s.d}</div>
              </div>
            ))}
          </div>

          <div className="apx-card mt-4 p-6 md:p-7">
            <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-apex-muted">
              Licensing checklist
            </div>
            <div className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {LICENSING_CHECKLIST.map((c) => (
                <div key={c} className="flex items-start gap-3 text-[14.5px] text-apex-fog">
                  <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-[4px] border border-apex-gold/40" />
                  {c}
                </div>
              ))}
            </div>
            <p className="mt-4 text-[12.5px] leading-relaxed text-apex-faint">
              You don't need to complete every licensing step before attending the overview — the
              Monday overview is your main next appointment.
            </p>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}

const NEXT_STEPS = [
  {
    n: "1",
    t: "Reserve your seat",
    d: "Book the next Monday Vantage Company Overview above — 7:00 PM CT / 8:00 PM ET.",
  },
  {
    n: "2",
    t: "Prepare to get licensed",
    d: "Review the licensing process and get ready to begin the approved licensing course.",
  },
  {
    n: "3",
    t: "Attend the overview",
    d: "Attend the overview and follow the instructions provided by the Vantage team.",
  },
];

const LICENSING_CHECKLIST = [
  "Complete the Vantage evaluation",
  "Receive the approved licensing course instructions",
  "Purchase and begin the course",
  "Complete the required education",
  "Schedule the state exam",
  "Pass the state exam",
  "Apply for the state license",
  "Complete Vantage onboarding",
];
