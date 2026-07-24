import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { PublicShell } from "@/components/apex/brand";
import { CalendlyInline } from "@/components/apex/calendly-inline";
import { getSchedulingContext, markScheduled } from "@/lib/applications.functions";

export const Route = createFileRoute("/application-complete/unlicensed/$token")({
  head: () => ({
    meta: [
      { title: "Application received — Book your APEX overview" },
      { name: "description", content: "Schedule your APEX Financial overview call." },
      { property: "og:title", content: "Book your APEX overview" },
      { property: "og:description", content: "Pick a Monday and we'll walk you through the next steps." },
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
          <p className="mt-4 text-apex-muted">We couldn't find your application. Please re-apply.</p>
          <div className="mt-6"><Link to="/apply" className="apx-btn-primary px-6 py-3.5">Start over →</Link></div>
        </div>
      </PublicShell>
    );
  }

  async function onConfirm() {
    try { await mark({ data: { token } }); } catch { /* non-blocking */ }
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
          The next step is the APEX Financial overview call. Pick a Monday below — your application isn't complete until an overview time is selected.
        </p>

        <CalendlyInline url={url} />

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a href={url} target="_blank" rel="noreferrer noopener" className="apx-btn-ghost px-6 py-3.5 text-[15px]">
            Open Calendly in a new tab →
          </a>
          <button onClick={onConfirm} className="apx-btn-primary px-6 py-3.5 text-[15px]">
            I've booked — continue →
          </button>
        </div>
        <p className="mt-4 text-[13px] text-apex-faint">
          Your application isn't complete until you select an overview time.
        </p>
      </div>
    </PublicShell>
  );
}
