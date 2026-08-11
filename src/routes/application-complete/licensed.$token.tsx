import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { PublicShell } from "@/components/vantage/brand";
import { CalendlyInline } from "@/components/vantage/calendly-inline";
import { DISCORD_INVITE_URL, XCEL_COURSE_URL, XCEL_PARTNER_CODE } from "@/lib/next-steps";
import {
  getOverviewBooking,
  getSchedulingContext,
  markLicensedFallback,
  markScheduled,
} from "@/lib/applications.functions";

export const Route = createFileRoute("/application-complete/licensed/$token")({
  head: () => ({
    meta: [
      { title: "Application received — Licensed agent interview" },
      { name: "description", content: "Schedule your Vantage Financial licensed agent interview." },
      { property: "og:title", content: "Book your Vantage licensed interview" },
      { property: "og:description", content: "Pick a time that works with your assigned Vantage recruiter." },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ params }) => {
    const ctx = await getSchedulingContext({ data: { token: params.token } });
    return { ctx };
  },
  component: LicensedComplete,
});

function LicensedComplete() {
  const { ctx } = Route.useLoaderData();
  const { token } = Route.useParams();
  const mark = useServerFn(markScheduled);
  const markFallback = useServerFn(markLicensedFallback);
  const resolveBooking = useServerFn(getOverviewBooking);
  const [firstName, setFirstName] = useState(ctx.first_name || "there");
  const [booked, setBooked] = useState(false);
  const [copied, setCopied] = useState(false);
  const flagged = useRef(false);

  // Licensed applicants can also grab a 1:1 call with the nearest leader above
  // their recruiter — pre-filled with their name, email, phone and referrer.
  const bookingQuery = useQuery({
    queryKey: ["overview-booking", token],
    queryFn: () => resolveBooking({ data: { token, base_url: "" } }),
    enabled: ctx.found,
    retry: false,
  });

  useEffect(() => {
    if (!ctx.first_name) {
      setFirstName(sessionStorage.getItem("vantage_applicant_first") || "there");
    }
  }, [ctx.first_name]);

  useEffect(() => {
    if (ctx.found && ctx.link_missing && !flagged.current) {
      flagged.current = true;
      markFallback({ data: { token } }).catch(() => {});
    }
  }, [ctx.found, ctx.link_missing, markFallback, token]);

  if (!ctx.found) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-[720px] px-6 pt-24 pb-24 text-center md:px-8">
          <h1 className="font-display text-[clamp(36px,6vw,58px)] leading-none">Link expired</h1>
          <p className="mt-4 text-vantage-muted">We couldn't find your application. Please re-apply.</p>
          <div className="mt-6"><Link to="/apply" className="vantage-btn-primary px-6 py-3.5">Start over →</Link></div>
        </div>
      </PublicShell>
    );
  }

  // Stay on this page after booking — they keep their next steps and resources.
  async function onConfirm() {
    try { await mark({ data: { token } }); } catch { /* non-blocking */ }
    setBooked(true);
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(XCEL_PARTNER_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
  }

  const url = ctx.calendly_url;
  const contact = ctx.contact_name;
  const oneOnOneUrl = bookingQuery.data?.one_on_one_url ?? null;

  return (
    <PublicShell>
      <div className="mx-auto max-w-[900px] px-6 pt-14 pb-24 text-center md:px-8">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-vantage-gold text-[26px] text-vantage-card shadow-[0_0_40px_rgba(201,168,76,0.5)]">
          ✓
        </div>
        <div className="vantage-eyebrow-pill mb-4 inline-flex">Licensed applicant</div>
        <h1 className="font-display text-[clamp(36px,6vw,58px)] leading-[0.96]">
          Welcome, {firstName} — let's get you interviewed
        </h1>
        <p className="mx-auto mt-4 max-w-[600px] text-[16px] leading-relaxed text-vantage-muted">
          You've been identified as a licensed applicant. The next step is a short interview with{" "}
          {contact ? <span className="text-vantage-fog">{contact}</span> : "your assigned Vantage recruiter"}
          . Pick a time below to lock it in.
        </p>

        {url ? (
          <>
            <CalendlyInline url={url} />
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <a href={url} target="_blank" rel="noreferrer noopener" className="vantage-btn-ghost px-6 py-3.5 text-[15px]">
                Open Calendly in a new tab →
              </a>
              <button onClick={onConfirm} className="vantage-btn-primary px-6 py-3.5 text-[15px]">
                I've booked — continue →
              </button>
            </div>
            <p className="mt-4 text-[13px] text-vantage-faint">
              Your application isn't complete until an interview time is selected.
            </p>
          </>
        ) : (
          <div className="vantage-card vantage-card-gold mt-10 p-8 text-left md:p-10">
            <h2 className="font-display text-[28px] leading-tight text-vantage-ivory">Your application was received</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-vantage-muted">
              {contact ? <>Your recruiting manager, <span className="text-vantage-fog">{contact}</span>, will reach out shortly to schedule your interview.</> : "A recruiting manager will contact you shortly to schedule your interview."}
            </p>
            <p className="mt-2 text-[14px] text-vantage-faint">
              You don't need to do anything else right now — watch your inbox and phone for outreach within one business day.
            </p>
            <div className="mt-6">
              <Link to="/" className="vantage-btn-ghost px-6 py-3.5 text-[15px]">Back to Vantage →</Link>
            </div>
          </div>
        )}
      </div>
    </PublicShell>
  );
}
