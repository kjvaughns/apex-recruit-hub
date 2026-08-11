import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { PublicShell } from "@/components/vantage/brand";
import { getSchedulingContext, markScheduled } from "@/lib/applications.functions";

export const Route = createFileRoute("/application-complete/unlicensed/$token")({
  head: () => ({
    meta: [
      { title: "You're in — here's your next step" },
      { name: "description", content: "Your Vantage application is in. Here's what happens next." },
      { property: "og:title", content: "You're in — here's your next step" },
      {
        property: "og:description",
        content: "Book your overview and get a head start on licensing.",
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
      setFirstName(sessionStorage.getItem("vantage_applicant_first") || "there");
    }
  }, [ctx.first_name]);

  if (!ctx.found) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-[720px] px-6 pt-24 pb-24 text-center md:px-8">
          <h1 className="font-display text-[clamp(36px,6vw,58px)] leading-none">Link expired</h1>
          <p className="mt-4 text-vantage-muted">
            We couldn't find your application. Please re-apply.
          </p>
          <div className="mt-6">
            <Link to="/apply" className="vantage-btn-primary px-6 py-3.5">
              Start over →
            </Link>
          </div>
        </div>
      </PublicShell>
    );
  }

  // Unlicensed branch: no embedded Calendly. We route everyone to the Overview
  // meeting via a link (delivered again by email in Phase 3), and lead with the
  // "what happens next" checklist so they know exactly where they stand.
  const overviewUrl = ctx.calendly_url || null;

  async function onBooked() {
    try {
      await mark({ data: { token } });
    } catch {
      /* non-blocking */
    }
    navigate({ to: "/application-complete" });
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-[820px] px-6 pt-14 pb-24 md:px-8">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-vantage-gold text-[26px] text-vantage-card shadow-[0_0_40px_rgba(201,168,76,0.5)]">
            ✓
          </div>
          <div className="vantage-eyebrow-pill mb-4 inline-flex">Application received</div>
          <h1 className="font-display text-[clamp(36px,6vw,58px)] leading-[0.96]">
            You're in, {firstName} — here's your next step
          </h1>
          <p className="mx-auto mt-4 max-w-[560px] text-[16px] leading-relaxed text-vantage-muted">
            We've got your application. The next step is the Vantage overview call — and you can get
            a head start on licensing today so you're never waiting on us to move.
          </p>
        </div>

        {/* Primary next step — book the overview (link, not an embed) */}
        <div className="vantage-card vantage-card-gold mt-10 flex flex-col items-start gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div>
            <div className="font-display text-[24px] leading-tight text-vantage-ivory">
              Book your Vantage overview
            </div>
            <p className="mt-1.5 text-[14px] leading-relaxed text-vantage-muted">
              Monday nights, 7:00 PM CT / 8:00 PM ET. This is where we walk you through how it all
              works and what's next.
            </p>
          </div>
          {overviewUrl ? (
            <a
              href={overviewUrl}
              target="_blank"
              rel="noreferrer noopener"
              onClick={() => {
                // best-effort: record that they were routed to book
                mark({ data: { token } }).catch(() => {});
              }}
              className="vantage-btn-primary flex-none px-6 py-3.5 text-[15px]"
            >
              Book the overview →
            </a>
          ) : (
            <span className="flex-none text-[13px] text-vantage-faint">
              We'll email you the booking link shortly.
            </span>
          )}
        </div>

        {overviewUrl && (
          <div className="mt-3 text-center">
            <button
              onClick={onBooked}
              className="text-[13px] text-vantage-dim underline-offset-4 transition hover:text-vantage-gold hover:underline"
            >
              I've already booked — continue →
            </button>
          </div>
        )}

        {/* What happens next — mirrors the Phase 3 unlicensed email copy */}
        <div className="mt-14">
          <div className="vantage-kicker mb-4">What happens next</div>
          <div className="grid gap-4 md:grid-cols-3">
            {NEXT_STEPS.map((s) => (
              <div key={s.n} className="vantage-card flex flex-col gap-2.5 p-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-vantage-gold/50 font-display text-[18px] text-vantage-gold">
                  {s.n}
                </div>
                <div className="font-display text-[20px] leading-tight text-vantage-ivory">{s.t}</div>
                <div className="text-[13.5px] leading-relaxed text-vantage-dim">{s.d}</div>
              </div>
            ))}
          </div>

          <div className="vantage-card mt-4 p-6 md:p-7">
            <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-vantage-muted">
              Licensing checklist
            </div>
            <div className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {LICENSING_CHECKLIST.map((c) => (
                <div key={c} className="flex items-start gap-3 text-[14.5px] text-vantage-fog">
                  <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-[4px] border border-vantage-gold/40" />
                  {c}
                </div>
              ))}
            </div>
            <p className="mt-4 text-[12.5px] leading-relaxed text-vantage-faint">
              You don't need to finish licensing before the overview — the Monday overview is your
              main next appointment. Getting a head start just means you move faster once you're in.
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
    t: "Book the overview",
    d: "Reserve your seat at the next Monday Vantage overview using the button above.",
  },
  {
    n: "2",
    t: "Get a head start",
    d: "Start the approved licensing course today so you're not waiting on us to move forward.",
  },
  {
    n: "3",
    t: "Attend & join",
    d: "Attend the overview. If it's a fit, you'll get a short form to officially join the team.",
  },
];

const LICENSING_CHECKLIST = [
  "Attend the Monday overview",
  "Receive the approved licensing course instructions",
  "Purchase and begin the course",
  "Complete the required education",
  "Schedule the state exam",
  "Pass the state exam",
  "Apply for the state license",
  "Complete Vantage onboarding",
];
